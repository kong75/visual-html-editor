import { describe, expect, it } from 'vitest';
import { EditorController } from './controller';
import { emailProfile, webProfile } from './profiles';

describe('complete document policy validation', () => {
  it.each(['refresh', 'ReFrEsH', ' refresh '])('blocks meta refresh in source and visual commands: %j', async (httpEquiv) => {
    const html = `<meta http-equiv="${httpEquiv}" content="0;url=https://example.com"><p>Text</p>`;
    const controller = await EditorController.create({ html, profile: webProfile });
    expect((await controller.export()).issues).toContainEqual(expect.objectContaining({ code: 'meta-refresh-not-allowed', severity: 'blocking' }));
    expect((await controller.export()).html).toBe(html);
    await controller.replaceSource('<meta name="viewport" content="width=device-width"><p>Text</p>');
    const before = controller.getSnapshot();
    const nodeKey = before.nodes.find((node) => node.tagName === 'meta')!.key;
    expect(await controller.dispatch({ type: 'setAttribute', nodeKey, name: 'http-equiv', value: httpEquiv }))
      .toMatchObject({ ok: false, code: 'policy-denied' });
    expect(controller.getSnapshot().html).toBe(before.html);
  });

  it.each([
    'p { position: absolute }',
    '@media (min-width: 1px) { p { position: absolute } }',
    '@supports (display: grid) { p { position: absolute } }',
    '@keyframes move { from { position: absolute } }',
    String.raw`p { p\6fsition: absolute }`
  ])('checks declaration policy inside stylesheet blocks: %s', async (css) => {
    const html = `<style>\r\n${css}\r\n</style><p>Text</p>`;
    const controller = await EditorController.create({ html, profile: emailProfile });
    const issue = (await controller.export()).issues.find((candidate) => candidate.code === 'css-property-not-allowed');
    expect(issue).toMatchObject({ severity: 'blocking', message: expect.stringContaining('position') });
    expect(html.slice(issue!.range!.start, issue!.range!.end)).toContain('absolute');
  });

  it.each([
    'p { background: url(ftp://example.com/a.png) }',
    '@import "ftp://example.com/a.css";',
    '@import "ftp://example.com/a.css"layer(theme);',
    '@import /* comment */ "ftp://example.com/a.css" screen;',
    '@import url("ftp://example.com/a.css") layer(theme);',
    String.raw`@\69mport 'ftp://example.com/a.css';`,
    String.raw`@im\70ort '\66tp://example.com/a.css';`,
    String.raw`p { background: u\72l(ftp://example.com/a.png) }`,
    'p { width: expression(alert(1)) }'
  ])('blocks disallowed stylesheet URLs and executable constructs: %s', async (css) => {
    const controller = await EditorController.create({ html: `<style>${css}</style>`, profile: webProfile });
    expect((await controller.export()).issues).toContainEqual(expect.objectContaining({ code: 'css-value-not-allowed', severity: 'blocking' }));
  });

  it.each(['p { color: red', 'p { color: "unclosed }'])('blocks stylesheets that cannot be validated: %s', async (css) => {
    const controller = await EditorController.create({ html: `<style>${css}</style>`, profile: webProfile });
    expect((await controller.export()).issues).toContainEqual(expect.objectContaining({ code: 'invalid-stylesheet', severity: 'blocking' }));
  });

  it('validates style content even when the closing HTML tag was omitted', async () => {
    const controller = await EditorController.create({ html: '<style>p { position: absolute }', profile: emailProfile });
    expect((await controller.export()).issues).toContainEqual(expect.objectContaining({ code: 'css-property-not-allowed', severity: 'blocking' }));
  });

  it('keeps safe responsive styles and safe stylesheet imports byte-for-byte', async () => {
    const html = '<style>@import "https://example.com/a.css"; @media (max-width: 600px) { p { color: blue; background: url(./image.png) } }</style><p>Text</p>';
    const controller = await EditorController.create({ html, profile: webProfile });
    expect((await controller.export()).issues).toEqual([]);
    expect((await controller.export()).html).toBe(html);
  });

  it('rejects adding forbidden stylesheet content through a rich-text command', async () => {
    const html = '<main><p>Safe</p></main>';
    const controller = await EditorController.create({ html, profile: emailProfile });
    expect(await controller.dispatch({
      type: 'setRichText', nodeKey: controller.getSnapshot().nodes[0].key,
      html: '<style>p { position: absolute }</style><p>Safe</p>'
    })).toMatchObject({ ok: false, code: 'policy-denied' });
    expect(controller.getSnapshot()).toMatchObject({ html, revision: 0, canUndo: false });
  });
});
