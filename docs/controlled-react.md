# Controlled React integration

Use `HtmlEditor` when the host application owns the HTML value and wants transaction-level change notifications without manually creating a controller.

```tsx
import { useState } from 'react';
import { slidesProfile } from '@visual-html/core';
import { HtmlEditor } from '@visual-html/react';
import '@visual-html/react/styles.css';

export function GeneratedSlideEditor({ initialHtml }: { initialHtml: string }) {
  const [html, setHtml] = useState(initialHtml);

  return (
    <HtmlEditor
      value={html}
      profile={slidesProfile}
      onChange={({ html: nextHtml, transaction }) => {
        setHtml(nextHtml);
        autosave(nextHtml, transaction.description);
      }}
      onValidationChange={(issues) => showIssues(issues)}
      onDirtyChange={(dirty) => setUnsavedIndicator(dirty)}
    />
  );
}
```

`onChange` runs once for each committed command, undo, or redo transaction. It does not run merely because React rerendered.

## External values

Choose how a new `value` prop behaves when the current session has unsaved edits:

```tsx
<HtmlEditor
  value={html}
  profile={emailProfile}
  externalUpdate="reject-when-dirty"
  onExternalUpdateResult={(result) => {
    if (!result.ok) showConflict(result.message);
  }}
/>
```

Policies:

- `replace`: replace the current source and begin a clean history root.
- `replace-when-clean`: replace only when the session is clean; otherwise report `{ replaced: false, reason: 'dirty' }`.
- `reject-when-dirty`: return a structured `dirty-source-replacement` failure when the session is dirty.

The default is `replace-when-clean`.

## Controller access

Use `onReady` when the host needs explicit save checkpoints or advanced commands:

```tsx
<HtmlEditor
  value={html}
  profile={webProfile}
  onReady={(controller) => {
    controllerRef.current = controller;
  }}
/>
```

Call `controller.createCheckpoint()` after persistence succeeds. `VisualHtmlEditor` remains available for applications that prefer to own the complete controller lifecycle.

## Selection

Both integration levels accept `onSelectionChange`:

```tsx
<HtmlEditor
  value={html}
  profile={webProfile}
  onSelectionChange={({ nodeKey, node }) => {
    console.log(nodeKey, node?.tagName);
  }}
/>
```

Selection is ephemeral UI state and is intentionally not stored in canonical HTML.
