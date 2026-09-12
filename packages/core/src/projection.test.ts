import { describe, expect, it } from 'vitest';
import { parseFragment } from 'parse5';
import { EditorController } from './controller';
import { webProfile } from './profiles';
import { RUNTIME_NODE_ATTRIBUTE } from './projection';

describe('runtime attribute namespaces', () => {
  it.each([
    ['<img src=folder/>', 'img', 'src', 'folder/'],
    ['<p title=folder/>Text</p>', 'p', 'title', 'folder/'],
    ['<img src="folder"/>', 'img', 'src', 'folder'],
    ['<img src=folder />', 'img', 'src', 'folder'],
    ['<img src=first src=folder/>', 'img', 'src', 'first']
  ])('preserves attribute semantics in projection and new attributes: %s', async (html, tag, attribute, value) => {
    const controller = await EditorController.create({ html, profile: webProfile });
    const original = controller.getSnapshot();
    const projected = parseFragment(original.projection.html).childNodes.find((node) => 'tagName' in node && node.tagName === tag);
    expect(projected && 'attrs' in projected ? projected.attrs.find((item) => item.name === attribute)?.value : undefined).toBe(value);
    const nodeKey = original.nodes[0].key;
    expect((await controller.dispatch({ type: 'setAttribute', nodeKey, name: 'class', value: 'edited' })).ok).toBe(true);
    expect(controller.getNode(nodeKey)?.attributes.get(attribute)?.value).toBe(value);
    await controller.undo();
    expect(controller.getSnapshot().html).toBe(html);
  });
  it('uses the default namespace when source does not use it', async () => {
    const controller = await EditorController.create({ html: '<p>Text</p>', profile: webProfile });
    expect(controller.getSnapshot().projection.runtimeAttribute).toBe(RUNTIME_NODE_ATTRIBUTE);
  });

  it('chooses a collision-free namespace without rewriting authored attributes', async () => {
    const html = '<p DATA-VHE-NODE="author" data-vhe-editing="true" data-vhe-1-node="also-author">Text</p>';
    const controller = await EditorController.create({ html, profile: webProfile });
    const snapshot = controller.getSnapshot();
    expect(snapshot.projection.runtimeAttribute).toBe('data-vhe-2-node');
    const tree = parseFragment(snapshot.projection.html);
    const paragraph = tree.childNodes.find((node) => 'tagName' in node && node.tagName === 'p');
    expect(paragraph && 'attrs' in paragraph ? paragraph.attrs : []).toEqual(expect.arrayContaining([
      { name: 'data-vhe-node', value: 'author' },
      { name: 'data-vhe-editing', value: 'true' },
      { name: 'data-vhe-1-node', value: 'also-author' },
      { name: 'data-vhe-2-node', value: snapshot.nodes[0].key }
    ]));
    expect((await controller.export()).html).toBe(html);
  });
});
