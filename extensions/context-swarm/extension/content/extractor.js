(function() {
  try {
    var docClone = document.cloneNode(true);
    var parsed = null;
    var markdown = '';

    try {
      parsed = new Readability(docClone).parse();
    } catch (e) {
      // Ignore error, fallback below
    }

    var htmlToConvert = parsed ? parsed.content : document.body.innerHTML;

    var turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-'
    });
    turndownService.use(turndownPluginGfm.gfm);

    markdown = turndownService.turndown(htmlToConvert);

    return {
      url: location.href,
      title: parsed ? parsed.title : document.title,
      markdown: markdown,
      siteName: parsed ? parsed.siteName : null,
      byline: parsed ? parsed.byline : null,
      extractedAt: new Date().toISOString(),
      status: 'done',
      fallback: !parsed
    };
  } catch (err) {
    return {
      url: location.href,
      title: document.title,
      markdown: '',
      extractedAt: new Date().toISOString(),
      status: 'failed',
      error: err.message,
      fallback: false
    };
  }
})();