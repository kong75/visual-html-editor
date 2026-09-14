> Historical design document. Retained for context; it includes proposals and superseded decisions. Read the [current architecture](../../ARCHITECTURE.md), [roadmap](../../ROADMAP.md), and [contributor guide](../../CONTRIBUTING.md) for implemented behavior and current work.

# AI-generated HTML editing implementation plan

**Status:** Approved implementation direction  
**Date:** August 16, 2026  
**Scope:** Static AI-generated HTML, HTML email, and HTML slide documents  
**Primary principle:** The integrating developer explicitly selects the profile and import adapter. The editor does not guess the document type.

## 1. Product outcome

Visual HTML should make this integration straightforward:

```tsx
<HtmlEditor
  value={generatedHtml}
  profile={slidesProfile}
  onChange={(result) => saveHtml(result.html)}
/>
```

Developers should also be able to use the source engine without the default UI:

```ts
const controller = await EditorController.create({
  html: generatedHtml,
  profile: emailProfile
});
```

The project is successful when a host application can accept AI-generated static HTML, render it accurately, allow safe visual changes, and export clean HTML without adopting a proprietary document schema.

## 2. Scope boundaries

### In scope

- Static, self-contained HTML.
- Inline styles and embedded style blocks where supported by the active profile.
- HTML email with developer-controlled policy.
- Fixed-canvas HTML presentations.
- Responsive static web content with constrained editing behavior.
- Explicit deck-format adapters.
- Source-preserving edits and profile-specific controlled normalization.

### Not promised

- Editing arbitrary live websites.
- React, Vue, or other framework runtime state.
- JavaScript-driven application behavior.
- Automatic email, slide, or web detection.
- Perfect manipulation of every possible CSS layout.
- DOM serialization as canonical output.

## 3. Architectural rules for every milestone

1. Source remains canonical; the iframe DOM is disposable.
2. Durable changes go through typed commands and atomic source transactions.
3. Policy is enforced in core, not only by hiding controls.
4. Email, slides, and web behavior is selected explicitly through profiles.
5. Format import is selected explicitly through adapters.
6. React convenience APIs wrap the controller; they do not create a second editing engine.
7. New public APIs require documentation, consumer tests, and a changelog entry.
8. New behavior must work without importing showcase code.
9. Unsupported edits return structured diagnostics rather than silently rewriting source.
10. Third-party implementations remain behind internal or narrow adapter boundaries.

## 4. Delivery order

| Milestone | Capability | Depends on | Release outcome |
| --- | --- | --- | --- |
| 0 | Public API and test foundation | Current alpha | Safe base for incremental API work |
| 1 | Controlled React API and host events | 0 | Simple product integration |
| 2 | Compatibility diagnostics | 1 | Explain editability before and during editing |
| 3 | Paste, upload, and drop primitives | 2 | Easy ingestion of generated HTML |
| 4 | Extensible operation planners | 0-2 | Profile-specific editing strategies |
| 5 | Element insertion API and UI | 4 | Add content, not only modify existing content |
| 6 | Stronger slide adapters and operations | 4-5 | Complete HTML presentation workflow |
| 7 | Mixed rich-text editing | 4 | Safe editing across inline markup |
| 8 | Beta hardening | 1-7 | Open-source beta quality |

Milestones are merged and released one at a time. A later milestone must not be started by weakening the acceptance criteria of an earlier one.

### Implementation status — August 17, 2026

- **Milestone 0: Complete.** Packed headless and React/Vite consumers, public declaration snapshots, ADR structure, versioning policy, package-size budgets, and CI gates are implemented.
- **Milestone 1: Complete.** Typed controller events, explicit source-replacement policies, `useHtmlEditor`, controlled `HtmlEditor`, selection callbacks, documentation, and browser regressions are implemented.
- **Milestone 7 foundation: Complete.** Source-preserving inline-mark planning and the first Bold control support mixed inline markup without serializing browser `innerHTML`.
- **Next:** Milestone 2 — compatibility diagnostics.

## 5. Milestone 0 — Public API and test foundation

### Goal

Make API evolution measurable before adding more capabilities.

### Work

- Add packed-consumer fixtures:
  - React + Vite consumer.
  - Headless TypeScript consumer.
- Build packages, create tarballs, install those tarballs into the fixtures, and compile them in CI.
- Add API report generation for exported TypeScript declarations.
- Add an architecture-decision-record folder and template.
- Add release notes validation for public API changes.
- Add a package-size report for each publishable package.
- Establish deprecation rules for pre-1.0 APIs.

### Acceptance criteria

- No consumer fixture resolves packages through workspace aliases.
- CSS imports work from the packed React package.
- ESM and bundler resolution remain green.
- A public export change produces a reviewable API diff.
- Package size regressions are visible in CI.

## 6. Milestone 1 — Controlled React API and host events

### Goal

Support both the existing controller-owned integration and a concise controlled integration.

### Proposed API

Keep the low-level component:

```tsx
<VisualHtmlEditor controller={controller} />
```

Add a convenience wrapper:

```tsx
<HtmlEditor
  value={html}
  profile={emailProfile}
  onChange={({ html, revision, transaction }) => setHtml(html)}
  onSelectionChange={setSelection}
  onValidationChange={setIssues}
  onDirtyChange={setDirty}
/>
```

Proposed supporting hook:

```ts
const session = useHtmlEditor({ value, profile, externalUpdate: 'replace-when-clean' });
```

### Core work

- Replace the untyped listener with typed controller events:
  - `revisionChanged`
  - `transactionCommitted`
  - `transactionRejected`
  - `validationChanged`
  - `dirtyChanged`
  - `profileChanged`
  - `fatalError`
- Include revision, transaction description, and source diff metadata where relevant.
- Define explicit external-value replacement policies:
  - `replace`
  - `replace-when-clean`
  - `reject-when-dirty`
- Prevent `value -> controller -> onChange -> value` feedback loops.
- Preserve controller and history when unrelated React props change.

### React work

- Add `HtmlEditor` as a wrapper, not an overloaded mode inside `VisualHtmlEditor`.
- Add controlled callbacks with stable payload types.
- Add error and loading render props.
- Add imperative access only through a typed ref when necessary.

### Tests

- Parent rerenders do not recreate the session.
- External value replacement follows the configured dirty-state policy.
- `onChange` fires once per committed transaction, not per render.
- Profile changes are explicit and preserve or reset state according to documented rules.
- React Strict Mode does not create duplicate controllers or events.

### Documentation

- Five-minute controlled React guide.
- Low-level controller guide.
- State ownership and autosave examples.

## 7. Milestone 2 — Compatibility diagnostics

### Goal

Tell developers and users what can render, what can be edited, and what will be blocked without guessing the content type.

### Model

Compatibility diagnostics are distinct from policy validation:

- **Policy issue:** The active profile forbids something.
- **Compatibility issue:** The document may render but cannot be edited faithfully by the current engine.
- **Edit limitation:** A specific node or operation is unsupported.

Proposed result:

```ts
interface CompatibilityReport {
  support: 'full' | 'partial' | 'preview-only' | 'blocked';
  issues: readonly CompatibilityIssue[];
  capabilities: DocumentCapabilitySummary;
}
```

### Initial diagnostics

- Script tags and inline event handlers.
- External stylesheets.
- External fonts and assets.
- Tailwind or other runtime CSS dependencies.
- Framework mount points and hydration markers.
- Custom elements.
- Template expressions and opaque regions.
- Nested rich-text regions.
- Unsupported or virtual parser nodes.
- Dangerous protocols and CSS URLs.
- Layouts whose movement semantics are unavailable in the chosen profile.

### API

```ts
const report = await analyzeHtmlCompatibility({ html, profile });
```

The same report is available from the controller snapshot and updates after relevant transactions.

### Acceptance criteria

- Diagnostics are deterministic for the same HTML and profile.
- Every issue has a stable code, severity, source range when available, and suggested action.
- The UI never claims full editability when only preview is supported.
- Compatibility checks do not mutate input HTML.
- Host applications can hide the default diagnostics UI and consume only typed results.

## 8. Milestone 3 — Paste, upload, and drop primitives

### Goal

Make generated HTML easy to provide without coupling import UX to the editor workspace.

### API direction

Browser utilities:

```ts
readHtmlFile(file, options)
readHtmlClipboard(dataTransfer, options)
```

React primitives:

```tsx
<HtmlImportDropzone
  profile={slidesProfile}
  onImport={({ html, compatibility }) => setHtml(html)}
/>
```

The host still supplies the profile. Import does not infer it.

### Work

- Accept `.html` and configured text MIME types.
- Support paste, file picker, and drag-and-drop.
- Set configurable file-size limits.
- Preserve source bytes and detected encoding where practical.
- Return compatibility and policy reports before opening the editor.
- Provide headless helper functions and optional default UI.
- Keep network fetching out of the default import path.

### Security requirements

- Never execute imported scripts during analysis.
- Do not fetch external resources during compatibility analysis.
- Sanitize filenames used for download.
- Reject binary or deceptive MIME inputs with structured errors.

### Tests

- Valid HTML file, fragment, empty file, oversized file, wrong MIME, malformed HTML, and Unicode content.
- Clipboard text versus clipboard HTML precedence.
- Dropzone keyboard operation and screen-reader labels.
- Imported source remains byte-identical before edits.

## 9. Milestone 4 — Extensible operation planners

### Goal

Replace the monolithic command planner with explicit profile-specific strategies before adding more editing commands.

### Proposed core contract

```ts
interface OperationPlanner<TCommand extends EditorCommand = EditorCommand> {
  id: string;
  supports(command: TCommand, context: PlanningContext): boolean;
  plan(command: TCommand, context: PlanningContext): PlanResult;
}
```

The planner context provides read-only source, node index, profile policy, capabilities, and helper patch factories. It does not expose controller mutation.

### Resolution rules

1. Core safety and structural planners run first.
2. The active profile supplies ordered planners.
3. Host planners may narrow or handle explicitly registered commands.
4. Ambiguous planner matches are an error in development and deterministic in production.
5. A planner returns `handled`, `unsupported`, or `denied`; it never silently falls through after partial mutation.

### Built-in planners

- Text and attribute planner.
- Inline-style planner.
- Structural insertion/removal planner.
- Slide absolute-layout planner.
- Responsive-flow planner that refuses unsafe absolute conversion.
- Email planner that preserves table structure and denies unsafe movement.

### Migration

- Refactor current `planCommand` behavior without changing outputs first.
- Lock existing behavior with golden patch tests.
- Add strategy selection diagnostics.
- Expose planner extension only after built-in behavior passes parity tests.

### Acceptance criteria

- Existing commands produce equivalent source patches before and after refactoring.
- Email, slide, and web movement behavior no longer shares one generic implementation.
- A third-party planner can be registered without importing internal parser types.
- Planner ordering, conflict handling, and error codes are documented and tested.

## 10. Milestone 5 — Element insertion API and UI

### Goal

Let users add common content while preserving profile rules and source structure.

### Command model

```ts
interface InsertElementCommand {
  type: 'insertElement';
  targetNodeKey: NodeKey;
  placement: 'before' | 'after' | 'inside-start' | 'inside-end';
  element: ElementSpec;
}
```

`ElementSpec` is a validated descriptor, not an unrestricted DOM object. An advanced host may register trusted HTML factories explicitly.

### Insertable registry

```ts
interface InsertableDefinition {
  id: string;
  label: string;
  category: string;
  isAvailable(context: InsertContext): boolean;
  create(context: InsertContext): ElementSpec;
}
```

### Initial insertables

- Heading.
- Paragraph.
- Image.
- Link or button.
- Container or section.
- Slide-profile text box and shape.

Email insertables are deliberately table-safe and may differ from web insertables.

### React work

- Add a composable insertion palette.
- Allow hosts to supply, reorder, group, or completely replace insertables.
- Show valid drop/insertion locations.
- Restore selection to the inserted node.
- Make insertion fully keyboard operable.

### Acceptance criteria

- Insertion is one undoable transaction.
- Invalid parent/child combinations are rejected before source mutation.
- Inserted markup passes active profile policy.
- Selection and NodeKey remapping remain stable.
- Default UI is optional; commands work headlessly.

## 11. Milestone 6 — Stronger slide support and explicit adapters

### Goal

Provide a complete static HTML presentation workflow without defining one universal slide format.

### Adapter contract

```ts
interface DeckFormatAdapter<TOptions = unknown> {
  id: string;
  import(source: string, options?: TOptions): DeckImportResult;
  export(deck: HtmlDeck, options?: TOptions): DeckExportResult;
}
```

Adapters are selected explicitly:

```ts
const deck = sectionDeckAdapter.import(html);
```

### Built-in adapters

- Canonical Visual HTML deck JSON.
- Claude Design `<deck-stage>` HTML.
- Generic direct-child `<section>` deck.
- Optional Reveal.js-compatible static section adapter if fixtures prove safe round-tripping.

### Deck operations

- Add, duplicate, delete, and reorder slides.
- Edit slide metadata and speaker notes.
- Configure dimensions and accepted aspect ratios.
- Import/export assets according to host policy.
- Layer order controls for positioned slide elements.
- Lock/unlock and visibility metadata only when the selected adapter can preserve it.
- Optional snapping and alignment guides as React-only ephemeral behavior; committed results remain normal source commands.

### Acceptance criteria

- Import then export through the same adapter preserves documented semantics.
- Unsupported adapter features produce warnings rather than disappearing silently.
- Each slide remains a standalone HTML document inside the canonical deck model.
- Structural deck history remains separate from per-slide source history.
- Exported decks run without editor runtime dependencies unless the adapter explicitly includes a presentation runtime.

## 12. Milestone 7 — Mixed rich-text editing

### Goal

Visually edit regions such as:

```html
<p>Hello <strong>important</strong> world.</p>
```

without discarding inline markup or rewriting unrelated source.

### Deliberate first boundary

The first rich-text adapter supports one block region containing an allowlisted set of inline elements and marks. It does not initially support arbitrary nested blocks, tables, widgets, or executable content.

### Fidelity modes

- **Preserve:** text-node edits and mark operations use targeted source patches where possible.
- **Balanced:** the selected rich-text region may be normalized, but the rest of the document remains byte-identical.
- **Normalize:** broader region serialization is explicit and profile-controlled.

### Architecture

```ts
interface RichTextAdapter {
  canEdit(node: ParsedNode, context: RichTextContext): RichTextSupport;
  open(node: ParsedNode, context: RichTextContext): RichTextSession;
  plan(change: RichTextChange, session: RichTextSession): PlanResult;
}
```

The implementation library, if any, stays behind this interface. Its schema types must not become core public types.

### Initial operations

- Insert and delete text.
- Selection replacement.
- Bold, italic, underline, strike, and link.
- Line break.
- Plain-text paste.
- IME composition.
- Undo/redo as editor transactions.

### Required research spike

Before implementation, build two disposable prototypes:

1. Native `beforeinput` plus source-range mapping.
2. Region-local structured editor with controlled serialization.

Evaluate fidelity, IME support, browser consistency, bundle size, accessibility, and maintenance cost. Record the result in an ADR before choosing the implementation.

### Acceptance criteria

- Editing text around `<strong>`, `<em>`, and `<a>` preserves the marks.
- Unedited content outside the active region remains byte-identical.
- Paste cannot bypass profile policy.
- IME input works in Chromium, Firefox, and WebKit.
- Unsupported nested structures fall back safely to source mode or leaf editing.
- Rich-text dependencies remain optional or isolated from consumers that do not enable the feature.

## 13. Milestone 8 — Open-source beta hardening

### Goal

Turn the completed feature set into a dependable external platform.

### Quality work

- Chromium, Firefox, and WebKit CI.
- Automated accessibility checks plus documented manual keyboard flows.
- Security fixture suite for protocols, handlers, SVG, CSS URLs, source mode, paste, and export bypasses.
- Golden fixtures from real AI-generated email, slide, and web outputs.
- Large-document performance benchmarks.
- Memory and history bounds.
- Public API reference generation.
- Versioned migration notes.
- At least two clean external integration examples using different profiles.

### Beta exit criteria

- All public APIs are exercised by packed-consumer tests.
- No critical or high-severity security issue is open.
- Supported browser and Node versions are documented and tested.
- Keyboard-only completion of import, selection, editing, insertion, undo, and export is documented.
- Compatibility limitations are surfaced through structured diagnostics.
- At least one prerelease cycle has validated installation and upgrade behavior.

## 14. Pull-request definition of done

Every implementation pull request must include:

- Public API and type review.
- Core unit tests for commands, planners, policy, and patches.
- Browser tests for user-visible behavior.
- A golden source-diff test where source changes.
- Security test coverage when input or output handling changes.
- Accessibility checks when UI interaction changes.
- Documentation and examples.
- Changelog entry.
- Packed-package and consumer-fixture validation.
- No new runtime dependency without license and bundle-size review.

## 15. Immediate next milestone

Milestones 0 and 1 are complete. Begin Milestone 2 without coupling diagnostics to automatic profile detection.

Completed implementation sequence:

1. Add packed React and headless consumer fixtures.
2. Add typed controller events.
3. Add explicit external source replacement policies.
4. Add `useHtmlEditor`.
5. Add the controlled `HtmlEditor` wrapper.
6. Document autosave, controlled state, and profile switching.
7. Release-grade validation of this integration layer before compatibility diagnostics.

The next sequence is the deterministic compatibility report, stable issue codes, controller snapshot integration, and optional diagnostics UI.
