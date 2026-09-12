import { describe, expect, it } from 'vitest';
import { EditorController } from './controller';
import { extendEditorProfile, webProfile } from './profiles';

describe('responsive image replacement', () => {
  it.each([
    '<img src="old.png" alt="Old" srcset="old@2x.png 2x" sizes="100vw">',
    '<picture><source media="(min-width:1px)" srcset="large.png"><img src="old.png" alt="Old" srcset="small.png 1x"></picture>',
    '<img>'
  ])('replaces all candidates and alt as one reversible transaction: %s', async (html) => {
    const controller = await EditorController.create({ html, profile: webProfile });
    const image = controller.getSnapshot().nodes.find((node) => node.tagName === 'img')!;
    expect((await controller.dispatch({ type: 'replaceImage', nodeKey: image.key, src: 'new.png', alt: 'New' })).ok).toBe(true);
    const result = controller.getSnapshot().html;
    expect(result).toContain('src="new.png"');
    expect(result).toContain('alt="New"');
    expect(result).not.toContain('srcset=');
    expect(result).not.toContain('sizes=');
    await controller.undo();
    expect(controller.getSnapshot().html).toBe(html);
    await controller.redo();
    expect(controller.getSnapshot().html).toBe(result);
  });

  it('enforces replacement capability and URL policy without partial changes', async () => {
    const html = '<img src="old.png" alt="Old" srcset="old@2x.png 2x">';
    const controller = await EditorController.create({ html, profile: webProfile });
    const nodeKey = controller.getSnapshot().nodes[0].key;
    expect((await controller.dispatch({ type: 'replaceImage', nodeKey, src: 'javascript:alert(1)', alt: 'New' })).ok).toBe(false);
    expect(controller.getSnapshot().html).toBe(html);
    controller.setProfile(extendEditorProfile(webProfile, { capabilities: { replaceImages: false } }));
    expect((await controller.dispatch({ type: 'replaceImage', nodeKey, src: 'new.png' })).ok).toBe(false);
    expect(controller.getSnapshot().html).toBe(html);
  });
});
