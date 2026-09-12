import { describe, expect, it } from 'vitest';
import { EditorController, emailProfile, webProfile } from '../../packages/core/src/index.js';
import { cssValueAllowed, urlValueAllowed } from '../../packages/core/src/security.js';

const hostileDocuments = [
  {
    name: 'script element',
    html: '<main><script>alert(1)</script><p>Safe text</p></main>',
    issue: 'html-tag-not-allowed'
  },
  {
    name: 'event handler',
    html: '<img src="https://example.com/image.png" alt="Demo" onerror="alert(1)">',
    issue: 'html-attribute-not-allowed'
  },
  {
    name: 'javascript URL',
    html: '<a href="javascript:alert(1)">Unsafe link</a>',
    issue: 'url-protocol-not-allowed'
  },
  {
    name: 'executable CSS URL',
    html: '<div style="background-image: url(javascript:alert(1))">Unsafe style</div>',
    issue: 'css-value-not-allowed'
  },
  {
    name: 'escaped executable CSS URL',
    html: '<div style="background-image: url(j\\61vascript:alert(1))">Unsafe style</div>',
    issue: 'css-value-not-allowed'
  },
  {
    name: 'legacy CSS expression',
    html: '<div style="width: expression(alert(1))">Unsafe style</div>',
    issue: 'css-value-not-allowed'
  }
] as const;

describe('security policy matrix', () => {
  it.each([
    '', '#section', '/root', './asset.png', '../asset.png',
    '{{ image_url }}', '[[ image_url ]]', '<%= image_url %>',
    'https://example.com/a.png', 'mailto:team@example.com', 'tel:+15551234567',
    'data:image/png;base64,AAAA', 'blob:https://example.com/id'
  ])('allows the configured or host-relative URL form %j', (value) => {
    expect(urlValueAllowed(value, webProfile)).toBe(true);
  });

  it.each(['ftp://example.com/file', 'javascript:alert(1)', 'vbscript:run', 'http://['])('rejects URL form %j', (value) => {
    expect(urlValueAllowed(value, webProfile)).toBe(false);
  });

  it.each([
    'javascript:alert(1)//{{', 'javascript:alert(1)//{{ token }}',
    'java\nscript:alert(1)//[[ token ]]', 'vbscript:run\'<%= token %>',
    'ftp://example.com/{{ file }}'
  ])('never exempts an explicit disallowed protocol because it contains a template: %j', async (value) => {
    expect(urlValueAllowed(value, webProfile)).toBe(false);
    const controller = await EditorController.create({ html: '<a>Link</a>', profile: webProfile });
    const link = controller.getSnapshot().nodes[0];
    expect(await controller.dispatch({ type: 'setAttribute', nodeKey: link.key, name: 'href', value }))
      .toMatchObject({ ok: false, code: 'policy-denied' });
    expect(controller.getSnapshot().html).toBe('<a>Link</a>');
    await controller.replaceSource(`<a href="${value}">Link</a>`);
    expect((await controller.export()).issues).toContainEqual(expect.objectContaining({
      code: 'url-protocol-not-allowed', severity: 'blocking'
    }));
  });

  it.each(['https://example.com/{{ image }}', '/images/[[ name ]].png', '{{ image_url }}'])
    ('preserves safe templated URLs: %j', (value) => {
      expect(urlValueAllowed(value, webProfile)).toBe(true);
    });

  it.each([
    'red',
    'linear-gradient(red, blue)',
    'url(https://example.com/a.png)',
    'url(  "https://example.com/a.png"  )',
    'url(./a.png), url(../b.png)'
  ])('allows safe CSS value %j', (value) => {
    expect(cssValueAllowed(value, webProfile)).toBe(true);
  });

  it.each([
    'width: expression(alert(1))',
    'url(java/**/script:alert(1))',
    'url("vbscript:run")',
    '-moz-binding: url(https://example.com/xbl.xml)',
    'behavior: url(test.htc)',
    'url(ftp://example.com/a.png)',
    'url('
  ])('rejects unsafe or malformed CSS value %j', (value) => {
    expect(cssValueAllowed(value, webProfile)).toBe(false);
  });

  it.each(hostileDocuments)('reports $name as a blocking issue', async ({ html, issue }) => {
    const controller = await EditorController.create({ html, profile: webProfile });
    expect(controller.getSnapshot().issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: issue, severity: 'blocking' })
    ]));
    expect((await controller.export()).html).toBe(html);
  });

  it('rejects dangerous URL and CSS values through commands before source changes', async () => {
    const source = '<main><a id="link" href="https://example.com">Safe</a><div id="box">Box</div></main>';
    const controller = await EditorController.create({ html: source, profile: webProfile });
    const link = controller.getSnapshot().nodes.find((node) => node.attributes.get('id')?.value === 'link')!;
    const box = controller.getSnapshot().nodes.find((node) => node.attributes.get('id')?.value === 'box')!;

    expect(await controller.dispatch({
      type: 'setAttribute', nodeKey: link.key, name: 'href', value: 'javascript:alert(1)'
    })).toEqual(expect.objectContaining({ ok: false, code: 'policy-denied' }));
    expect(await controller.dispatch({
      type: 'setStyle', nodeKey: box.key, property: 'background-image', value: 'url(javascript:alert(1))'
    })).toEqual(expect.objectContaining({ ok: false, code: 'policy-denied' }));
    expect(await controller.dispatch({
      type: 'insertImage', targetNodeKey: box.key, src: 'javascript:alert(1)', alt: 'Unsafe'
    })).toEqual(expect.objectContaining({ ok: false, code: 'policy-denied' }));
    expect((await controller.export()).html).toBe(source);
  });

  it('allows host template URLs and configured data-image URLs', async () => {
    const source = '<main><a id="link" href="{{cta_url}}">Template link</a><div id="box">Box</div></main>';
    const controller = await EditorController.create({ html: source, profile: emailProfile });
    const box = controller.getSnapshot().nodes.find((node) => node.attributes.get('id')?.value === 'box')!;

    expect(controller.getSnapshot().issues.filter((issue) => issue.severity === 'blocking')).toEqual([]);
    expect((await controller.dispatch({
      type: 'insertImage', targetNodeKey: box.key, src: 'data:image/png;base64,AAAA', alt: 'Safe'
    })).ok).toBe(true);
  });
});
