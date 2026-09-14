# Headless core usage

`@visual-html/core` can power a custom editor, CMS workflow, validation service, or non-React UI.

## Controller lifecycle

```ts
const controller = await EditorController.create({ html, profile });
const unsubscribe = controller.subscribe(() => {
  const snapshot = controller.getSnapshot();
  renderPreview(snapshot.projection.html);
  renderIssues(snapshot.issues);
});
```

An `EditorSnapshot` contains source HTML, the parsed node index, validation issues, a runtime projection, history state, and dirty state.

## Commands

All durable edits are commands against a revision:

```ts
const snapshot = controller.getSnapshot();
const result = await controller.dispatch(
  { type: 'setStyle', nodeKey, property: 'font-size', value: '32px' },
  snapshot.revision
);
```

Stale revisions fail rather than patching an unrelated source range.

Use `replaceImage` for visual image replacement:

```ts
await controller.dispatch({ type: 'replaceImage', nodeKey: image.key, src: 'replacement.png', alt: 'Replacement description' });
```

This command changes `src`, optionally changes `alt`, and removes `srcset` and `sizes` from the image and its enclosing picture's source candidates. The browser then displays the replacement instead of retaining an old responsive candidate. The operation respects `replaceImages` and URL policy and is undone as one transaction. Use `src: null` to clear the source. The generic `setAttribute` command remains available when a host intentionally wants to change only one responsive-image attribute.

## Export and publishing

`controller.export()` returns the current HTML and its validation issues, including when blocking issues exist. Your host must decide whether that content can be published. The default React workspace blocks its export action; headless callers need the equivalent check:

```ts
const result = await controller.export();
const blocking = result.issues.filter((issue) => issue.severity === 'blocking');

if (blocking.length > 0) {
  throw new Error(`Resolve ${blocking.length} policy issues before publishing.`);
}

await publishHtml(result.html); // Your application's publishing function.
controller.createCheckpoint(); // Only after persistence succeeds.
```

Import and export preserve source rather than sanitize it. Your application also owns any additional validation needed by its delivery or publishing system. See the [security model](./security.md).

## Rendering your own canvas

Use `snapshot.projection.html` for a disposable preview. It contains `data-vhe-node` markers that map runtime elements to source nodes. Never persist or export the projection. Export only through `controller.export()`.

Table-row, cell, section, and column fragments receive preview-only table context so their source nodes survive browser document parsing. These wrappers are not included in canonical HTML or export.

The current public core exposes the model and projection, but not a complete framework-neutral pointer/selection bridge. Custom visual canvases must implement that ephemeral interaction layer. A reusable runtime bridge is planned before `1.0`.
