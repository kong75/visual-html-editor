import { describe, expect, it } from 'vitest';
import { hardenRuntimeHtml, RUNTIME_CONTENT_SECURITY_POLICY } from './runtime-security';

describe('runtime preview hardening', () => {
  it('removes executable elements while preserving safe visual markup', () => {
    const hardened = hardenRuntimeHtml(`<!doctype html><html><head>
      <script src="evil.js"></script><base href="https://evil.example/"><meta http-equiv="refresh" content="0;url=https://evil.example/">
      <meta name="theme-color" content="#fff"><meta><style>body { color: red; }</style>
    </head><body><h1 id="safe" title="Kept" style="color: red">Safe</h1><a href="https://example.com">Link</a><iframe src="https://evil.example"></iframe><object data="x"></object><embed src="x"></body></html>`);

    expect(hardened).toContain('>Safe</h1>');
    expect(hardened).toContain('<style>body { color: red; }</style>');
    expect(hardened).toContain('<meta name="theme-color" content="#fff">');
    expect(hardened).toContain('<h1 id="safe" title="Kept" style="color: red">Safe</h1>');
    expect(hardened).toContain('<a href="https://example.com">Link</a>');
    expect(hardened).not.toMatch(/<(?:script|base|iframe|object|embed)\b/i);
    expect(hardened).not.toMatch(/http-equiv="refresh"/i);
  });

  it('adds an explicit preview base without retaining a source base element', () => {
    const hardened = hardenRuntimeHtml(
      '<!doctype html><html><head><base href="https://untrusted.example/"></head><body><img src="images/cover.png"></body></html>',
      { baseUrl: 'https://cdn.example.test/course/' }
    );

    expect(hardened).toContain('<base href="https://cdn.example.test/course/">');
    expect(hardened).not.toContain('https://untrusted.example/');
    expect(hardened).toContain('base-uri https://cdn.example.test');
    expect(hardened).toContain('<img src="images/cover.png">');
  });

  it('rejects preview base URLs that could execute or access local files', () => {
    expect(() => hardenRuntimeHtml('<p>Preview</p>', { baseUrl: 'javascript:alert(1)' })).toThrow(/http: or https:/);
    expect(() => hardenRuntimeHtml('<p>Preview</p>', { baseUrl: 'file:///tmp/' })).toThrow(/http: or https:/);
  });

  it('removes event handlers, srcdoc, executable URLs, and executable inline CSS', () => {
    const hardened = hardenRuntimeHtml(`<main onclick="alert(1)" style="background:url(javascript:alert(1))">
      <a id="bad" href=" java\nscript:alert(1)">Bad</a>
      <a id="data-navigation" href="data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;">Data</a>
      <form action="vbscript:run"><button formaction="javascript:run">Go</button></form>
      <svg><a xlink:href="data:text/html,unsafe">SVG data</a></svg>
      <img src="data:image/png;base64,AA" onerror="alert(1)" srcdoc="bad">
    </main>`);

    expect(hardened).not.toMatch(/\s(?:onclick|onerror|srcdoc|style)=/i);
    expect(hardened).not.toMatch(/(?:href|action|formaction|xlink:href)="/i);
    expect(hardened).toContain('src="data:image/png;base64,AA"');
  });

  it.each([
    'width: expression(alert(1))',
    'background: url(vbscript:run)',
    '-moz-binding: url(https://example.com/xbl.xml)',
    'behavior: url(test.htc)',
    'background: java/**/script:alert(1)'
  ])('removes executable runtime style %j', (style) => {
    const hardened = hardenRuntimeHtml(`<p id="target" style="${style}">Text</p>`);
    expect(hardened).toContain('<p id="target">Text</p>');
  });

  it('injects the restrictive CSP into documents and fragments', () => {
    expect(RUNTIME_CONTENT_SECURITY_POLICY).toBe("script-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'");
    for (const source of ['<p>Fragment</p>', '<!doctype html><html><head data-theme="test"><title>Page</title></head><body>Page</body></html>']) {
      const hardened = hardenRuntimeHtml(source);
      expect(hardened).toContain(`http-equiv="Content-Security-Policy"`);
      expect(hardened).toContain(`content="${RUNTIME_CONTENT_SECURITY_POLICY}"`);
      expect(hardened.indexOf('Content-Security-Policy')).toBeLessThan(hardened.indexOf('</head>'));
      if (source.includes('data-theme')) expect(hardened).toContain('<head data-theme="test"><meta');
    }
  });
});
