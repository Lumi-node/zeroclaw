var MarkdownBundler = {
  bundleMarkdown: function(results) {
    const successfulResults = results.filter(result => result.status === 'done');
    const count = successfulResults.length;
    const timestamp = new Date().toISOString();
    
    // Estimate total tokens
    let totalTokens = 0;
    successfulResults.forEach(result => {
      if (typeof result.tokens === 'number') {
        totalTokens += result.tokens;
      } else {
        totalTokens += TokenEstimator.estimateTokens(result.markdown);
      }
    });

    // Header
    let output = `# ContextSwarm Extraction\n`;
    output += `> Extracted: ${count} pages | ${timestamp} | ~${totalTokens} tokens\n\n`;
    output += `---\n\n`;

    // Process each result
    successfulResults.forEach(result => {
      output += `## ${result.title}\n`;
      output += `- **URL**: ${result.url}\n`;
      
      if (result.siteName) {
        output += `- **Site**: ${result.siteName}\n`;
      }
      
      if (result.byline) {
        output += `- **Author**: ${result.byline}\n`;
      }
      
      output += `- **Extracted**: ${result.extractedAt}\n`;
      
      // Calculate tokens for this result
      let resultTokens;
      if (typeof result.tokens === 'number') {
        resultTokens = result.tokens;
      } else {
        resultTokens = TokenEstimator.estimateTokens(result.markdown);
      }
      output += `- **Tokens**: ~${resultTokens}\n`;
      
      if (result.fallback) {
        output += `- **Note**: Fallback extraction (Readability parse failed)\n`;
      }
      
      output += `\n${result.markdown}\n\n`;
      output += `---\n\n`;
    });

    // Remove the last separator ("---\n\n" = 5 chars)
    if (count > 0) {
      output = output.slice(0, -5);
    }

    return output;
  }
};