# Rich-text editing

Visual HTML supports normal wording edits and selection formatting inside mixed inline markup while keeping the edit source-backed and policy-controlled.

## Core command

`toggleInlineMark` receives text offsets relative to the selected element's rendered text:

```ts
await controller.dispatch({
  type: 'toggleInlineMark',
  nodeKey: paragraph.key,
  range: { start: 6, end: 21 },
  mark: 'strong'
});
```

For this source:

```html
<p>Hello <em>beautiful</em> world.</p>
```

the command can produce:

```html
<p>Hello <em><strong>beautiful</strong></em><strong> world</strong>.</p>
```

The engine preserves existing tags, attributes, entities, and untouched source. Applying the command to an entirely marked selection removes that mark and balances nested inline elements.

## React behavior

- Click a text region and type, delete, or paste plain text normally. Mixed `div`, `section`, `figcaption`, and inline containers are supported when their children are phrasing content.
- Use `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z` (or `Ctrl+Y`) to undo and redo while editing. Consecutive typing is grouped; paste and line breaks are separate actions. Selection and caret positions are restored.
- Wording changes commit as one undoable transaction when focus leaves the text.
- Select a non-empty range.
- Use **Bold** in the editing toolbar or press `Ctrl/Cmd+B`.
- The selection is restored after the source transaction so the user can toggle again.
- No floating formatting toolbar is rendered over the document.

The built-in rich-text regions accept inline descendants such as `span`, `strong`, `em`, `a`, `small`, and `code`, plus inline images. Structural nested content remains editable through its individual components or source mode. List items, cells, and paragraphs with valid omitted end tags remain editable without adding explicit closing tags to the source.

When the selected root is itself a mark, such as `<strong id="label">Text</strong>`, removing that mark changes the root to a neutral `span` and preserves its attributes. Partial removal retains marks around the unselected text. The profile must allow `span` for this root conversion.

## Wording command

`setRichText` accepts the edited inner HTML for one rich-text element:

```ts
await controller.dispatch({
  type: 'setRichText',
  nodeKey: paragraph.key,
  html: 'Hello <em>wonderful</em> world.'
});
```

The core compares the edited fragment with the canonical source. When the element structure is unchanged, it emits minimal patches for only the changed text nodes, preserving original tag syntax, attributes, quote style, entities, and surrounding HTML. If the inline structure changes, replacement remains scoped to that element and must pass the active HTML policy.

The React editor strips runtime-only attributes before dispatch and accepts paste as plain text, so editor metadata or clipboard HTML cannot enter the exported document.

## Policy enforcement

Adding Bold requires `strong` in `profile.html.allowedTags` and `editText: true`. Removing an existing mark remains possible so a host can clean content that violates a narrowed policy.

## Current boundary

Bold is the first exposed selection-formatting control. The core `InlineMark` type also defines `em`, `u`, and `s` for future controls. Mixed-region wording edits, deletion, and plain-text paste are supported; richer clipboard formatting and block-structure editing remain future capabilities.
