# `@visual-html/react`

Default React workspace for Visual HTML.

```tsx
import { emailProfile } from '@visual-html/core';
import { HtmlEditor } from '@visual-html/react';
import '@visual-html/react/styles.css';

<HtmlEditor
  value={html}
  profile={emailProfile}
  onChange={({ html: nextHtml }) => setHtml(nextHtml)}
/>
```

Use `VisualHtmlEditor` when the host owns an `EditorController` directly. Use `HtmlEditor` or `useHtmlEditor` for a managed React lifecycle.

The package includes the visual canvas, component selector, contextual inspector, mixed-text wording and Bold editing, reviewed HTML import, source mode, image adapter support, transaction-level callbacks, and optional `DeckNavigator`.

When `profile.capabilities.importHtml` is enabled, the default import flow accepts `.html` and `.htm` files up to 5 MB, previews policy issues, confirms destructive replacement, and records the replacement as one undoable transaction. Supply an `HtmlImportAdapter` when the host needs to parse and apply a specialized format such as a multi-slide deck.

Type, delete, and paste plain text normally inside paragraphs and headings that contain mixed inline styles. Select text to enable Bold in the editing toolbar; `Ctrl/Cmd+B` is supported without adding a floating canvas toolbar.

Host applications can inject product-specific controls into the top row with `toolbarContent` and contextual inspector content with `sidebarHeader`.

Use `elementBehaviorResolvers` to override semantic labels and whether a source element edits itself or delegates to a parent rich-text region. Native links and buttons are atomic by default; formatting wrappers such as `<strong>` and `<span>` delegate to their nearest rich-text region.

React and React DOM are peer dependencies. Create the document controller with `@visual-html/core` and keep it stable for the lifetime of the editing session.

## Installation and compatibility

This package is in private alpha preparation and has not been published to npm. Use the workspace or the packed-consumer workflow until the first release. Node.js 20.19.0+ is required; the package ships ESM and TypeScript declarations.

React and React DOM support `^18.2.0 || ^19.0.0`; keep their versions aligned. Import `@visual-html/react/styles.css` in the host application.

See the [integration guides](https://github.com/kong75/visual-html-editor/tree/main/docs), [compatibility policy](https://github.com/kong75/visual-html-editor/blob/main/docs/compatibility.md), and [release notes](https://github.com/kong75/visual-html-editor/blob/main/CHANGELOG.md). Repository links require collaborator access while the source is private.
