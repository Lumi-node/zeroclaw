document.addEventListener('DOMContentLoaded', () => {
  const { MSG, TAB_STATUS, isRestrictedUrl } = ContextSwarmConstants;

  // Cache DOM elements
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  const tabList = document.getElementById('tab-list');
  const tabFilter = document.getElementById('tab-filter');
  const btnExtract = document.getElementById('btn-extract');
  const selectedCount = document.getElementById('selected-count');
  const progressList = document.getElementById('progress-list');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const btnCopy = document.getElementById('btn-copy');
  const btnDownload = document.getElementById('btn-download');
  const btnBack = document.getElementById('btn-back');
  const resultsSuccess = document.getElementById('results-success');
  const resultsFailed = document.getElementById('results-failed');
  const resultsTokens = document.getElementById('results-tokens');
  const copyFeedback = document.getElementById('copy-feedback');
  const viewTabs = document.getElementById('view-tabs');
  const viewProgress = document.getElementById('view-progress');
  const viewResults = document.getElementById('view-results');

  // Port connection
  const port = browser.runtime.connect({ name: 'context-swarm' });

  // State variables
  let tabs = [];
  let selectedTabIds = new Set();
  let extractionBundle = '';
  let extractionResults = [];
  let totalTabs = 0;
  let completedTabs = 0;

  // Initialize
  loadTabs();

  // Load tabs from background
  async function loadTabs() {
    const response = await browser.runtime.sendMessage({ type: MSG.GET_TABS });
    tabs = response.tabs;
    renderTabs();
  }

  // Render tab list with optional filter
  function renderTabs(filter = '') {
    tabList.innerHTML = '';

    const filteredTabs = filter
      ? tabs.filter(tab => {
        const searchText = (tab.title || '') + ' ' + (tab.url || '');
        return searchText.toLowerCase().includes(filter.toLowerCase());
      })
      : tabs;

    filteredTabs.forEach(tab => {
      const tabItem = document.createElement('div');
      tabItem.className = `tab-item ${tab.restricted ? 'restricted' : ''}`;
      tabItem.dataset.tabId = tab.id;

      tabItem.innerHTML = `
        <input type="checkbox" ${tab.restricted ? 'disabled' : ''} ${selectedTabIds.has(tab.id) ? 'checked' : ''}>
        <img class="tab-favicon" src="${escapeHtml(tab.favIconUrl || '')}" onerror="this.style.display='none'">
        <div class="tab-info">
          <span class="tab-title">${escapeHtml(tab.title || 'Untitled')}</span>
          <span class="tab-url">${escapeHtml(tab.url || '')}</span>
        </div>
        ${tab.restricted ? '<span class="lock-icon"></span>' : ''}
      `;

      // Click handler delegates to checkbox change event to avoid double-toggle
      if (!tab.restricted) {
        tabItem.addEventListener('click', (e) => {
          if (e.target.type !== 'checkbox') {
            const checkbox = tabItem.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
          }
        });
      }

      // Checkbox change handler
      const checkbox = tabItem.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          selectedTabIds.add(tab.id);
        } else {
              selectedTabIds.delete(tab.id);
        }
        updateSelectedCount();
        btnExtract.disabled = selectedTabIds.size === 0;
      });

      tabList.appendChild(tabItem);
    });

    updateSelectedCount();
    btnExtract.disabled = selectedTabIds.size === 0;
  }

  // Update selected count and sync select-all checkbox
  function updateSelectedCount() {
    selectedCount.textContent = selectedTabIds.size + ' selected';
    const nonRestrictedCount = tabs.filter(t => !t.restricted).length;
    selectAllCheckbox.checked = selectedTabIds.size === nonRestrictedCount && nonRestrictedCount > 0;
    selectAllCheckbox.indeterminate = selectedTabIds.size > 0 && selectedTabIds.size < nonRestrictedCount;
  }

  // Select all checkbox handler
  selectAllCheckbox.addEventListener('change', () => {
    const allSelected = selectAllCheckbox.checked;
    selectedTabIds.clear();
    tabs.forEach(tab => {
      if (!tab.restricted) {
        if (allSelected) selectedTabIds.add(tab.id);
      }
    });
    if (!allSelected) selectedTabIds.clear();
    renderTabs(tabFilter.value);
  });

  // Tab filter handler
  tabFilter.addEventListener('input', () => {
    renderTabs(tabFilter.value);
  });

  // Extract button handler
  btnExtract.addEventListener('click', async () => {
    if (selectedTabIds.size === 0) return;

    switchView('view-progress');
    totalTabs = selectedTabIds.size;
    completedTabs = 0;
    updateProgressBar();

    // Render initial progress items
    progressList.innerHTML = '';
    Array.from(selectedTabIds).forEach(tabId => {
      const tab = tabs.find(t => t.id === tabId);
      const item = document.createElement('div');
      item.className = 'progress-item';
      item.dataset.tabId = tabId;
      item.innerHTML = `
        <span class="spinner"></span>
        <span class="tab-title">${escapeHtml(tab?.title || 'Untitled')}</span>
      `;
      progressList.appendChild(item);
    });

    // Send extraction request
    const response = await browser.runtime.sendMessage({
      type: MSG.START_EXTRACTION,
      tabIds: Array.from(selectedTabIds)
    });

    // Handle final result
    if (response && response.results && response.bundle) {
      showResults(response.results, response.bundle);
    }
  });

  // Port message handler for progress updates only
  port.onMessage.addListener((msg) => {
    if (msg.type === MSG.EXTRACTION_PROGRESS && msg.tabId) {
      updateProgressItem(msg.tabId, msg.status, msg.result);
      if (msg.status === TAB_STATUS.DONE || msg.status === TAB_STATUS.FAILED) {
        completedTabs++;
        updateProgressBar();
      }
    }
  });

  // Update individual progress item
  function updateProgressItem(tabId, status, result) {
    const item = progressList.querySelector(`[data-tab-id="${tabId}"]`);
    if (!item) return;

    const iconHtml = {
      [TAB_STATUS.EXTRACTING]: '<span class="spinner"></span>',
      [TAB_STATUS.DONE]: '<span style="color:#4ade80">&#10003;</span>',
      [TAB_STATUS.FAILED]: '<span style="color:#ef4444">&#10007;</span>'
    }[status] || '';

    const tab = tabs.find(t => t.id === tabId);
    item.innerHTML = `
      ${iconHtml}
      <span class="tab-title">${escapeHtml(tab?.title || 'Untitled')}</span>
    `;
  }

  // Update progress bar
  function updateProgressBar() {
    const pct = Math.round((completedTabs / totalTabs) * 100);
    progressBar.style.width = pct + '%';
    progressText.textContent = completedTabs + ' / ' + totalTabs;
  }

  // Show results
  function showResults(results, bundle) {
    extractionResults = results;
    extractionBundle = bundle;

    setTimeout(() => {
      switchView('view-results');

      const successCount = results.filter(r => r.status === 'done').length;
      const failCount = results.length - successCount;
      const totalTokens = TokenEstimator.estimateTokens(extractionBundle);

      resultsSuccess.textContent = successCount + ' succeeded';
      resultsFailed.textContent = failCount + ' failed';
      resultsTokens.textContent = '~' + TokenEstimator.formatTokenCount(totalTokens);

      // Phase 2: check ZeroClaw bridge availability
      checkBridge();
    }, 200);
  }

  // Copy button handler
  btnCopy.addEventListener('click', () => {
    navigator.clipboard.writeText(extractionBundle).then(() => {
      copyFeedback.classList.remove('hidden');
      setTimeout(() => copyFeedback.classList.add('hidden'), 2000);
    });
  });

  // Download button handler
  btnDownload.addEventListener('click', () => {
    const blob = new Blob([extractionBundle], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'context-swarm-' + new Date().toISOString().slice(0,10) + '.md';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Back button handler
  btnBack.addEventListener('click', () => {
    selectedTabIds.clear();
    extractionBundle = '';
    extractionResults = [];
    totalTabs = 0;
    completedTabs = 0;
    tabFilter.value = '';
    switchView('view-tabs');
    loadTabs();
  });

  // Switch view
  function switchView(viewId) {
    document.querySelectorAll('.view').forEach(el => {
      el.classList.remove('active');
    });
    document.getElementById(viewId).classList.add('active');
  }

  // Escape HTML helper
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Phase 2: ZeroClaw integration
  const zeroclawSection = document.getElementById('zeroclaw-section');
  const bridgeStatus = document.getElementById('bridge-status');
  const btnStoreZeroclaw = document.getElementById('btn-store-zeroclaw');
  const zcCategory = document.getElementById('zc-category');
  const zcKeyPrefix = document.getElementById('zc-key-prefix');
  const zeroclawFeedback = document.getElementById('zeroclaw-feedback');

  // Check bridge availability on load
  async function checkBridge() {
    const response = await browser.runtime.sendMessage({ type: MSG.PING_BRIDGE });
    if (response && response.available) {
      zeroclawSection.classList.remove('hidden');
      bridgeStatus.textContent = 'connected (v' + response.version + ')';
      bridgeStatus.className = 'bridge-status connected';
    } else {
      zeroclawSection.classList.remove('hidden');
      bridgeStatus.textContent = 'not connected';
      bridgeStatus.className = 'bridge-status disconnected';
      btnStoreZeroclaw.disabled = true;
    }
  }

  if (btnStoreZeroclaw) {
    btnStoreZeroclaw.addEventListener('click', async () => {
      // Request nativeMessaging permission in user-gesture context (MV3 requirement)
      const hasPermission = await browser.permissions.contains({
        permissions: ['nativeMessaging']
      });
      if (!hasPermission) {
        const granted = await browser.permissions.request({
          permissions: ['nativeMessaging']
        });
        if (!granted) {
          zeroclawFeedback.textContent = 'nativeMessaging permission denied';
          zeroclawFeedback.style.color = '#ef4444';
          zeroclawFeedback.classList.remove('hidden');
          setTimeout(() => zeroclawFeedback.classList.add('hidden'), 4000);
          return;
        }
      }

      btnStoreZeroclaw.disabled = true;
      btnStoreZeroclaw.textContent = 'Storing...';
      zeroclawFeedback.classList.add('hidden');

      const response = await browser.runtime.sendMessage({
        type: MSG.STORE_ZEROCLAW,
        results: extractionResults,
        category: zcCategory.value || 'web',
        keyPrefix: zcKeyPrefix.value || 'context-swarm'
      });

      btnStoreZeroclaw.disabled = false;
      btnStoreZeroclaw.textContent = 'Store in ZeroClaw';

      if (response && response.status === 'success') {
        zeroclawFeedback.textContent = 'Stored ' + response.chunks_stored + ' chunks in ZeroClaw';
        zeroclawFeedback.style.color = '#4ade80';
      } else {
        zeroclawFeedback.textContent = 'Error: ' + (response?.error || 'Unknown error');
        zeroclawFeedback.style.color = '#ef4444';
      }
      zeroclawFeedback.classList.remove('hidden');
      setTimeout(() => zeroclawFeedback.classList.add('hidden'), 4000);
    });
  }

});