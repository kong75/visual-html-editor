# React integration lifecycle

`HtmlEditor` owns one `EditorController` for the mounted document. The host supplies the canonical value, receives committed transactions, and decides when and where to persist them.

## Load and become ready

Pass the initial HTML and a profile. The loading fallback remains visible until parsing finishes. `onReady` exposes the controller for advanced commands and checkpoints.

```tsx
<HtmlEditor
  value={html}
  profile={webProfile}
  loadingFallback={<p>Opening document…</p>}
  onReady={(controller) => controller.createCheckpoint()}
/>
```

## Receive transactions

`onChange` runs once for each committed local command, undo, redo, or recorded import. Its `transaction` includes the command description and exact source patches. The callback may return a promise; callbacks run in revision order.

```tsx
onChange={async ({ html, revision, transaction }) => {
  setHtml(html);
  await drafts.put(documentId, { html, revision, patches: transaction.patches });
}}
```

Programmatic `value` replacement is not echoed back through `onChange`. Use `onExternalUpdateResult` to observe whether it was applied.

## Save with `flush()`

Keep a ref when save, navigation, or close must form a reliable boundary. `flush()` commits active inline typing, waits for all earlier asynchronous `onChange` callbacks, and returns the latest canonical HTML and validation issues.

```tsx
const editorRef = useRef<HtmlEditorHandle>(null);

async function saveAndClose() {
  const result = await editorRef.current!.flush();
  const blocking = result.issues.filter((issue) => issue.severity === 'blocking');
  if (blocking.length) throw new Error('Resolve blocking validation issues before publishing.');
  await documents.save(documentId, result.html);
  closeEditor();
}

<HtmlEditor ref={editorRef} value={html} profile={webProfile} onChange={({ html }) => setHtml(html)} />
```

Source mode keeps an explicit Apply/Cancel decision. `flush()` rejects while an unapplied source draft is open so a host cannot silently save stale content.

## Validate and publish

Validation updates are available through `onValidationChange`; `flush()` and `controller.export()` also return the current issues. Treat blocking issues as a publish boundary. Import preserves reported source rather than sanitizing it, so the host remains responsible for its publishing and delivery policy.

## Replace or switch documents

Change `value` to replace the current source without remounting. Choose an `externalUpdate` policy:

- `replace` always accepts the incoming value.
- `replace-when-clean` keeps local work when the controller is dirty.
- `reject-when-dirty` reports a rejection instead of replacing local work.

Before switching to another document, call `flush()`, persist its result, and then mount the next document with a stable React `key`. This gives each document a distinct controller and history.

## Preview assets and read-only state

Pass an absolute HTTP(S) `baseUrl` when source contains relative stylesheets, images, or fonts. It is injected only into the hardened preview and never added to exported HTML. Set `readOnly` at runtime to retain preview, selection, and outline while disabling mutations.

## Dispose

Unmounting `HtmlEditor` removes its controller event subscriptions, iframe listeners, observers, and pending UI bindings. A headless integration owns its subscriptions directly: keep each function returned by `controller.subscribe()` or `controller.on()` and call it when the surrounding view or service is disposed. Release remaining controller references when the document closes.
