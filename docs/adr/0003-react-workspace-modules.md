# ADR-0003: React workspace ownership and module boundaries

- **Status:** Accepted
- **Date:** 2026-09-12

## Context

The editor component combined workspace rendering, iframe document setup, pointer
gestures, contenteditable input, history, property drafts, and file actions.
Extracting utility functions alone still left a large lifecycle effect and made
unrelated changes share the same implementation surface.

## Decision

Keep `VisualHtmlEditor` as the public composition root. Split presentation into
toolbar, stage, and sidebar components. Keep state with the feature that owns it:
selection, text editing, canvas layout, outline, inspector, files, and import each
have a focused hook. Source-mode state and transient messages stay in the root.

Group those internals under `canvas/`, `inspector/`, `outline/`, `import/`, and
`workspace/` within the React package. Keep public entry points and contracts at
the source root. These folders are feature boundaries, not additional packages.

The canvas lifecycle hook owns one mounted iframe document. It creates the
document, binds separate pointer, rich-text, and keyboard handlers, and disposes
listeners, observers, scheduled refreshes, and drag state before replacement.
Runtime modules accept typed dependencies and issue commands through the existing
controller; they do not own a second source model or import presentation components.

Selection and text hooks expose stable runtime bindings containing the live refs
and callbacks needed by native event handlers. Their display state remains separate,
so a caret, selection, notice, or property-draft render does not rewrite the iframe.
No global React context or new public package export is introduced.

## Consequences

Contributors can change workspace markup without reading native event handlers, and
pointer/text behavior has a clear owner and cleanup path. The number of internal
files grows, so the contributor map names each responsibility. Existing browser
scenarios remain the behavior contract; API snapshots and packed consumers protect
the published entry points while internal modules change.
