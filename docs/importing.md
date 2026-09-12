# HTML and slide-deck importing

Visual HTML keeps the active profile explicit. The editor does not guess whether a file is an email, web document, or slide deck; the host chooses the profile before the user imports.

## Default document import

The default React workspace shows **Import HTML** when `profile.capabilities.importHtml` is enabled. It:

1. accepts `.html` and `.htm` files up to 5 MB;
2. reads the file locally in the browser;
3. evaluates it against the active profile and reports policy issues;
4. asks for confirmation before replacement, with an additional warning for unsaved work;
5. applies the complete source as one undoable transaction.

No upload or server is required. `HtmlEditor` reports the imported source through its normal `onChange` callback.

Disable the control independently of source mode:

```ts
const profile = extendEditorProfile(webProfile, {
  capabilities: {
    importHtml: false,
    editSource: true
  }
});
```

## Specialized formats

Use `HtmlImportAdapter` when importing means more than replacing one HTML document. `prepare` parses the file before confirmation and describes the effect; `apply` performs the host-owned replacement.

```tsx
import { importClaudeDesignDeck } from '@visual-html/deck';
import type { HtmlImportAdapter } from '@visual-html/react';

const deckImport: HtmlImportAdapter = {
  prepare: ({ file, html }) => {
    const imported = importClaudeDesignDeck(html);
    return {
      title: `Import ${imported.deck.title || file.name}`,
      description: `Replace this deck with ${imported.deck.slides.length} slides.`,
      warnings: imported.warnings.map((warning) => warning.message),
      hasUnsavedChanges: deckController.getSnapshot().dirty
    };
  },
  apply: ({ file, html }) => {
    const imported = importClaudeDesignDeck(html);
    const result = deckController.replaceDeck(imported.deck, {
      description: `Import ${file.name}`
    });
    if (!result.ok) throw new Error(result.message);
    return { message: `Imported ${imported.deck.slides.length} slides.` };
  }
};

<VisualHtmlEditor controller={activeSlideController} importAdapter={deckImport} />;
```

Adapters may customize `accept` and `maxBytes`. Throw an `Error` from either callback to show an actionable notice without replacing current work.

## Security boundary

Import preserves source; it is not a sanitizer. Disallowed source remains visible to validation and blocks export, while the preview uses the same hardened sandbox as directly supplied HTML. Products that require normalization or sanitization should perform it explicitly in the adapter and disclose any source transformations to users.
