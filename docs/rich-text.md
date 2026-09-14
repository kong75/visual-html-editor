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

`setInlineStyles` applies source-safe CSS typography to the same kind of rendered-text range:

```ts
await controller.dispatch({
  type: 'setInlineStyles',
  nodeKey: paragraph.key,
  range: { start: 6, end: 21 },
  styles: {
    'font-size': '24px',
    color: '#7c3aed',
    'letter-spacing': '0.02em'
  }
});
```

Range styles support `font-family`, `font-size`, `font-weight`, `color`, `line-height`, and `letter-spacing`. The engine adds narrowly scoped `<span style="…">` wrappers while preserving nested links and semantic markup. Later changes to the same selection update those spans in place instead of nesting new wrappers.

## React behavior

- Click a text region and type, delete, or paste plain text normally. Mixed `div`, `section`, `figcaption`, and inline containers are supported when their children are phrasing content.
- Use `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z` (or `Ctrl+Y`) to undo and redo while editing. Consecutive typing is grouped; paste and line breaks are separate actions. Selection and caret positions are restored.
- Wording changes commit as one undoable transaction when focus leaves the text.
- Select a non-empty range.
- Use **Bold**, **Italic**, **Underline**, or **Strikethrough** in the toolbar beside the selected range. Bold, italic, and underline also support `Ctrl/Cmd+B`, `Ctrl/Cmd+I`, and `Ctrl/Cmd+U`.
- Set font family, font size, and color directly in the range toolbar. Weight, line height, and letter spacing are grouped under **More**.
- Alignment stays in the element inspector because CSS alignment changes the containing block rather than an inline range.
- The selection is restored after the source transaction so the user can toggle again.

## React selection API

`VisualHtmlEditor` and `HtmlEditor` report the live range through `onTextSelectionChange`. A non-empty selection includes its `nodeKey`, rendered-text offsets, active semantic marks, and active inline style values. The callback receives `null` when the range collapses.

The editor ref exposes `getTextSelection()`, `toggleSelectedTextMark()`, and `setSelectedTextStyles()`. The formatting methods use the same policy-controlled core commands as the built-in toolbar and restore the browser selection after the document revision. A host can pass the callback's selection snapshot to either formatting method, allowing an external input or popover to take focus before it applies a change.

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

Adding a semantic mark requires its tag in `profile.html.allowedTags` and `editText: true`. Removing an existing mark remains possible so a host can clean content that violates a narrowed policy.

Selected-text CSS requires `editText`, `editStyles`, the `span` tag, the `style` attribute, and each requested property in the active profile. Values pass the same CSS security checks and candidate-document validation as element styles.

## Current boundary

Mixed-region wording edits, deletion, plain-text paste, semantic emphasis, and inline typography are supported. Rich clipboard formatting and block-structure editing remain future capabilities.
