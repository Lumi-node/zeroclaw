importScripts('../shared/constants.js', '../shared/token-estimator.js', '../shared/markdown-bundler.js');

const { MSG, TAB_STATUS, EXTRACTION_TIMEOUT_MS, isRestrictedUrl } = ContextSwarmConstants;

let activePorts = new Set();

async function getAllTabs() {
  const tabs = await browser.tabs.query({ currentWindow: true });
  return tabs.map(tab => ({
    id: tab.id,
    title: tab.title,
    url: tab.url,
    favIconUrl: tab.favIconUrl,
    restricted: isRestrictedUrl(tab.url || '')
  }));
}

async function extractTab(tabId) {
  const timeoutPromise = new Promise(resolve =>
    setTimeout(() => {
      resolve({
        url: 'unknown',
        title: 'unknown',
        markdown: '',
        status: 'failed',
        error: 'Extraction timed out',
        extractedAt: new Date().toISOString(),
        fallback: false
      });
    }, EXTRACTION_TIMEOUT_MS)
  );

  const extractionPromise = (async () => {
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ['lib/readability.min.js']
      });
      await browser.scripting.executeScript({
        target: { tabId },
        files: ['lib/turndown.min.js']
      });
      await browser.scripting.executeScript({
        target: { tabId },
        files: ['lib/turndown-plugin-gfm.min.js']
      });
      const results = await browser.scripting.executeScript({
        target: { tabId },
        files: ['content/extractor.js']
      });

      const result = results[0].result;
      result.tokens = TokenEstimator.estimateTokens(result.markdown);
      return result;
    } catch (err) {
      return {
        url: 'unknown',
        title: 'unknown',
        markdown: '',
        status: 'failed',
        error: err.message,
        extractedAt: new Date().toISOString(),
        fallback: false
      };
    }
  })();

  return Promise.race([timeoutPromise, extractionPromise]);
}

async function startExtraction(tabIds) {
  broadcastProgress(null, 'started', { count: tabIds.length });

  const promises = tabIds.map(async (tabId) => {
    broadcastProgress(tabId, TAB_STATUS.EXTRACTING);
    try {
      const result = await extractTab(tabId);
      broadcastProgress(tabId, result.status === 'done' ? TAB_STATUS.DONE : TAB_STATUS.FAILED, result);
      return result;
    } catch (err) {
      const failResult = {
        url: 'unknown',
        title: 'unknown',
        markdown: '',
        status: 'failed',
        error: err.message,
        extractedAt: new Date().toISOString(),
        fallback: false
      };
      broadcastProgress(tabId, TAB_STATUS.FAILED, failResult);
      return failResult;
    }
  });

  const results = await Promise.all(promises);
  const bundle = MarkdownBundler.bundleMarkdown(results);

  return { results, bundle };
}

function broadcastProgress(tabId, status, result) {
  for (const port of activePorts) {
    try {
      port.postMessage({
        type: MSG.EXTRACTION_PROGRESS,
        tabId,
        status,
        result
      });
    } catch (e) {
      // Port disconnected; it will be cleaned up by onDisconnect
    }
  }
}

browser.runtime.onConnect.addListener((port) => {
  if (port.name === 'context-swarm') {
    activePorts.add(port);
    port.onDisconnect.addListener(() => {
      activePorts.delete(port);
    });
  }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MSG.GET_TABS) {
    getAllTabs().then(tabs => sendResponse({ tabs }));
    return true;
  }

  if (message.type === MSG.START_EXTRACTION) {
    startExtraction(message.tabIds).then(({ results, bundle }) => {
      sendResponse({ results, bundle });
    });
    return true;
  }

  if (message.type === MSG.PING_BRIDGE) {
    pingBridge().then(result => sendResponse(result));
    return true;
  }

  if (message.type === MSG.STORE_ZEROCLAW) {
    storeInZeroClaw(message.results, message.category, message.keyPrefix)
      .then(result => sendResponse(result));
    return true;
  }

  return false;
});

// Phase 2: Native messaging bridge integration

async function pingBridge() {
  try {
    const response = await browser.runtime.sendNativeMessage(
      'context_swarm',
      { action: 'ping' }
    );
    return { available: true, version: response.version || 'unknown' };
  } catch (e) {
    return { available: false, error: e.message };
  }
}

async function storeInZeroClaw(results, category, keyPrefix) {
  try {
    const pages = results
      .filter(r => r.status === 'done')
      .map(r => ({
        url: r.url,
        title: r.title,
        markdown: r.markdown,
        extracted_at: r.extractedAt
      }));

    const payload = {
      action: 'ingest',
      pages,
      category: category || 'web',
      key_prefix: keyPrefix || 'context-swarm'
    };

    const response = await browser.runtime.sendNativeMessage('context_swarm', payload);
    return response;
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}