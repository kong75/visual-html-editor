import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  EditorController,
  emailProfile,
  slidesProfile,
  webProfile,
  type EditorProfile,
  type ParsedNode
} from '../../packages/core/src/index.js';
import { compatibilityFixtures, type CompatibilityProfile } from '../fixtures/compatibility/manifest.js';

const profiles: Readonly<Record<CompatibilityProfile, EditorProfile>> = {
  email: emailProfile,
  slides: slidesProfile,
  web: webProfile
};

async function loadFixture(path: string): Promise<string> {
  return readFile(new URL(`../fixtures/compatibility/${path}`, import.meta.url), 'utf8');
}

function nodeById(controller: EditorController, id: string): ParsedNode {
  const node = controller.getSnapshot().nodes.find((candidate) => candidate.attributes.get('id')?.value === id);
  if (!node) throw new Error(`Fixture is missing #${id}`);
  return node;
}

describe.each(compatibilityFixtures)('compatibility fixture: $id', (fixture) => {
  it('round-trips byte-for-byte without edits', async () => {
    const source = await loadFixture(fixture.path);
    const controller = await EditorController.create({ html: source, profile: profiles[fixture.profile] });

    expect((await controller.export()).html).toBe(source);
    expect(controller.getSnapshot().projection.html).toContain('data-vhe-node=');
    expect(controller.getSnapshot().html).not.toContain('data-vhe-node=');
    expect(controller.getSnapshot().issues.filter((issue) => issue.severity === 'blocking')).toEqual([]);
    for (const token of fixture.expectedTokens) expect(source).toContain(token);
  });

  it('changes only the intended leaf-text source range and undoes exactly', async () => {
    const source = await loadFixture(fixture.path);
    const controller = await EditorController.create({ html: source, profile: profiles[fixture.profile] });
    const node = nodeById(controller, fixture.textEdit.elementId);
    if (!node.innerRange) throw new Error(`Fixture target #${fixture.textEdit.elementId} has no source range`);
    const expected = source.slice(0, node.innerRange.start) + fixture.textEdit.replacement + source.slice(node.innerRange.end);

    const result = await controller.dispatch({
      type: 'setText',
      nodeKey: node.key,
      text: fixture.textEdit.replacement
    });

    expect(result.ok).toBe(true);
    expect((await controller.export()).html).toBe(expected);
    expect((await controller.undo()).ok).toBe(true);
    expect((await controller.export()).html).toBe(source);
    expect((await controller.redo()).ok).toBe(true);
    expect((await controller.export()).html).toBe(expected);
  });

  it('formats mixed text without changing its rendered wording or template tokens', async () => {
    if (!fixture.richText) return;
    const source = await loadFixture(fixture.path);
    const controller = await EditorController.create({ html: source, profile: profiles[fixture.profile] });
    const node = nodeById(controller, fixture.richText.elementId);
    const start = node.textContent.indexOf(fixture.richText.selectedText);
    expect(start).toBeGreaterThanOrEqual(0);

    const result = await controller.dispatch({
      type: 'toggleInlineMark',
      nodeKey: node.key,
      range: { start, end: start + fixture.richText.selectedText.length },
      mark: 'strong'
    });

    expect(result.ok).toBe(true);
    const edited = (await controller.export()).html;
    expect(edited).not.toBe(source);
    expect(nodeById(controller, fixture.richText.elementId).textContent).toBe(node.textContent);
    for (const token of fixture.expectedTokens) expect(edited).toContain(token);
    expect((await controller.undo()).ok).toBe(true);
    expect((await controller.export()).html).toBe(source);
  });
});
