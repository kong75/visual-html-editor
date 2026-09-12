import { describe, expect, it } from 'vitest';
import { EditorController } from './controller';
import { parseHtmlSource } from './parser';
import { webProfile } from './profiles';

function parse(source: string) {
  let key = 0;
  return parseHtmlSource(source, { revision: 0, fileId: 'index.html', allocateKey: () => `test-${++key}` });
}

describe('document and fragment parsing', () => {
  it.each([
    ['<ul><li id="edit">One<li>Two</ul>', 'li'],
    ['<table><tr><td id="edit">One<td>Two</table>', 'td'],
    ['<p id="edit">One<p>Two', 'p'],
    ['<p id="edit">One', 'p']
  ])('edits implicitly closed content without touching its sibling: %s', async (html, tag) => {
    const controller = await EditorController.create({ html, profile: webProfile });
    const node = controller.getSnapshot().nodes.find((item) => item.tagName === tag && item.attributes.get('id')?.value === 'edit')!;
    expect(html.slice(node.innerRange!.start, node.innerRange!.end)).toBe('One');
    expect((await controller.dispatch({ type: 'setText', nodeKey: node.key, text: 'Changed' })).ok).toBe(true);
    expect((await controller.export()).html).toBe(html.replace('One', 'Changed'));
    await controller.undo();
    expect((await controller.export()).html).toBe(html);
  });

  it('does not make void or unterminated non-optional elements editable', () => {
    const index = parse('<img src="a"><br><span>Unfinished');
    expect([...index.nodes.values()].every((node) => node.innerRange === undefined)).toBe(true);
  });
  it.each([
    '<body onload="alert(1)"><p>A</p></body>',
    '<p>A</p><body onload="alert(1)">',
    '<html onload="alert(1)"><p>A</p></html>',
    `<!--${'x'.repeat(1500)}--><!doctype html><html><body onload="alert(1)"><p>A</p></body></html>`
  ])('indexes and validates authored wrapper attributes: %s', async (html) => {
    expect(parse(html).isFragment).toBe(false);
    const controller = await EditorController.create({ html, profile: webProfile });
    expect((await controller.export()).issues).toContainEqual(expect.objectContaining({
      code: 'html-attribute-not-allowed', severity: 'blocking', message: 'Attribute “onload” is not allowed.'
    }));
    expect((await controller.export()).html).toBe(html);
  });

  it.each([
    '<head><title>Title</title></head><p>Content</p>',
    '<!doctype html><p>Content</p>',
    '<html><p>Content</p></html>',
    '<body><p>Content</p></body>'
  ])('recognizes explicit document structure without requiring all wrappers: %s', (html) => {
    expect(parse(html).isFragment).toBe(false);
  });

  it.each([
    '<!-- <html> <!doctype html> --><p>Fragment</p>',
    '<p title="<html>">Fragment</p>',
    '<script>const markup = "<html>";</script><p>Fragment</p>',
    '<tr><td>Fragment</td></tr>'
  ])('keeps fragments and ignores document-like text in tokens: %s', (html) => {
    const index = parse(html);
    expect(index.isFragment).toBe(true);
    expect([...index.nodes.values()].some((node) => node.textContent === 'Fragment')).toBe(true);
  });
});
