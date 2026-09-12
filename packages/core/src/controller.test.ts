import { describe, expect, it } from 'vitest';
import { EditorController } from './controller';
import { defineEditorProfile, emailProfile, extendEditorProfile, slidesProfile, webProfile } from './profiles';

const documentHtml = `<!doctype html>
<html>
  <head><style>.card { color: navy; }</style></head>
  <body>
    <main class="card">
      <h1 id="title">Original title</h1>
      <p>Original paragraph</p>
    </main>
  </body>
</html>`;

async function create(profile = webProfile) {
  return EditorController.create({ html: documentHtml, profile });
}

function nodeByTag(controller: EditorController, tagName: string) {
  const node = controller.getSnapshot().nodes.find((candidate) => candidate.tagName === tagName && !candidate.virtual);
  if (!node) throw new Error(`Missing <${tagName}> node`);
  return node;
}

describe('EditorController', () => {
  it('recognizes saved content after undo and permits a clean external update', async () => {
    const controller = await EditorController.create({ html: '<p>A</p>', profile: webProfile });
    const dirtyEvents: boolean[] = [];
    controller.on('dirtyChanged', ({ dirty }) => dirtyEvents.push(dirty));
    await controller.dispatch({ type: 'setText', nodeKey: nodeByTag(controller, 'p').key, text: 'B' });
    await controller.undo();
    expect(controller.getSnapshot()).toMatchObject({ html: '<p>A</p>', revision: 2, dirty: false });
    expect(dirtyEvents).toEqual([true, false]);
    expect(await controller.replaceSource('<p>External</p>', { policy: 'replace-when-clean' }))
      .toMatchObject({ ok: true, replaced: true });
  });

  it('compares content with the checkpoint across redo, branching history, and recorded replacements', async () => {
    const controller = await EditorController.create({ html: '<p>A</p>', profile: webProfile });
    await controller.replaceSource('<p>B</p>', { recordHistory: true, createCheckpoint: true });
    await controller.undo();
    expect(controller.getSnapshot().dirty).toBe(true);
    await controller.redo();
    expect(controller.getSnapshot().dirty).toBe(false);
    await controller.undo();
    await controller.dispatch({ type: 'setText', nodeKey: nodeByTag(controller, 'p').key, text: 'B' });
    expect(controller.getSnapshot()).toMatchObject({ dirty: false, canRedo: false });
    await controller.replaceSource('<p>C</p>', { createCheckpoint: false });
    expect(controller.getSnapshot().dirty).toBe(true);
    controller.createCheckpoint();
    expect(controller.getSnapshot().dirty).toBe(false);
  });

  it('creates defensive custom profiles from a preset', () => {
    const controlled = extendEditorProfile(emailProfile, {
      id: 'controlled-email',
      label: 'Controlled email',
      capabilities: { editSource: false, importHtml: false, deleteElements: false },
      html: { allowedTags: [...emailProfile.html.allowedTags, 'custom-block', 'CUSTOM-BLOCK'] },
      aspectRatios: [{ id: 'newsletter', label: 'Newsletter', width: 640, height: 900 }],
      defaultAspectRatioId: 'newsletter'
    });
    expect(controlled.capabilities.editSource).toBe(false);
    expect(controlled.capabilities.importHtml).toBe(false);
    expect(controlled.capabilities.deleteElements).toBe(false);
    expect(controlled.html.allowedTags.filter((tag) => tag === 'custom-block')).toHaveLength(1);
    expect(controlled.aspectRatios).toEqual([{ id: 'newsletter', label: 'Newsletter', width: 640, height: 900 }]);
    expect(emailProfile.capabilities.editSource).toBe(true);
    expect(emailProfile.capabilities.importHtml).toBe(true);
    expect(emailProfile.aspectRatios[0].id).toBe('email-desktop');
    expect(emailProfile.aspectRatios).toEqual([
      { id: 'email-desktop', label: 'Desktop', width: 800, height: 900 },
      { id: 'email-mobile', label: 'Mobile', width: 390, height: 844 }
    ]);
  });

  it('rejects invalid custom profile viewports early', () => {
    expect(() => defineEditorProfile({
      ...webProfile,
      id: 'invalid',
      defaultAspectRatioId: 'missing'
    })).toThrow(/does not exist/i);
  });

  it('exports an untouched document byte-for-byte', async () => {
    const controller = await create();
    expect((await controller.export()).html).toBe(documentHtml);
  });

  it('patches leaf text without rewriting surrounding source', async () => {
    const controller = await create();
    const heading = nodeByTag(controller, 'h1');
    const result = await controller.dispatch({ type: 'setText', nodeKey: heading.key, text: 'Updated & safe' });

    expect(result.ok).toBe(true);
    const html = (await controller.export()).html;
    expect(html).toContain('<h1 id="title">Updated &amp; safe</h1>');
    expect(html).toContain('<style>.card { color: navy; }</style>');
  });

  it('keeps a node key stable after editing its text', async () => {
    const controller = await create();
    const heading = nodeByTag(controller, 'h1');
    await controller.dispatch({ type: 'setText', nodeKey: heading.key, text: 'Updated' });
    expect(nodeByTag(controller, 'h1').key).toBe(heading.key);
  });

  it('retires deleted subtree keys without changing surviving sibling identities', async () => {
    const html = '<div><p>A</p></div><div><p>B</p></div>';
    const controller = await EditorController.create({ html, profile: webProfile });
    const [removedParent, removedChild, survivingParent, survivingChild] = controller.getSnapshot().nodes;

    expect((await controller.dispatch({ type: 'removeNode', nodeKey: removedParent.key })).ok).toBe(true);
    expect(controller.getNode(removedParent.key)).toBeUndefined();
    expect(controller.getNode(removedChild.key)).toBeUndefined();
    expect(controller.getNode(survivingParent.key)?.textContent).toBe('B');
    expect(controller.getNode(survivingChild.key)?.textContent).toBe('B');
    expect(await controller.dispatch({ type: 'setText', nodeKey: removedChild.key, text: 'Wrong target' }))
      .toMatchObject({ ok: false, code: 'node-not-found' });

    await controller.undo();
    expect(controller.getSnapshot().html).toBe(html);
    expect(controller.getNode(survivingChild.key)?.textContent).toBe('B');
    await controller.redo();
    expect(controller.getNode(survivingChild.key)?.textContent).toBe('B');
  });

  it('does not reuse a replaced element identity just because its tag and offset match', async () => {
    const controller = await EditorController.create({ html: '<p>A</p><p>B</p>', profile: webProfile });
    const [first, second] = controller.getSnapshot().nodes;
    await controller.dispatch({ type: 'removeNode', nodeKey: first.key });
    expect(controller.getSnapshot().nodes.map((node) => node.key)).toEqual([second.key]);
    await controller.dispatch({ type: 'applySource', source: '<p>Unrelated document</p>' });
    expect(controller.getNode(first.key)).toBeUndefined();
    expect(controller.getNode(second.key)).toBeUndefined();
  });

  it('toggles source-preserving inline marks across mixed HTML', async () => {
    const controller = await EditorController.create({
      html: '<p>Hello <em>beautiful</em> world &amp; friends.</p>',
      profile: webProfile
    });
    const paragraph = nodeByTag(controller, 'p');
    const result = await controller.dispatch({
      type: 'toggleInlineMark',
      nodeKey: paragraph.key,
      range: { start: 6, end: 21 },
      mark: 'strong'
    });

    expect(result.ok).toBe(true);
    expect((await controller.export()).html).toBe(
      '<p>Hello <em><strong>beautiful</strong></em><strong> world</strong> &amp; friends.</p>'
    );
    expect(nodeByTag(controller, 'p').key).toBe(paragraph.key);

    expect((await controller.undo()).ok).toBe(true);
    expect((await controller.export()).html).toBe('<p>Hello <em>beautiful</em> world &amp; friends.</p>');
    expect((await controller.redo()).ok).toBe(true);
    expect((await controller.export()).html).toContain('<strong>beautiful</strong>');
  });

  it('edits mixed rich text as one source-backed undoable patch', async () => {
    const controller = await EditorController.create({
      html: '<section data-layout="keep"><p id="mixed">Hello <em class=\'accent\'>beautiful</em> world &amp; friends.</p></section>',
      profile: webProfile
    });
    const paragraph = nodeByTag(controller, 'p');
    const result = await controller.dispatch({
      type: 'setRichText',
      nodeKey: paragraph.key,
      html: 'Hello <em class="accent">wonderful</em> world &amp; teammates.'
    });

    expect(result.ok).toBe(true);
    expect((await controller.export()).html).toBe(
      '<section data-layout="keep"><p id="mixed">Hello <em class=\'accent\'>wonderful</em> world &amp; teammates.</p></section>'
    );
    expect(nodeByTag(controller, 'p').key).toBe(paragraph.key);
    expect((await controller.undo()).ok).toBe(true);
    expect((await controller.export()).html).toContain("Hello <em class='accent'>beautiful</em> world &amp; friends.");
    expect((await controller.redo()).ok).toBe(true);
    expect((await controller.export()).html).toContain("Hello <em class='accent'>wonderful</em> world &amp; teammates.");
  });

  it('rejects rich-text edits that introduce policy violations', async () => {
    const controller = await EditorController.create({ html: '<p>Hello <em>world</em></p>', profile: webProfile });
    const paragraph = nodeByTag(controller, 'p');
    const result = await controller.dispatch({
      type: 'setRichText',
      nodeKey: paragraph.key,
      html: 'Hello <script>alert(1)</script><em>world</em>'
    });

    expect(result).toEqual(expect.objectContaining({ ok: false, code: 'policy-denied' }));
    expect((await controller.export()).html).toBe('<p>Hello <em>world</em></p>');
  });

  it('enforces tag policy when applying inline marks', async () => {
    const noStrong = extendEditorProfile(webProfile, {
      id: 'no-strong',
      html: { allowedTags: webProfile.html.allowedTags.filter((tag) => tag !== 'strong') }
    });
    const controller = await EditorController.create({ html: '<p>Hello world</p>', profile: noStrong });
    const paragraph = nodeByTag(controller, 'p');
    const result = await controller.dispatch({
      type: 'toggleInlineMark',
      nodeKey: paragraph.key,
      range: { start: 6, end: 11 },
      mark: 'strong'
    });

    expect(result).toEqual(expect.objectContaining({ ok: false, code: 'policy-denied' }));
    expect((await controller.export()).html).toBe('<p>Hello world</p>');
  });

  it('adds attributes and inline styles through minimal patches', async () => {
    const controller = await create(slidesProfile);
    const paragraph = nodeByTag(controller, 'p');
    await controller.dispatch({ type: 'setAttribute', nodeKey: paragraph.key, name: 'title', value: 'Tip' });
    await controller.dispatch({ type: 'setStyle', nodeKey: paragraph.key, property: 'font-size', value: '24px' });

    const html = (await controller.export()).html;
    expect(html).toContain('<p title="Tip" style="font-size: 24px">Original paragraph</p>');
  });

  it('enforces profile CSS restrictions', async () => {
    const controller = await create(emailProfile);
    const paragraph = nodeByTag(controller, 'p');
    const result = await controller.dispatch({
      type: 'setStyle',
      nodeKey: paragraph.key,
      property: 'position',
      value: 'absolute'
    });
    expect(result).toEqual(expect.objectContaining({ ok: false, code: 'policy-denied' }));
  });

  it('applies multiple style changes in one transaction', async () => {
    const controller = await create(slidesProfile);
    const paragraph = nodeByTag(controller, 'p');
    const result = await controller.dispatch({
      type: 'setStyles',
      nodeKey: paragraph.key,
      styles: { position: 'relative', left: '12px', top: '8px', width: '320px' }
    });
    expect(result.ok).toBe(true);
    expect((await controller.export()).html).toContain(
      'style="position: relative; left: 12px; top: 8px; width: 320px"'
    );
  });

  it('updates complex inline styles with a browser-safe parser', async () => {
    const html = '<p style="background-image: url(&quot;data:image/svg+xml;utf8,%3Csvg%3E&quot;); color: red !important; color: blue">Text</p>';
    const controller = await EditorController.create({ html, profile: slidesProfile });
    const paragraph = nodeByTag(controller, 'p');
    const result = await controller.dispatch({
      type: 'setStyle',
      nodeKey: paragraph.key,
      property: 'color',
      value: 'green'
    });
    expect(result.ok).toBe(true);
    expect((await controller.export()).html).toContain(
      'style="background-image: url(&quot;data:image/svg+xml;utf8,%3Csvg%3E&quot;); color: green !important"'
    );
  });

  it('supports undo and redo using inverse source patches', async () => {
    const controller = await create();
    const heading = nodeByTag(controller, 'h1');
    await controller.dispatch({ type: 'setText', nodeKey: heading.key, text: 'Changed' });
    expect((await controller.export()).html).toContain('>Changed</h1>');

    expect((await controller.undo()).ok).toBe(true);
    expect((await controller.export()).html).toBe(documentHtml);

    expect((await controller.redo()).ok).toBe(true);
    expect((await controller.export()).html).toContain('>Changed</h1>');
  });

  it('returns explicit failures when history is empty', async () => {
    const controller = await create();
    expect(await controller.undo()).toMatchObject({ ok: false, code: 'nothing-to-undo' });
    expect(await controller.redo()).toMatchObject({ ok: false, code: 'nothing-to-redo' });
  });

  it('rejects stale commands', async () => {
    const controller = await create();
    const heading = nodeByTag(controller, 'h1');
    await controller.dispatch({ type: 'setText', nodeKey: heading.key, text: 'First' });
    const result = await controller.dispatch(
      { type: 'setText', nodeKey: heading.key, text: 'Stale' },
      0
    );
    expect(result).toEqual(expect.objectContaining({ ok: false, code: 'revision-conflict' }));
  });

  it('instruments only the runtime projection', async () => {
    const controller = await create();
    const snapshot = controller.getSnapshot();
    expect(snapshot.projection.html).toContain('data-vhe-node=');
    expect(snapshot.html).not.toContain('data-vhe-node=');
  });

  it('reports blocked source constructs without silently deleting them', async () => {
    const html = '<div>Hello</div><script>alert(1)</script>';
    const controller = await EditorController.create({ html, profile: webProfile });
    const snapshot = controller.getSnapshot();
    expect(snapshot.html).toBe(html);
    expect(snapshot.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'html-tag-not-allowed', severity: 'blocking' })])
    );
  });

  it('inserts images after the selected element', async () => {
    const controller = await create();
    const paragraph = nodeByTag(controller, 'p');
    const result = await controller.dispatch({
      type: 'insertImage',
      targetNodeKey: paragraph.key,
      src: 'data:image/png;base64,AAAA',
      alt: 'Demo'
    });
    expect(result.ok).toBe(true);
    expect((await controller.export()).html).toContain('</p><img src="data:image/png;base64,AAAA" alt="Demo"');
  });

  it('emits typed transaction, revision, dirty, and validation events', async () => {
    const controller = await create();
    const events: string[] = [];
    const revisions: number[] = [];
    const dirtyStates: boolean[] = [];
    const validationCounts: number[] = [];
    const unsubscribers = [
      controller.on('transactionCommitted', (event) => events.push(`${event.kind}:${event.description}`)),
      controller.on('revisionChanged', (event) => revisions.push(event.revision)),
      controller.on('dirtyChanged', (event) => dirtyStates.push(event.dirty)),
      controller.on('validationChanged', (event) => validationCounts.push(event.issues.length))
    ];

    const heading = nodeByTag(controller, 'h1');
    await controller.dispatch({ type: 'setText', nodeKey: heading.key, text: 'Eventful' });
    await controller.dispatch({
      type: 'applySource',
      source: '<!doctype html><html><body><script>alert(1)</script><h1>Blocked</h1></body></html>'
    });
    controller.createCheckpoint();
    unsubscribers.forEach((unsubscribe) => unsubscribe());

    expect(events).toEqual(['command:Edit <h1> text', 'command:Edit HTML source']);
    expect(revisions).toEqual([1, 2]);
    expect(dirtyStates).toEqual([true, false]);
    expect(validationCounts).toEqual([1]);
  });

  it('emits structured rejection events for denied commands', async () => {
    const controller = await create(emailProfile);
    const rejected: string[] = [];
    controller.on('transactionRejected', (event) => rejected.push(event.result.code));
    const paragraph = nodeByTag(controller, 'p');

    const result = await controller.dispatch({
      type: 'setStyle',
      nodeKey: paragraph.key,
      property: 'position',
      value: 'absolute'
    });

    expect(result).toEqual(expect.objectContaining({ ok: false, code: 'policy-denied' }));
    expect(rejected).toEqual(['policy-denied']);
  });

  it('applies external source replacement policies without losing dirty work', async () => {
    const controller = await create();
    const cleanReplacement = '<!doctype html><html><body><h1>External clean value</h1></body></html>';
    const cleanResult = await controller.replaceSource(cleanReplacement, { policy: 'replace-when-clean' });
    expect(cleanResult).toEqual(expect.objectContaining({ ok: true, replaced: true }));
    expect(controller.getSnapshot().dirty).toBe(false);

    const heading = nodeByTag(controller, 'h1');
    await controller.dispatch({ type: 'setText', nodeKey: heading.key, text: 'Unsaved local value' });
    const ignored = await controller.replaceSource('<p>Ignored external value</p>', { policy: 'replace-when-clean' });
    expect(ignored).toEqual(expect.objectContaining({ ok: true, replaced: false, reason: 'dirty' }));
    expect(controller.getSnapshot().html).toContain('Unsaved local value');

    const rejected = await controller.replaceSource('<p>Rejected external value</p>', { policy: 'reject-when-dirty' });
    expect(rejected).toEqual(expect.objectContaining({ ok: false, code: 'dirty-source-replacement' }));
    expect(controller.getSnapshot().html).toContain('Unsaved local value');

    const forced = await controller.replaceSource('<p>Forced external value</p>', { policy: 'replace' });
    expect(forced).toEqual(expect.objectContaining({ ok: true, replaced: true }));
    expect(controller.getSnapshot().html).toBe('<p>Forced external value</p>');
    expect(controller.getSnapshot().canUndo).toBe(false);
  });

  it('recognizes unchanged external source and can replace without creating a checkpoint', async () => {
    const controller = await create();
    const unchanged = await controller.replaceSource(documentHtml);
    expect(unchanged).toMatchObject({ ok: true, replaced: false, reason: 'unchanged', revision: 0 });

    const replaced = await controller.replaceSource('<p>External</p>', { createCheckpoint: false });
    expect(replaced).toMatchObject({ ok: true, replaced: true, revision: 1 });
    expect(controller.getSnapshot().dirty).toBe(true);
  });

  it('can record an imported source replacement as one undoable transaction', async () => {
    const controller = await create();
    const imported = '<!doctype html><html><body><h1>Imported document</h1></body></html>';
    const result = await controller.replaceSource(imported, {
      recordHistory: true,
      createCheckpoint: false,
      description: 'Import report.html'
    });

    expect(result).toMatchObject({ ok: true, replaced: true, description: 'Import report.html' });
    expect(controller.getSnapshot()).toMatchObject({ html: imported, canUndo: true, dirty: true });
    expect(await controller.undo()).toMatchObject({ ok: true, description: 'Undo: Import report.html' });
    expect(controller.getSnapshot().html).toBe(documentHtml);
    expect(await controller.redo()).toMatchObject({ ok: true, description: 'Redo: Import report.html' });
    expect(controller.getSnapshot().html).toBe(imported);
  });

  it('keeps the current document atomic when parsing a command result fails', async () => {
    const controller = await create();
    const before = controller.getSnapshot();
    const fatal: Error[] = [];
    controller.on('fatalError', (event) => fatal.push(event.error));
    const internal = controller as unknown as { parseWorkspace: () => never };
    internal.parseWorkspace = () => { throw new Error('Parser unavailable'); };

    const heading = nodeByTag(controller, 'h1');
    const result = await controller.dispatch({ type: 'setText', nodeKey: heading.key, text: 'Should not commit' });

    expect(result).toMatchObject({ ok: false, code: 'transaction-failed', message: 'Parser unavailable' });
    expect(controller.getSnapshot().html).toBe(before.html);
    expect(controller.getSnapshot().revision).toBe(before.revision);
    expect(fatal.map((error) => error.message)).toEqual(['Parser unavailable']);
  });

  it('keeps the current document and history when external source parsing fails', async () => {
    const controller = await create();
    const heading = nodeByTag(controller, 'h1');
    await controller.dispatch({ type: 'setText', nodeKey: heading.key, text: 'Local change' });
    const before = controller.getSnapshot();
    const rejected: string[] = [];
    controller.on('transactionRejected', (event) => rejected.push(event.result.code));
    const internal = controller as unknown as { parseWorkspace: () => never };
    internal.parseWorkspace = () => { throw new Error('Replacement parse failed'); };

    const result = await controller.replaceSource('<p>Broken replacement</p>');

    expect(result).toMatchObject({ ok: false, code: 'source-replacement-failed' });
    expect(controller.getSnapshot().html).toBe(before.html);
    expect(controller.getSnapshot().canUndo).toBe(true);
    expect(rejected).toEqual(['source-replacement-failed']);
  });

  it('emits profile changes and validation changes without creating a revision', async () => {
    const html = '<main style="position: absolute">Profile-sensitive content</main>';
    const controller = await EditorController.create({ html, profile: slidesProfile });
    const profiles: string[] = [];
    const validationCounts: number[] = [];
    controller.on('profileChanged', (event) => profiles.push(`${event.previousProfile.id}->${event.profile.id}`));
    controller.on('validationChanged', (event) => validationCounts.push(event.issues.length));

    controller.setProfile(emailProfile);

    expect(profiles).toEqual(['slides->email']);
    expect(validationCounts).toEqual([1]);
    expect(controller.getSnapshot().revision).toBe(0);
  });

  it('does not emit for repeated profile and checkpoint no-ops', async () => {
    const controller = await create();
    let emissions = 0;
    const unsubscribe = controller.subscribe(() => { emissions += 1; });
    controller.setProfile(webProfile);
    controller.createCheckpoint();
    unsubscribe();
    controller.setProfile(slidesProfile);
    expect(emissions).toBe(0);
  });
});
