# Changelog

This project follows semantic versioning once packages are published.

## Unreleased

### Added

- Contributor map, current architecture guide, explicit compatibility policy, and release guidance.
- Portable Chromium defaults, opt-in Edge tests, coordinated release-version tooling, and documentation-link checks.
- Complete reachable declaration snapshots and Node/React packed-consumer compatibility jobs.
- Focused internal modules for inspector controls, layer rendering, runtime selection, and HTML import.

- Framework-neutral source-first editor controller.
- Email, slides, and responsive-web profiles.
- Validated custom-profile builders.
- React editor workspace, component selector, inspector, source mode, and direct manipulation.
- Nested and overlapping hit-stack selection, visible layer cycling, Alt-click selection, and rear-layer dragging.
- Multi-slide deck controller and Claude Design adapter.
- Package validation, CI, security, contribution, and integration documentation.
- Typed controller lifecycle events and explicit external-source replacement policies.
- Controlled `HtmlEditor` and `useHtmlEditor` React APIs with transaction-level host callbacks.
- Packed headless and React consumer builds, public API snapshots, and package-size budgets.
- `@visual-html/editor` local-file CLI with preview-relative asset resolution and explicit save.
- React `flush()`, `baseUrl`, and runtime `readOnly` integration APIs.
- An HTML compatibility matrix covering common authored document structures.
- Source-preserving selected-text typography with font, size, weight, color, line-height, tracking, emphasis, and block alignment controls.
- Inline selected-text toolbar plus public React selection events and selection-preserving formatting methods.

### Changed

- Reduce the editor composition root to focused hook and view composition; separate canvas document, pointer, keyboard, text, layout, and inspector responsibilities.
- Run Chromium, Firefox, and WebKit in independent CI jobs so each engine reports its own result.
- Correct package Node requirements to >=20.19.0, matching the parser dependency; use Node 24.11.1 for development.
- Move historical architecture, requirements, and implementation plans under `docs/design`; public package entry points are preserved.
- Make importing a visitor's own HTML the primary showcase path while keeping examples available for exploration.

### Known limitations

- Public packages have not completed a prerelease compatibility cycle.

### Fixed

- Give each accessibility audit its own test budget instead of sharing one timeout across five editor states.
- Resolve workspace source in React unit tests and coverage so fresh checkouts do not depend on existing build output.
- Make the controlled editor's JSX return type compatible with React 18 as well as React 19, including custom fallback rendering.
- Refresh the import-panel visual baseline for the existing modal and identity, and isolate packed-browser test output from the main suite.
- Make clock-driven demo tests and layer keyboard tests deterministic across browsers without changing their intermediate-state or history assertions.

- Cleared text blocks remain clickable without adding placeholder source content.
- Inspector edits reject unsupported CSS values and keep authored values primary when stylesheets affect rendering.
- Element duplication allocates unique IDs and remaps local references inside copied subtrees.
- Slide navigation exposes deck undo/redo, and workspace save status includes deck changes.
- HTML import confirmation isolates keyboard focus and prevents background editing shortcuts.
- Color pickers initialize from computed named, variable, and inherited colors.

- Resize dimensions account for padding, borders, and CSS scale; dragging preserves stylesheet-defined offsets and scaled containing blocks.
- Valid optional closing tags remain editable, and table fragments retain their rendered source nodes.
- Image replacement clears old responsive candidates and updates source and alt text in one history transaction.
- In-place text editing has undo/redo with caret restoration across typing, deletion, paste, line breaks, and formatting.
- Mixed text containers and paragraphs with inline images support wording edits.
- Removing a standalone formatting mark preserves root attributes without nesting additional marks.
- Runtime markers and attribute insertion preserve trailing slashes in unquoted values.
