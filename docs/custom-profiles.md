# Custom and controlled profiles

Profiles define what the document may contain and what the user may do. UI visibility is not the security boundary; core commands and export validation use the same profile.

## Extend a preset

```ts
import { emailProfile, extendEditorProfile } from '@visual-html/core';

export const restrictedEmail = extendEditorProfile(emailProfile, {
  id: 'restricted-email',
  label: 'Restricted email',
  capabilities: {
    importHtml: false,
    editSource: false,
    deleteElements: false,
    duplicateElements: false,
    insertImages: false
  },
  html: {
    allowedTags: ['html', 'head', 'body', 'title', 'meta', 'table', 'tbody', 'tr', 'td', 'p', 'span', 'strong', 'a'],
    allowedAttributes: ['id', 'class', 'style', 'href', 'title', 'role'],
    allowedCssProperties: ['color', 'background-color', 'font-family', 'font-size', 'font-weight', 'line-height', 'text-align', 'padding'],
    allowedProtocols: ['https:', 'mailto:']
  }
});
```

Array overrides replace the preset array. Capability objects merge with the preset.

## Define a profile from scratch

Use `defineEditorProfile` when none of the presets is a useful base. The helper clones arrays, normalizes policy names, removes duplicate policy entries, and validates viewport configuration.

```ts
import { defineEditorProfile } from '@visual-html/core';

export const textCardProfile = defineEditorProfile({
  id: 'text-card',
  label: 'Text card',
  description: 'Text and links inside a fixed card.',
  fidelity: 'preserve',
  html: {
    allowedTags: ['html', 'head', 'body', 'main', 'h1', 'p', 'a'],
    allowedAttributes: ['id', 'class', 'style', 'href'],
    allowedCssProperties: ['color', 'background-color', 'font-size', 'font-weight', 'line-height', 'padding'],
    allowedProtocols: ['https:'],
    allowDataAttributes: false,
    allowAriaAttributes: true
  },
  capabilities: {
    editText: true,
    editStyles: true,
    insertImages: false,
    replaceImages: false,
    dragElements: false,
    resizeElements: false,
    duplicateElements: false,
    deleteElements: false,
    importHtml: false,
    editSource: false
  },
  aspectRatios: [{ id: 'card', label: 'Card', width: 720, height: 480 }],
  defaultAspectRatioId: 'card'
});
```

## Policy behavior

- Existing disallowed source is preserved and reported; it is not silently deleted.
- Commands that would introduce forbidden attributes or CSS are rejected.
- Export reports blocking issues so the host can prevent publishing.
- `data-*` and `aria-*` behavior is separately configurable.
