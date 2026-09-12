import { expect, it } from 'vitest';
import { EditorController } from './controller';
import { webProfile } from './profiles';

it.each(['strong', 'b'])('removes full or partial formatting from a %s root without duplicating its ID', async (tag) => {
  const html = `<${tag} id='text' class="keep">Bold text</${tag}>`;
  const controller = await EditorController.create({ html, profile: webProfile });
  const nodeKey = controller.getSnapshot().nodes[0].key;
  expect((await controller.dispatch({ type: 'toggleInlineMark', nodeKey, range: { start: 0, end: 4 }, mark: 'strong' })).ok).toBe(true);
  expect(controller.getSnapshot().html).toBe('<span id=\'text\' class="keep">Bold<strong> text</strong></span>');
  await controller.undo();
  expect(controller.getSnapshot().html).toBe(html);
  const current = controller.getSnapshot().nodes[0].key;
  expect((await controller.dispatch({ type: 'toggleInlineMark', nodeKey: current, range: { start: 0, end: 9 }, mark: 'strong' })).ok).toBe(true);
  expect(controller.getSnapshot().html).toBe('<span id=\'text\' class="keep">Bold text</span>');
});
