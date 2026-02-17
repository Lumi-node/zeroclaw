var TokenEstimator = {
  estimateTokens: function(text) {
    if (!text) {
      return 0;
    }
    return Math.ceil(text.length / 4);
  },

  formatTokenCount: function(count) {
    if (!count) {
      return "0 tokens";
    }
    
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1).replace(/\.0$/, '') + "M tokens";
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + "k tokens";
    } else {
      return count + " tokens";
    }
  }
};