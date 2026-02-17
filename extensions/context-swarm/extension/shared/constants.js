var ContextSwarmConstants = {
  MSG: {
    GET_TABS: 'GET_TABS',
    START_EXTRACTION: 'START_EXTRACTION',
    EXTRACTION_PROGRESS: 'EXTRACTION_PROGRESS',
    STORE_ZEROCLAW: 'STORE_ZEROCLAW',
    PING_BRIDGE: 'PING_BRIDGE'
  },

  RESTRICTED_URL_PATTERNS: [
    /^about:/,
    /^chrome:/,
    /^moz-extension:/,
    /^resource:/,
    /^view-source:/,
    /^data:/,
    /^javascript:/,
    /^file:/
  ],

  isRestrictedUrl: function(url) {
    return ContextSwarmConstants.RESTRICTED_URL_PATTERNS.some(pattern => pattern.test(url));
  },

  TAB_STATUS: {
    EXTRACTING: 'extracting',
    DONE: 'done',
    FAILED: 'failed'
  },

  EXTRACTION_TIMEOUT_MS: 15000
};

if (typeof module !== 'undefined') {
  module.exports = ContextSwarmConstants;
}