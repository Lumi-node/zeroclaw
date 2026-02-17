# ContextSwarm

Firefox extension that deploys parallel extraction agents across browser tabs, converting page content to clean markdown via Readability + Turndown. Integrates with ZeroClaw's memory system via a native messaging bridge.

## Requirements
- Firefox 109+
- jq (for native messaging bridge)
- ZeroClaw installed and in PATH (for bridge integration)

## Quick Start
1. Load extension: `about:debugging` > This Firefox > Load Temporary Add-on > select `extensions/context-swarm/extension/manifest.json`
2. Click ContextSwarm icon in toolbar
3. Select tabs, click Extract Selected
4. Copy markdown or download .md file

## ZeroClaw Bridge Setup
1. Run `./scripts/install-bridge.sh` to install the native messaging manifest
2. Ensure `zeroclaw` is in PATH
3. After extraction, click "Store in ZeroClaw" to ingest markdown chunks into memory

## Architecture
- `extension/background/service-worker.js` — orchestrates tab extraction via scripting API
- `extension/content/extractor.js` — injected into each tab, uses Readability + Turndown for HTML-to-markdown
- `extension/popup/` — UI for tab selection, progress tracking, results
- `extension/shared/` — constants, token estimator, markdown bundler
- `bridge/context_swarm_bridge.sh` — native messaging bridge, reads Firefox protocol, pipes to zeroclaw ingest

## Development
- `npm run dev` — launches Firefox with extension auto-reload
- `npm run build` — copies to dist/ and packages XPI
- Test: open `test/test-extractor.html` in browser and extract it

## Permissions
- `tabs`, `scripting`, `activeTab` — enumerate and inject into tabs
- `host_permissions`: `<all_urls>` — required for multi-tab extraction
- `nativeMessaging` (optional) — ZeroClaw bridge integration