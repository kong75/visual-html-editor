# Element behavior and semantic labels

The default React workspace separates source structure from editing behavior. Native interactive elements such as links, buttons, and form controls are atomic selection targets. Transparent formatting elements such as `<strong>`, `<em>`, and `<span>` delegate inline editing to their nearest source-backed rich-text region.

This avoids tag-and-style heuristics. An `<a>` is a Link by default whether it looks like body text or a call-to-action button. If a product has its own component conventions, add an element behavior resolver:

```tsx
import type { ElementBehaviorResolver } from '@visual-html/react';

const productComponents: ElementBehaviorResolver = ({ node }) => {
  if (node.attributes.get('data-component')?.value === 'cta') {
    return {
      kind: 'Call to action',
      editTarget: 'self'
    };
  }
  return undefined;
};

<HtmlEditor
  value={html}
  profile={emailProfile}
  elementBehaviorResolvers={[productComponents]}
/>
```

Resolvers are applied in order and may override either field:

- `kind` controls the component-selector and inspector label.
- `editTarget: 'self'` keeps the clicked source element selected while editing.
- `editTarget: 'nearest-rich-text-region'` delegates editing to a compatible parent region.

Resolvers affect editor interaction only. They do not bypass profile capabilities or HTML/CSS policy validation.

## CSS shorthand and longhand edits

Inline style editing follows CSS cascade semantics rather than tag-specific rewrite rules. When a property is changed, existing declarations for that exact property are removed and the edited declaration is written last. This makes the edit win over earlier shorthands without destructively expanding or rewriting them.

For example, editing Fill on:

```html
style="background: #007ee5; color: white"
```

produces:

```html
style="background: #007ee5; color: white; background-color: #d946ef"
```

The original shorthand remains intact, and the standard CSS cascade determines the rendered value. The same behavior applies to relationships such as `border`/`border-color` and `margin`/`margin-left`.

The inspector shows rendered values alongside authored values when they differ, including edits overridden by stylesheet `!important` rules and relative units resolved by layout. Visual edits do not automatically add `!important`. Values unsupported by the current browser's CSS grammar are rejected before a source transaction; the framework-neutral core continues to validate CSS policy and declaration structure. Named and inherited colors initialize color pickers from their computed RGB values without rewriting their source.

Empty text blocks retain an editing-only minimum height so authors can click and resume typing after clearing them. No placeholder content or height declaration is added to exported HTML.

## Duplicating elements

Duplicating a subtree assigns collision-free IDs (`original-copy`, then `original-copy-2`, and so on). Local fragment links, HTML ID references, ARIA references, and SVG/inline CSS fragment URLs within the copied subtree are remapped to its new IDs. Links outside the subtree continue to target the original. Unchanged source text, entities, and comments are preserved, and the operation is one undoable transaction.

Document stylesheet selectors are not rewritten. Use classes for styling shared by original and copied elements; a selector targeting an original ID continues to target that original element.
