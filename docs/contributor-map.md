# Contributor map

Use [CONTRIBUTING.md](../CONTRIBUTING.md) for setup. This map identifies where a
change belongs without requiring a read of the original design documents.

| Change | Start here | Validate with |
| --- | --- | --- |
| Source parsing or fidelity | `packages/core/src/parser.ts`, `patcher.ts`, `source-attributes.ts` | Nearby package tests and `tests/unit/source-fidelity.test.ts` |
| Commands or history | `packages/core/src/controller.ts`, `planner.ts`, `types.ts` | Controller/planner tests and API snapshots |
| Policy or preview isolation | `packages/core/src/security.ts`, `runtime-security.ts`, `validation.ts` | Policy tests, browser security suite, coverage, mutation tests |
| Rich-text source transforms | `packages/core/src/rich-text.ts` | Rich-text unit/property tests and browser WYSIWYG regressions |
| Controlled React lifecycle | `packages/react/src/use-html-editor.ts`, `html-editor.tsx` | React lifecycle tests and controlled-browser scenarios |
| Workspace composition and layout | `packages/react/src/visual-html-editor.tsx`, `workspace/toolbar.tsx`, `workspace/stage.tsx`, `workspace/sidebar.tsx` | Visual, accessibility, and showcase scenarios |
| Canvas document lifecycle | `packages/react/src/canvas/use-runtime.ts`, `canvas/document.ts` | Controller/profile switching, source mode, and browser security scenarios |
| Pointer selection, drag, and resize | `packages/react/src/canvas/pointer.ts`, `canvas/use-selection.ts`, `canvas/use-layout.ts`, `canvas/selection.ts` | Touch, overlap, drag, and resize browser scenarios |
| Inline text and keyboard history | `packages/react/src/canvas/rich-text.ts`, `canvas/keyboard.ts`, `canvas/use-text-editing.ts`, `canvas/text-edit-history.ts` | WYSIWYG/history and keyboard accessibility scenarios |
| Inspector controls and drafts | `packages/react/src/inspector/use-properties.ts`, `inspector/controls.tsx`, `inspector/body.tsx`, `inspector/values.ts` | Selected-element, resilience, and visual scenarios |
| Imports and file actions | `packages/react/src/import/use-html-import.ts`, `import/html-import-dialog.tsx`, `workspace/use-files.ts` | HTML/deck import, resilience, and keyboard tests |
| Deck operations | `packages/deck/src/controller.ts`, `serialization.ts` | Deck tests and packed runtime consumer |
| Host showcase | `apps/showcase/src` | Showcase/demo/browser scenarios |
| Packaging and release checks | `scripts`, `.github/workflows`, `tests/consumers` | `pnpm release:check` and CI |

Public package entry points are `packages/*/src/index.ts`; package manifests define
subpath exports. Files elsewhere in `src` are internal even when a helper uses an
`export` for another internal module. Avoid deep imports in integrations.

Package unit tests stay beside their implementation. Repository integration tests
live in `tests/unit`; browser scenarios live directly in `tests`; packed consumers
live in `tests/consumers`. Generated output belongs in ignored `.artifacts`,
`test-results*`, or coverage directories. Maintained visual baselines live in
`tests/snapshots`.

For a first contribution, prefer a reduced compatibility fixture, a documentation
clarification, or a focused regression. Check the [roadmap](../ROADMAP.md) before
starting a new extension API. See the [current architecture](../ARCHITECTURE.md) for
ownership and data flow, and the [ADR index](./adr/README.md) for design decisions.
