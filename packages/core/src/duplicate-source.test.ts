import { describe, expect, it } from 'vitest';
import { EditorController } from './controller.js';
import { webProfile } from './profiles.js';

describe('subtree duplication', () => {
  it('allocates unused IDs and remaps only references inside the copy with exact undo', async () => {
    const html = '<a href="#title">Outside</a><p id="title-copy">Existing</p><section id="card"><h2 id="title">Title &amp; details</h2><p aria-labelledby="title external"><a href="#title">Inside</a><a href="https://example.com/#title">External</a></p><!-- intact --></section>';
    const controller = await EditorController.create({ html, profile: webProfile });
    const nodeKey = controller.getSnapshot().nodes.find((node) => node.tagName === 'section')!.key;
    expect(await controller.dispatch({ type: 'duplicateNode', nodeKey })).toMatchObject({ ok: true });
    const result = controller.getSnapshot().html;
    expect(result.startsWith(html)).toBe(true);
    expect(result.slice(html.length)).toBe('<section id="card-copy"><h2 id="title-copy-2">Title &amp; details</h2><p aria-labelledby="title-copy-2 external"><a href="#title-copy-2">Inside</a><a href="https://example.com/#title">External</a></p><!-- intact --></section>');
    await controller.undo();
    expect(controller.getSnapshot().html).toBe(html);
    await controller.redo();
    expect(controller.getSnapshot().html).toBe(result);
    expect(await controller.dispatch({ type: 'duplicateNode', nodeKey })).toMatchObject({ ok: true });
    const ids = controller.getSnapshot().nodes.map((node) => node.attributes.get('id')?.value).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leaves ID-free HTML byte-for-byte intact', async () => {
    const html = '<p class=copy>Keep&nbsp;this <!-- comment --></p>';
    const controller = await EditorController.create({ html, profile: webProfile });
    const nodeKey = controller.getSnapshot().nodes.find((node) => node.tagName === 'p')!.key;
    await controller.dispatch({ type: 'duplicateNode', nodeKey });
    expect(controller.getSnapshot().html).toBe(html + html);
  });
});
