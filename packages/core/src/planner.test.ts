import { describe, expect, it } from 'vitest';
import { EditorController } from './controller';
import { hashText } from './hash';
import { parseHtmlSource } from './parser';
import { createWorkspace } from './patcher';
import { planCommand } from './planner';
import { emailProfile, extendEditorProfile, slidesProfile, webProfile } from './profiles';
import type { DocumentIndex, EditorCommand, EditorProfile, WorkspaceSnapshot } from './types';

let key = 0;
function indexFor(workspace: WorkspaceSnapshot): DocumentIndex {
  const file = workspace.files.get(workspace.entryFileId)!;
  return parseHtmlSource(file.content, {
    revision: workspace.revision,
    fileId: file.id,
    allocateKey: () => `test-${++key}`
  });
}

function node(index: DocumentIndex, tagName: string) {
  const found = [...index.nodes.values()].find((candidate) => candidate.tagName === tagName && !candidate.virtual);
  if (!found) throw new Error(`Missing <${tagName}>`);
  return found;
}

function disabled(capability: keyof EditorProfile['capabilities']): EditorProfile {
  return extendEditorProfile(slidesProfile, { id: `no-${capability}`, capabilities: { [capability]: false } });
}

function plan(html: string, command: (index: DocumentIndex) => EditorCommand, profile = slidesProfile) {
  const workspace = createWorkspace(html);
  const index = indexFor(workspace);
  return planCommand(command(index), workspace, index, profile);
}

describe('command planning policy and failure paths', () => {
  it.each(['data-x onmouseover', 'aria-x=onclick', 'data-x/><script', 'data-x"', 'data-x\u0000'])
    ('rejects an entire malformed attribute name before changing source: %j', async (name) => {
      const html = '<p>Safe</p>';
      const controller = await EditorController.create({ html, profile: webProfile });
      const nodeKey = controller.getSnapshot().nodes[0].key;
      expect(await controller.dispatch({ type: 'setAttribute', nodeKey, name, value: 'alert(1)' }))
        .toMatchObject({ ok: false, code: 'policy-denied' });
      expect(controller.getSnapshot()).toMatchObject({ html, revision: 0, canUndo: false });
    });

  it('enforces style capabilities and policy through generic attribute commands', async () => {
    const html = '<p style="color: red">Safe</p>';
    const controller = await EditorController.create({ html, profile: disabled('editStyles') });
    const nodeKey = controller.getSnapshot().nodes[0].key;
    for (const value of ['color: blue', null]) {
      expect(await controller.dispatch({ type: 'setAttribute', nodeKey, name: 'STYLE', value }))
        .toMatchObject({ ok: false, code: 'capability-denied' });
    }
    controller.setProfile(emailProfile);
    for (const value of ['position: absolute', 'background: url(javascript:alert(1))', 'color: red }']) {
      expect(await controller.dispatch({ type: 'setAttribute', nodeKey, name: 'style', value }))
        .toMatchObject({ ok: false, code: 'policy-denied' });
    }
    expect(controller.getSnapshot()).toMatchObject({ html, revision: 0, canUndo: false });
  });

  it.each(['setStyle', 'setStyles'] as const)('rejects declaration injection atomically through %s', async (type) => {
    const html = '<p style="padding: 4px">Safe</p>';
    const controller = await EditorController.create({ html, profile: emailProfile });
    const nodeKey = controller.getSnapshot().nodes[0].key;
    const result = await controller.dispatch(type === 'setStyle'
      ? { type, nodeKey, property: 'color', value: 'red;position:absolute' }
      : { type, nodeKey, styles: { padding: '8px', color: 'red;position:absolute' } });
    expect(result).toMatchObject({ ok: false, code: 'invalid-style' });
    expect(controller.getSnapshot()).toMatchObject({ html, revision: 0, canUndo: false });
  });

  it('applies the attribute policy to generated styles and inserted images too', async () => {
    const html = '<p>Safe</p>';
    const profile = extendEditorProfile(webProfile, {
      html: { allowedAttributes: webProfile.html.allowedAttributes.filter((name) => name !== 'style') }
    });
    const controller = await EditorController.create({ html, profile });
    expect(await controller.dispatch({ type: 'setStyle', nodeKey: controller.getSnapshot().nodes[0].key, property: 'color', value: 'red' }))
      .toMatchObject({ ok: false, code: 'policy-denied' });
    expect(await controller.dispatch({ type: 'insertImage', src: 'https://example.com/image.png', alt: 'Image' }))
      .toMatchObject({ ok: false, code: 'policy-denied' });
    expect(controller.getSnapshot()).toMatchObject({ html, revision: 0 });
  });

  it('rejects a workspace without its entry file', () => {
    const workspace = { ...createWorkspace('<p>x</p>'), files: new Map() };
    expect(planCommand({ type: 'applySource', source: '<p>y</p>' }, workspace, { revision: 0, isFragment: true, nodes: new Map(), rootKeys: [] }, webProfile))
      .toMatchObject({ ok: false, code: 'entry-file-missing' });
  });

  it.each([
    ['editSource', { type: 'applySource', source: '<p>changed</p>' }],
    ['insertImages', { type: 'insertImage', src: 'https://example.com/a.png', alt: 'A' }]
  ] as const)('enforces the %s capability', (capability, command) => {
    const profile = disabled(capability);
    expect(plan('<p>x</p>', () => command, profile)).toMatchObject({ ok: false, code: 'capability-denied' });
  });

  it('requires img to be in the allowed tag policy', () => {
    const profile = extendEditorProfile(slidesProfile, {
      id: 'no-img-tag',
      html: { allowedTags: slidesProfile.html.allowedTags.filter((tag) => tag !== 'img') }
    });
    expect(plan('<p>x</p>', () => ({ type: 'insertImage', src: 'https://example.com/a.png', alt: 'A' }), profile))
      .toMatchObject({ ok: false, code: 'capability-denied' });
  });

  it('rejects unsafe image URLs and escapes image attributes', () => {
    expect(plan('<p>x</p>', () => ({ type: 'insertImage', src: 'javascript:alert(1)', alt: '' })))
      .toMatchObject({ ok: false, code: 'policy-denied' });
    const result = plan('<p>x</p>', (index) => ({
      type: 'insertImage',
      targetNodeKey: node(index, 'p').key,
      src: 'https://example.com/a.png?x=1&y=2',
      alt: 'A "quote" & label'
    }));
    expect(result).not.toHaveProperty('ok');
    if (!('ok' in result)) expect(result.patches[0].replacement).toContain('alt="A &quot;quote&quot; &amp; label"');
  });

  it('inserts an image at the body end or fragment end without a target', () => {
    const documentResult = plan('<!doctype html><html><body><p>x</p></body></html>', () => ({ type: 'insertImage', src: 'data:image/png;base64,AA', alt: '' }));
    const fragmentResult = plan('<p>x</p>', () => ({ type: 'insertImage', src: 'data:image/png;base64,AA', alt: '' }));
    expect(documentResult).not.toHaveProperty('ok');
    expect(fragmentResult).not.toHaveProperty('ok');
    if (!('ok' in documentResult) && !('ok' in fragmentResult)) {
      expect(documentResult.patches[0].start).toBeLessThan('<!doctype html><html><body><p>x</p></body></html>'.length);
      expect(fragmentResult.patches[0].start).toBe('<p>x</p>'.length);
    }
  });

  it('rejects missing nodes and nodes whose source file disappeared', () => {
    const workspace = createWorkspace('<p>x</p>');
    const index = indexFor(workspace);
    expect(planCommand({ type: 'setText', nodeKey: 'missing', text: 'y' }, workspace, index, webProfile))
      .toMatchObject({ ok: false, code: 'node-not-found' });
    const missingSource = { ...workspace, files: new Map() };
    expect(planCommand({ type: 'setText', nodeKey: node(index, 'p').key, text: 'y' }, missingSource, index, webProfile))
      .toMatchObject({ ok: false, code: 'entry-file-missing' });
  });

  it('enforces text editing and rejects nested plain-text edits', () => {
    expect(plan('<p>x</p>', (index) => ({ type: 'setText', nodeKey: node(index, 'p').key, text: 'y' }), disabled('editText')))
      .toMatchObject({ ok: false, code: 'capability-denied' });
    expect(plan('<p>Hello <em>world</em></p>', (index) => ({ type: 'setText', nodeKey: node(index, 'p').key, text: 'y' })))
      .toMatchObject({ ok: false, code: 'rich-text-required' });
  });

  it('plans policy-safe rich-text replacements without requiring source editing', () => {
    const safe = plan('<p>Hello <em>world</em></p>', (index) => ({
      type: 'setRichText',
      nodeKey: node(index, 'p').key,
      html: 'Hello <em>everyone</em>'
    }));
    expect(safe).not.toHaveProperty('ok');
    if (!('ok' in safe)) expect(safe.patches).toEqual([
      expect.objectContaining({ replacement: 'everyone' })
    ]);

    expect(plan('<p>Hello <em>world</em></p>', (index) => ({
      type: 'setRichText',
      nodeKey: node(index, 'p').key,
      html: 'Hello <em>everyone</em>'
    }), disabled('editText'))).toMatchObject({ ok: false, code: 'capability-denied' });

    expect(plan('<p>Hello <em>world</em></p>', (index) => ({
      type: 'setRichText',
      nodeKey: node(index, 'p').key,
      html: '<script>alert(1)</script>Hello'
    }))).toMatchObject({ ok: false, code: 'policy-denied' });
  });

  it('escapes edited text and rejects invalid rich-text ranges', () => {
    const text = plan('<p>x</p>', (index) => ({ type: 'setText', nodeKey: node(index, 'p').key, text: '<safe & sound>' }));
    expect(text).not.toHaveProperty('ok');
    if (!('ok' in text)) expect(text.patches[0].replacement).toBe('&lt;safe &amp; sound&gt;');
    expect(plan('<p>Hello</p>', (index) => ({ type: 'toggleInlineMark', nodeKey: node(index, 'p').key, range: { start: 99, end: 100 }, mark: 'strong' })))
      .toMatchObject({ ok: false, code: 'invalid-text-range' });
  });

  it('enforces capabilities and policy for selected-text styles', () => {
    const command = (index: DocumentIndex) => ({
      type: 'setInlineStyles' as const,
      nodeKey: node(index, 'p').key,
      range: { start: 0, end: 1 },
      styles: { color: '#7c3aed' }
    });
    expect(plan('<p>x</p>', command, disabled('editStyles')))
      .toMatchObject({ ok: false, code: 'capability-denied' });
    const noSpan = extendEditorProfile(webProfile, {
      id: 'no-span', html: { allowedTags: webProfile.html.allowedTags.filter((tag) => tag !== 'span') }
    });
    expect(plan('<p>x</p>', command, noSpan)).toMatchObject({ ok: false, code: 'policy-denied' });
    expect(plan('<p>x</p>', (index) => ({
      type: 'setInlineStyles', nodeKey: node(index, 'p').key, range: { start: 0, end: 1 },
      styles: { color: 'url(javascript:alert(1))' }
    }))).toMatchObject({ ok: false, code: 'policy-denied' });
  });

  it.each(['onclick', 'unknown'])('rejects disallowed %s attributes', (name) => {
    expect(plan('<p>x</p>', (index) => ({ type: 'setAttribute', nodeKey: node(index, 'p').key, name, value: 'x' })))
      .toMatchObject({ ok: false, code: 'policy-denied' });
  });

  it('honors data/aria attribute switches and blocks executable links', () => {
    const strict = extendEditorProfile(webProfile, { id: 'strict-attributes', html: { allowDataAttributes: false, allowAriaAttributes: false } });
    for (const name of ['data-test', 'aria-label']) {
      expect(plan('<p>x</p>', (index) => ({ type: 'setAttribute', nodeKey: node(index, 'p').key, name, value: 'x' }), strict))
        .toMatchObject({ ok: false, code: 'policy-denied' });
    }
    expect(plan('<a href="https://example.com">x</a>', (index) => ({ type: 'setAttribute', nodeKey: node(index, 'a').key, name: 'href', value: 'javascript:alert(1)' })))
      .toMatchObject({ ok: false, code: 'policy-denied' });
  });

  it('adds, replaces, removes, and reports missing attributes', () => {
    const add = plan('<p>x</p>', (index) => ({ type: 'setAttribute', nodeKey: node(index, 'p').key, name: 'title', value: 'new' }));
    const replace = plan('<p title="old">x</p>', (index) => ({ type: 'setAttribute', nodeKey: node(index, 'p').key, name: 'title', value: 'new' }));
    const remove = plan('<p title="old">x</p>', (index) => ({ type: 'setAttribute', nodeKey: node(index, 'p').key, name: 'title', value: null }));
    const missing = plan('<p>x</p>', (index) => ({ type: 'setAttribute', nodeKey: node(index, 'p').key, name: 'title', value: null }));
    expect([add, replace, remove].every((result) => !('ok' in result))).toBe(true);
    expect(missing).toMatchObject({ ok: false, code: 'attribute-missing' });
  });

  it('inserts attributes before a self-closing tag terminator', () => {
    const result = plan('<img/>', (index) => ({ type: 'setAttribute', nodeKey: node(index, 'img').key, name: 'title', value: 'x' }));
    expect(result).not.toHaveProperty('ok');
    if (!('ok' in result)) expect(result.patches[0].replacement).toBe(' title="x"');
  });

  it.each(['setStyle', 'setStyles'] as const)('enforces style editing for %s', (type) => {
    const result = plan('<p>x</p>', (index) => type === 'setStyle'
      ? { type, nodeKey: node(index, 'p').key, property: 'color', value: 'red' }
      : { type, nodeKey: node(index, 'p').key, styles: { color: 'red' } }, disabled('editStyles'));
    expect(result).toMatchObject({ ok: false, code: 'capability-denied' });
  });

  it('rejects disallowed properties, executable CSS, and malformed existing styles', () => {
    expect(plan('<p>x</p>', (index) => ({ type: 'setStyle', nodeKey: node(index, 'p').key, property: 'behavior', value: 'url(x)' })))
      .toMatchObject({ ok: false, code: 'policy-denied' });
    expect(plan('<p>x</p>', (index) => ({ type: 'setStyle', nodeKey: node(index, 'p').key, property: 'background-image', value: 'url(javascript:alert(1))' })))
      .toMatchObject({ ok: false, code: 'policy-denied' });
    expect(plan('<p style="color: red }">x</p>', (index) => ({ type: 'setStyle', nodeKey: node(index, 'p').key, property: 'color', value: 'blue' })))
      .toMatchObject({ ok: false, code: 'invalid-style' });
  });

  it('validates every property in an atomic multi-style command', () => {
    expect(plan('<p>x</p>', (index) => ({ type: 'setStyles', nodeKey: node(index, 'p').key, styles: { color: 'red', behavior: 'url(x)' } })))
      .toMatchObject({ ok: false, code: 'policy-denied' });
    expect(plan('<p>x</p>', (index) => ({ type: 'setStyles', nodeKey: node(index, 'p').key, styles: { color: 'red', 'background-image': 'url(javascript:alert(1))' } })))
      .toMatchObject({ ok: false, code: 'policy-denied' });
    expect(plan('<p style="color: red }">x</p>', (index) => ({ type: 'setStyles', nodeKey: node(index, 'p').key, styles: { color: 'blue' } })))
      .toMatchObject({ ok: false, code: 'invalid-style' });
  });

  it('removes the style attribute when the final declaration is cleared', async () => {
    const controller = await EditorController.create({ html: '<p style="color: red">x</p>', profile: slidesProfile });
    const paragraph = controller.getSnapshot().nodes.find((candidate) => candidate.tagName === 'p')!;
    expect((await controller.dispatch({ type: 'setStyle', nodeKey: paragraph.key, property: 'color', value: null })).ok).toBe(true);
    expect(controller.getSnapshot().html).toBe('<p >x</p>');
  });

  it.each(['deleteElements', 'duplicateElements'] as const)('enforces %s and protects structural nodes', (capability) => {
    const type = capability === 'deleteElements' ? 'removeNode' : 'duplicateNode';
    expect(plan('<p>x</p>', (index) => ({ type, nodeKey: node(index, 'p').key } as EditorCommand), disabled(capability)))
      .toMatchObject({ ok: false, code: 'capability-denied' });
    expect(plan('<!doctype html><html><body><p>x</p></body></html>', (index) => ({ type, nodeKey: node(index, 'body').key } as EditorCommand)))
      .toMatchObject({ ok: false, code: 'node-not-editable' });
  });
});
