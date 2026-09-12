import { describe, expect, it } from 'vitest';
import { exportClaudeDesignDeck, importClaudeDesignDeck, isClaudeDesignDeck } from './claude-design';

const claudeDeck = `<!doctype html>
<html>
<head>
  <title>Strategy deck</title>
  <style>deck-stage > section { background: white; }</style>
</head>
<body class="presentation">
  <deck-stage data-width="1920" data-height="1080" class="deck">
    <section id="opening" data-screen-label="01"><h1>Opening idea</h1></section>
    <section id="evidence" data-screen-label="02"><h2>Evidence</h2></section>
  </deck-stage>
  <script type="application/json" id="speaker-notes">["Welcome", {"notes":"Explain the chart"}]</script>
</body>
</html>`;

describe('Claude Design adapter', () => {
  it('exports current shared stylesheets and preserves newly added head assets', () => {
    const { deck } = importClaudeDesignDeck(claudeDeck);
    for (const slide of deck.slides) {
      slide.html = slide.html.replace('background: white', 'background: blue')
        .replace('</head>', '<link rel="stylesheet" href="https://example.com/current.css"></head>');
    }
    const exported = exportClaudeDesignDeck(deck);
    expect(exported).toContain('background: blue');
    expect(exported).not.toContain('background: white');
    expect(exported.match(/current\.css/g)).toHaveLength(1);
    expect(exported).not.toContain('data-visual-html-deck-preview');
  });

  it('does not resurrect deleted styles from import metadata', () => {
    const { deck } = importClaudeDesignDeck(claudeDeck);
    for (const slide of deck.slides) slide.html = slide.html.replace('<style>deck-stage > section { background: white; }</style>', '');
    expect(exportClaudeDesignDeck(deck)).not.toContain('background: white');
  });

  it('rejects conflicting per-slide head styles instead of silently dropping edits or leaking their cascade', () => {
    const { deck } = importClaudeDesignDeck(claudeDeck);
    deck.slides[0].html = deck.slides[0].html.replace('background: white', 'background: blue');
    const before = JSON.stringify(deck);
    expect(() => exportClaudeDesignDeck(deck)).toThrow(/different head stylesheets/);
    expect(JSON.stringify(deck)).toBe(before);
  });

  it('retains a standalone slide document stylesheet in the exported head', () => {
    const exported = exportClaudeDesignDeck({
      schema: 'visual-html-deck', version: 1, id: 'one', width: 1024, height: 768,
      slides: [{ id: 'one', html: '<style>p{color:blue}</style><p>Blue</p>' }]
    });
    expect(exported).toContain('<style>p{color:blue}</style>');
  });

  it('treats deck titles as text instead of export markup', () => {
    const title = '</title><script id="injected">alert(1)</script> & Design';
    const exported = exportClaudeDesignDeck({
      schema: 'visual-html-deck', version: 1, id: 'safe-title', title,
      width: 1024, height: 768, slides: [{ id: 'one', html: '<h1>Slide</h1>' }]
    });
    expect(exported).toContain('<title>&lt;/title&gt;&lt;script id="injected"&gt;alert(1)&lt;/script&gt; &amp; Design</title>');
    expect(exported).not.toContain('<script id="injected">');
    expect(importClaudeDesignDeck(exported).deck.title).toBe(title);
  });

  it('detects and imports direct-child deck-stage slides', () => {
    expect(isClaudeDesignDeck(claudeDeck)).toBe(true);
    const imported = importClaudeDesignDeck(claudeDeck);
    expect(imported.deck.title).toBe('Strategy deck');
    expect(imported.deck.width).toBe(1920);
    expect(imported.deck.height).toBe(1080);
    expect(imported.deck.slides.map((slide) => slide.id)).toEqual(['opening', 'evidence']);
    expect(imported.deck.slides[0]).toMatchObject({ title: 'Opening idea', label: '01', notes: 'Welcome' });
    expect(imported.deck.slides[1].notes).toBe('Explain the chart');
    expect(imported.deck.slides[0].html).toContain('<deck-stage');
    expect(imported.deck.slides[0].html).toContain('data-deck-active');
  });

  it('exports a navigable Claude-compatible deck structure', () => {
    const imported = importClaudeDesignDeck(claudeDeck);
    const exported = exportClaudeDesignDeck(imported.deck);
    expect(exported).toContain('<deck-stage');
    expect(exported.match(/<section/g)).toHaveLength(2);
    expect(exported).toContain('id="speaker-notes"');
    expect(exported).toContain('Welcome');
    expect(exported).toContain('data-screen-label="01"');
    expect(exported.match(/data-width=/g)).toHaveLength(1);
    expect(exported.match(/data-height=/g)).toHaveLength(1);
  });

  it('rejects ordinary single-page HTML', () => {
    expect(isClaudeDesignDeck('<html><body><section>Page</section></body></html>')).toBe(false);
    expect(() => importClaudeDesignDeck('<html><body>Page</body></html>')).toThrow(/deck-stage/i);
  });

  it('rejects a deck-stage without direct-child sections', () => {
    expect(isClaudeDesignDeck('<deck-stage><div><section>Nested</section></div></deck-stage>')).toBe(false);
    expect(() => importClaudeDesignDeck('<deck-stage><div><section>Nested</section></div></deck-stage>')).toThrow(/direct-child slides/i);
  });

  it('reads style dimensions, object notes, fallback labels, ids, and titles', () => {
    const imported = importClaudeDesignDeck(`<!doctype html><html><head><title>  </title></head><body data-theme="dark">
      <deck-stage style="--deck-width: 1440; --deck-height: 810" aria-label="Deck">
        <section id="named"><p>No heading</p></section>
        <section data-screen-label="B"><h3>  Second   idea </h3></section>
      </deck-stage>
      <script id="speaker-notes" type="application/json">{"named":"By id","B":"By label"}</script>
    </body></html>`);
    expect(imported.deck).toMatchObject({ id: 'claude-design-deck', title: 'Claude Design deck', width: 1440, height: 810 });
    expect(imported.deck.slides[0]).toMatchObject({ id: 'named', label: '1', title: 'Slide 1', notes: 'By id' });
    expect(imported.deck.slides[1]).toMatchObject({ id: 'slide-2', label: 'B', title: 'Second idea', notes: 'By label' });
    expect(imported.deck.slides[0].html).toContain('data-theme="dark"');
    expect(imported.deck.slides[0].html).toContain('aria-label="Deck"');
  });

  it('uses fallback dimensions and safely ignores malformed or unsupported notes', () => {
    for (const notes of ['not json', '42', '[null,{"text":"Text note"}]']) {
      const imported = importClaudeDesignDeck(`<deck-stage width="bad" height="bad"><section>A</section><section>B</section></deck-stage><script id="speaker-notes" type="application/json">${notes}</script>`);
      expect(imported.deck.width).toBe(1920);
      expect(imported.deck.height).toBe(1080);
      if (notes.includes('Text note')) expect(imported.deck.slides[1].notes).toBe('Text note');
      else expect(imported.deck.slides.every((slide) => slide.notes === undefined)).toBe(true);
    }
  });

  it('preserves external runtime HTML for export but excludes scripts from previews', () => {
    const imported = importClaudeDesignDeck(`<!doctype html><html><head><style>.x{color:red}</style><script>headRuntime()</script></head><body class="deck">
      <aside>Persistent chrome</aside><deck-stage><section><h1>One</h1></section></deck-stage><script>bodyRuntime()</script>
    </body></html>`);
    expect(imported.warnings).toHaveLength(1);
    expect(imported.deck.slides[0].html).toContain('.x{color:red}');
    expect(imported.deck.slides[0].html).not.toContain('headRuntime');
    const exported = exportClaudeDesignDeck(imported.deck);
    expect(exported).toContain('<aside>Persistent chrome</aside>');
    expect(exported).toContain('bodyRuntime()');
    expect(exported).toContain('headRuntime()');
  });

  it('exports ordinary slide documents and fragments with default runtime and escaped notes', () => {
    const source = {
      schema: 'visual-html-deck' as const,
      version: 1 as const,
      id: 'plain',
      title: 'Plain',
      width: 1024,
      height: 768,
      slides: [
        { id: 'page', label: 'A&1', html: '<!doctype html><html><body class="page"><h1>Page</h1></body></html>', notes: '</script>\u2028next' },
        { id: 'fragment', html: '<h2>Fragment</h2>' }
      ]
    };
    const exported = exportClaudeDesignDeck(source);
    expect(exported.match(/<section/g)).toHaveLength(2);
    expect(exported).toMatch(/<section[^>]*><h1>Page<\/h1><\/section>/);
    expect(exported).toMatch(/<section[^>]*><h2>Fragment<\/h2><\/section>/);
    expect(exported).toContain('data-screen-label="A&amp;1"');
    expect(exported).toContain('data-visual-html-deck-runtime');
    expect(exported).toContain('\\u003c/script>');
    expect(exported).toContain('\\u2028next');
  });
});
