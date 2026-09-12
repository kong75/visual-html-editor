# Architecture

This describes the implemented alpha. Start with the [contributor map](./docs/contributor-map.md) to locate code and tests. Historical proposals are retained under [docs/design](./docs/design/README.md); they do not define the current public API.

## Package boundaries

| Location | Responsibility | Runtime dependencies within this repository |
| --- | --- | --- |
| `packages/core` | HTML source, parsing, profiles, commands, transactions, history, validation, preview projection, and export | None |
| `packages/deck` | Ordered standalone HTML slides, deck history, serialization, and the Claude Design adapter | None |
| `packages/react` | React lifecycle bindings and the default editing workspace | Core and deck |
| `apps/showcase` | Example host application, sample documents, and landing demo | Public exports of all three packages |

Core and deck have no React dependency. Deck manages slide documents; a host composes a core controller for each slide it edits. React depends on deck for its optional navigator. These are the three published packages; additional package splits require an ADR.

## Editing flow

```mermaid
flowchart LR
  Source[Authored HTML] --> Parse[Parsed source index]
  Parse --> Projection[Temporary preview projection]
  Projection --> Frame[Sandboxed iframe]
  Frame --> Interaction[Selection and editing interaction]
  Interaction --> Command[Typed core command]
  Command --> Validate[Policy and patch validation]
  Validate --> Transaction[Source transaction and history]
  Transaction --> Source
  Source --> Export[Validated HTML export]
```

The authored string is canonical. Parsing supplies source ranges and node identities. The preview adds temporary runtime attributes and styles; those additions are not serialized as the exported document. Durable edits go through the controller and source patcher, then rebuild the parsed index and preview.

The core currently edits a single HTML source document, including inline styles and embedded stylesheets. Multi-file workspaces and editable external stylesheets remain proposals. `WorkspaceSnapshot` names do not imply that those proposals are implemented.

`EditorController` owns document revisions, transactions, history, checkpoints, profile validation, and typed events. The host owns persistence and calls `createCheckpoint()` after saving successfully. Deck structure has its own history; hosts combine deck dirty state with active-document dirty state through `workspaceDirty`.

## React internals

`HtmlEditor` and `useHtmlEditor` manage a controller for controlled string integrations. `VisualHtmlEditor` accepts a host-owned controller and composes the workspace from state hooks and presentation components. It owns source mode and status messages; iframe event handlers live outside the component.

The default workspace is organized by responsibility:

- `editor-types.ts`: public props, asset adapters, and import contracts. Existing package exports remain the API boundary.
- `workspace/toolbar.tsx`, `workspace/stage.tsx`, and `workspace/sidebar.tsx`: workspace presentation, including canvas/source switching and inspector composition.
- `canvas/use-runtime.ts`: one iframe document's setup, event subscriptions, observer, and cleanup. `canvas/document.ts`, `canvas/pointer.ts`, `canvas/rich-text.ts`, and `canvas/keyboard.ts` implement its separate interaction responsibilities.
- `canvas/use-selection.ts`, `canvas/use-text-editing.ts`, and `canvas/use-layout.ts`: selection overlays, local text history and caret restoration, and viewport fitting/resizing.
- `outline/use-outline.ts`, `inspector/use-properties.ts`, `workspace/use-files.ts`, and `workspace/use-shortcuts.ts`: layer state, property drafts, file actions, and host-window shortcuts.
- `canvas/selection.ts`: iframe hit testing, text ranges, editing regions, and selection restoration.
- `canvas/attributes.ts`: runtime attribute binding and source-rich-text extraction.
- `canvas/geometry.ts` and `canvas/text-edit-history.ts`: coordinate conversion and active text history.
- `outline/component-outline.tsx`: source-backed layer tree and semantic labels.
- `inspector/controls.tsx`, `inspector/body.tsx`, and `inspector/values.ts`: property controls, sections, and rendered-value normalization.
- `import/use-html-import.ts` and `import/html-import-dialog.tsx`: import preparation, replacement state, modal focus, and confirmation.
- `workspace/browser-files.ts`: local file reading and HTML downloads.

Internal modules are not new public extension points. Use package exports, profile configuration, documented adapters, and the existing toolbar/sidebar slots. More granular inspector composition remains on the roadmap.

Runtime bindings have stable identities across selection and inspector renders. Only document/profile revisions or a mode/controller change rebuild the iframe session. Session cleanup releases listeners, the resize observer, pending frame refresh, and active drag previews. See [ADR-0003](./docs/adr/0003-react-workspace-modules.md) for the ownership rules.

## Security and source fidelity

Core policy validates tags, attributes, protocols, styles, and commands. Preview isolation and export validation complement that policy. The host owns authentication, authorization, asset credentials, persistence, and publishing. See the [security model](./docs/security.md) for the actual integration boundary.

Mixed-text wording and Bold formatting are source-backed operations. Plain-text paste is supported; general rich clipboard HTML and additional built-in formatting controls remain future work. Source editing and HTML importing are controlled by profiles.

## Review and validation

Public APIs are represented by the complete local declaration graph under [api](./api/README.md). Entry-point changes, imported public types, and subpath declarations are included. API snapshots are review artifacts, not a second implementation.

Package tests stay beside code; repository scenarios and packed consumers live under `tests`. See [test architecture](./tests/README.md) and [compatibility](./docs/compatibility.md). Architecture or package-boundary changes should include an [ADR](./docs/adr/README.md).
