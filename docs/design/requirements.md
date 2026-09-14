> Historical design document. Retained for context; it includes proposals and superseded decisions. Read the [current architecture](../../ARCHITECTURE.md), [roadmap](../../ROADMAP.md), and [contributor guide](../../CONTRIBUTING.md) for implemented behavior and current work.

# Visual HTML Editor — Product and Technical Requirements

**Status:** Active product requirements  
**Version:** 0.2  
**Date:** August 15, 2026  
**License:** MIT  
**Implementation status:** Alpha implementation in progress; coverage is tracked in [OPEN_SOURCE_READINESS.md](../../OPEN_SOURCE_READINESS.md)

## 1. Product summary

Visual HTML Editor is an open-source, embeddable visual editor for existing HTML.

Developers integrate the editor into their own products and configure what content consumers may view, insert, edit, move, resize, style, or export. Content consumers edit the rendered result directly without needing to understand HTML or CSS.

The core promise is:

> Bring existing HTML, edit it visually, and export HTML without being forced into a proprietary document format.

The initial product is not an AI product. AI systems may use the editor later, but generation and conversational editing are outside the core scope.

## 2. Problem statement

Products frequently store or generate visually rich HTML that later needs safe, nontechnical customization. Existing options typically require one of the following:

1. Editing raw HTML and CSS.
2. Rebuilding content in a proprietary page-builder schema.
3. Limiting users to simple rich-text regions.
4. Accepting destructive HTML normalization during import and export.
5. Building a custom editor separately for each content type.

Representative use cases include:

- Customizing rich HTML email templates.
- Editing HTML-based presentation slides delivered to learners.
- Editing generated landing pages, microsites, reports, and training artifacts.
- Providing tenant-specific branding controls inside a SaaS product.
- Allowing an administrator to make safe changes without involving engineering.

## 3. Product principles

### 3.1 Existing HTML is a first-class input

The editor must accept HTML created outside the editor. It must not require every document to originate from the editor's own component system.

### 3.2 HTML remains the portable output

The editor may maintain internal metadata while active, but exported content must remain usable HTML and CSS without requiring the editor runtime.

### 3.3 Integrators define the rules

The developer integrating the editor—not the content consumer—controls allowed tags, attributes, CSS properties, assets, aspect ratios, breakpoints, toolbar actions, and export behavior.

### 3.4 Visual fidelity and source fidelity are separate requirements

The rendered document must look accurate in the editor. The exported source must also preserve the original document as closely as possible. A visually accurate result is not sufficient if the editor unnecessarily rewrites the source.

### 3.5 Profiles specialize a shared editor kernel

Email, slides, and responsive web content share rendering, selection, editing, history, and export infrastructure. Domain-specific profiles add constraints and behaviors without creating separate editor products.

### 3.6 Safe by default

Untrusted HTML must run in an isolated environment. Dangerous tags, attributes, protocols, scripts, and navigation behavior must be controlled through explicit policies.

### 3.7 Beautiful defaults, headless flexibility

The project must provide a polished default editor interface and allow developers to replace or theme the toolbar, inspector, panels, and controls.

## 4. Users

### 4.1 Integrating developer

The developer embeds the editor, provides HTML, defines policies, handles asset uploads, listens for changes, and stores or publishes the result.

Primary needs:

- Fast installation and a small integration surface.
- Predictable configuration.
- Strong TypeScript support.
- Framework-friendly APIs.
- Control over security and export behavior.
- Ability to theme or replace UI components.

### 4.2 Content consumer

The content consumer visually modifies a document inside the host product.

Primary needs:

- Accurate rendering.
- Familiar click, type, drag, resize, and toolbar interactions.
- Clear indication of editable and locked elements.
- Reliable undo and redo.
- Confidence that edits will not break the document.

### 4.3 Platform administrator

The administrator determines which capabilities are enabled for a tenant, workflow, content type, or user role.

Primary needs:

- Policy enforcement.
- Safe defaults.
- Auditability.
- Optional validation before saving or publishing.

## 5. Goals

### 5.1 Primary goals

- Provide an embeddable visual editing layer for existing HTML.
- Support inline text editing and element-level selection.
- Support configurable image insertion and replacement.
- Support configurable visual style controls.
- Support fixed and responsive viewport modes.
- Support developer-defined aspect ratios and breakpoints.
- Preserve source structure and untouched source regions whenever technically possible.
- Export standalone HTML.
- Provide email, slides, and responsive web profiles.
- Provide a polished public showcase and configuration playground.
- Remain open source and self-hostable.

### 5.2 Secondary goals

- Support custom components and host-defined inspector controls.
- Support framework wrappers beyond React.
- Support multi-document projects and slide collections.
- Support extension packages maintained by the community.

## 6. Non-goals for the initial release

- AI generation or conversational editing.
- Replacing a full application IDE.
- Losslessly editing arbitrary runtime-generated React, Vue, or Angular applications.
- Executing arbitrary third-party JavaScript inside the editor.
- Real-time multiplayer collaboration.
- A hosted content management backend.
- Email delivery or learner delivery infrastructure.
- A full image-design application comparable to Photoshop.
- Guaranteed rendering parity across every historical email client.

## 7. Core conceptual architecture

The product should be designed as one repository containing:

1. **Editor kernel:** document session, policies, commands, history, node mapping, source patches, validation, and export.
2. **Rendering surface:** isolated browser rendering and viewport management.
3. **Interaction layer:** hover, selection, inline editing, movement, resizing, snapping, and keyboard behavior.
4. **Default UI:** toolbar, inspector, layers, viewport controls, source view, and status messaging.
5. **Profiles:** email, slides, and responsive web behavior.
6. **Framework integration:** React first, with a framework-neutral core where practical.
7. **Showcase application:** live demo, configuration playground, examples, and documentation.

The repository should remain a monorepo. Separate repositories are not required.

## 8. Functional requirements

### 8.1 Embedding and lifecycle

**VHE-FR-001** — The editor must be embeddable as a component inside another web application.

**VHE-FR-002** — The initial supported integration must be React with TypeScript.

**VHE-FR-003** — The host must be able to provide the initial HTML as a string.

**VHE-FR-004** — The host must receive document changes through callbacks or events.

**VHE-FR-005** — The host must be able to replace the active document without remounting the entire application.

**VHE-FR-006** — The editor must expose save, export, validation, selection, and dirty-state events.

**VHE-FR-007** — Multiple editor instances must be able to exist on the same page without shared-state collisions.

### 8.2 HTML import

**VHE-FR-010** — The editor must accept complete HTML documents and HTML fragments.

**VHE-FR-011** — Import must preserve the doctype when present.

**VHE-FR-012** — Import must preserve comments, template tokens, custom data attributes, and email conditional comments when permitted by policy.

**VHE-FR-013** — The editor must report unsupported or removed content rather than silently discarding it.

**VHE-FR-014** — The host must be able to choose between rejecting invalid input, sanitizing it, or opening it read-only.

**VHE-FR-015** — Relative assets must have a configurable base URL or host-provided resolver.

**VHE-FR-016** — Multi-file HTML bundles are post-MVP but must not be precluded by the document model.

### 8.3 Rendering

**VHE-FR-020** — Documents must render in an isolated browser surface, such as a sandboxed iframe.

**VHE-FR-021** — Editor UI styles must not leak into the document, and document styles must not leak into the host application.

**VHE-FR-022** — The renderer must support embedded styles, inline styles, remote images, and configurable external stylesheets.

**VHE-FR-023** — Script execution must be disabled by default.

**VHE-FR-024** — Links, forms, downloads, popups, and top-level navigation must be intercepted or blocked by default.

**VHE-FR-025** — The host must be able to provide display-only preview CSS that is never included in export.

**VHE-FR-026** — The editor must provide visible loading, rendering-error, and blocked-content states.

### 8.4 Viewports, responsiveness, and aspect ratios

**VHE-FR-030** — Integrators must be able to define accepted aspect ratios.

**VHE-FR-031** — Integrators must be able to disable custom aspect ratios.

**VHE-FR-032** — The editor must support fixed-canvas dimensions for slides and presentations.

**VHE-FR-033** — The editor must support responsive viewport widths for web and email previews.

**VHE-FR-034** — Integrators must be able to define named breakpoints and viewport presets.

**VHE-FR-035** — The canvas must support zoom, fit-to-screen, actual-size, and centering controls.

**VHE-FR-036** — Changing the viewport must not modify document source unless the user explicitly creates a breakpoint-specific edit.

**VHE-FR-037** — Responsive overrides must identify which breakpoint owns the edited value.

### 8.5 Hover and selection

**VHE-FR-040** — Hovering over an editable element must display a highlight without modifying document source.

**VHE-FR-041** — Clicking an element must select it and expose its relevant controls.

**VHE-FR-042** — Locked, hidden, and non-editable elements must have distinguishable states.

**VHE-FR-043** — The selection overlay must remain aligned during scrolling, zooming, resizing, and document reflow.

**VHE-FR-044** — Selection must support deeply nested elements without forcing the user to use browser developer tools.

**VHE-FR-045** — The user must be able to move selection to a parent, child, or sibling using the UI or keyboard.

**VHE-FR-046** — Multi-selection is post-MVP but should be supported by the command model.

### 8.6 Inline text editing

**VHE-FR-050** — Integrators must be able to enable or disable inline text editing globally and per element.

**VHE-FR-051** — A content consumer must be able to enter text-editing mode through a predictable interaction such as double-click or Enter.

**VHE-FR-052** — Inline editing must preserve nested inline markup where possible.

**VHE-FR-053** — Paste behavior must be configurable as plain text, sanitized rich text, or rejected.

**VHE-FR-054** — The toolbar must reflect the active text selection and formatting state.

**VHE-FR-055** — The initial formatting controls should support bold, italic, underline, strike, links, alignment, lists, text color, and font size when allowed.

**VHE-FR-056** — Template tokens and merge variables must be protected from accidental partial editing when configured as atomic values.

### 8.7 Element manipulation

**VHE-FR-060** — Integrators must be able to enable or disable move, resize, rotate, duplicate, delete, reorder, and reparent operations separately.

**VHE-FR-061** — Movement and resizing must display guides and dimensions.

**VHE-FR-062** — The editor must support configurable snapping to edges, centers, grids, siblings, and container boundaries.

**VHE-FR-063** — Fixed-layout profiles may express movement as position coordinates or transforms.

**VHE-FR-064** — Responsive profiles must not silently convert normal-flow elements into absolute positioning.

**VHE-FR-065** — When an operation is ambiguous in Flexbox or Grid, the editor must use a profile-defined strategy, offer explicit choices, or reject the operation.

**VHE-FR-066** — Element dimensions must support profile-defined units, including pixels, percentages, viewport units, and automatic sizing.

**VHE-FR-067** — The host must be able to mark elements as locked, movable-only, text-only, style-only, repeatable, or deletable.

### 8.8 Images and assets

**VHE-FR-070** — Integrators must be able to enable or disable image insertion and replacement.

**VHE-FR-071** — Integrators must define accepted MIME types and maximum file sizes.

**VHE-FR-072** — The host must provide an optional upload adapter that returns a final asset URL.

**VHE-FR-073** — The editor must support local previews before upload completes.

**VHE-FR-074** — Consumers must be able to insert, replace, resize, crop, and set focal points when those operations are enabled.

**VHE-FR-075** — The editor must support alt text and expose missing-alt validation.

**VHE-FR-076** — Email profiles must support absolute hosted image URLs and optionally forbid embedded data URLs.

**VHE-FR-077** — Slide profiles may support embedded assets or exported asset bundles.

**VHE-FR-078** — Asset insertion must use host-provided authorization and storage; the editor must not require a proprietary asset service.

### 8.9 Toolbar, inspector, and panels

**VHE-FR-080** — The default UI must include a primary toolbar, canvas, and inspector.

**VHE-FR-081** — Developers must be able to configure toolbar actions and their ordering.

**VHE-FR-082** — Developers must be able to add custom toolbar actions and inspector fields.

**VHE-FR-083** — Controls that are disallowed by policy must be omitted or disabled consistently.

**VHE-FR-084** — The inspector must distinguish computed values, inline values, stylesheet values, inherited values, and breakpoint overrides where possible.

**VHE-FR-085** — The editor must provide an optional document tree or layers panel.

**VHE-FR-086** — The editor UI must be themeable through CSS variables or a theme configuration.

**VHE-FR-087** — The host must be able to replace the default toolbar and inspector while retaining the editor kernel.

### 8.10 Developer-defined policy

**VHE-FR-090** — Policies must use allowlists by default.

**VHE-FR-091** — Developers must be able to configure allowed and forbidden HTML tags.

**VHE-FR-092** — Developers must be able to configure allowed attributes, including `data-*` and `aria-*` behavior.

**VHE-FR-093** — Developers must be able to configure allowed CSS properties, units, values, ranges, and keywords.

**VHE-FR-094** — Developers must be able to configure allowed URL protocols and asset origins.

**VHE-FR-095** — Developers must be able to configure operations by selector, element type, custom predicate, and user role.

**VHE-FR-096** — Policy must be enforced during import, paste, direct editing, source editing, commands, and export.

**VHE-FR-097** — Hiding a toolbar action is not sufficient policy enforcement.

**VHE-FR-098** — Policy violations must return structured validation results suitable for display or logging.

### 8.11 History and commands

**VHE-FR-100** — All visual edits must be represented as structured commands.

**VHE-FR-101** — Commands must support undo and redo.

**VHE-FR-102** — Command history must include text, style, structure, asset, viewport-specific, and source edits.

**VHE-FR-103** — The host must be able to group several commands into one undo step.

**VHE-FR-104** — The host must be able to inspect command metadata for audit or analytics purposes.

**VHE-FR-105** — Autosave must be host-controlled and debounced.

**VHE-FR-106** — The editor must expose dirty state relative to a host-defined saved checkpoint.

### 8.12 Source editing and source fidelity

**VHE-FR-110** — Source view must be optional and developer-configurable.

**VHE-FR-111** — Source and visual modes must remain synchronized.

**VHE-FR-112** — Invalid source must not destroy the last valid document.

**VHE-FR-113** — The editor must preserve untouched source ranges byte-for-byte whenever technically possible.

**VHE-FR-114** — Visual edits should produce the smallest practical source patch.

**VHE-FR-115** — Export must not include editor-only IDs, styles, overlays, content-editable attributes, or instrumentation.

**VHE-FR-116** — The editor must preserve unknown but allowed attributes and template syntax.

**VHE-FR-117** — Source normalization must be an explicit fallback mode rather than an undocumented default.

**VHE-FR-118** — The host must be able to select a fidelity mode:

- `preserve`: reject operations that cannot be represented safely as minimal patches.
- `balanced`: prefer minimal patches and permit limited normalization of edited nodes.
- `normalize`: serialize a normalized document when source preservation is not required.

**VHE-FR-119** — The editor must expose the generated source diff before save or export when requested.

### 8.13 Validation

**VHE-FR-120** — Validation must run independently from rendering.

**VHE-FR-121** — The host must be able to run validation on demand and before save or export.

**VHE-FR-122** — Validation results must contain severity, message, node reference, source location when available, and suggested resolution.

**VHE-FR-123** — Profiles must be able to register custom validators.

**VHE-FR-124** — Validation must cover security, policy, accessibility, missing assets, unsupported constructs, and profile-specific rules.

### 8.14 Export

**VHE-FR-130** — The editor must export a complete HTML string.

**VHE-FR-131** — The host must be able to intercept and transform exported HTML.

**VHE-FR-132** — The host must be able to export a single HTML file or a bundle containing assets.

**VHE-FR-133** — Export must be deterministic for the same document state and configuration.

**VHE-FR-134** — Export must run final policy and validation checks.

**VHE-FR-135** — The host must be able to prevent export when blocking validation errors exist.

**VHE-FR-136** — Export transformations such as CSS inlining, asset rewriting, and HTML minification must be optional and profile-controlled.

## 9. Domain profiles

### 9.1 Email profile

The email profile must prioritize safety and compatibility over unrestricted layout manipulation.

Required behavior:

- Preserve table-based layout.
- Preserve inline styles and supported embedded styles.
- Preserve merge tags and template variables.
- Preserve Microsoft Outlook conditional comments.
- Disable scripts, iframes, forms, and unsupported interactive behavior by default.
- Support desktop and mobile preview widths.
- Allow the host to define email-client compatibility rules.
- Support optional CSS inlining during export.
- Require absolute asset URLs when configured.
- Avoid movement operations that would convert table content to absolute positioning.

### 9.2 Slides profile

The slides profile must prioritize fixed-canvas direct manipulation.

Required behavior:

- Support developer-defined aspect ratios such as 16:9, 4:3, and 1:1.
- Support zoom and fit-to-screen.
- Support movement, resizing, rotation, alignment, snapping, ordering, and locking.
- Support images, text boxes, shapes represented through HTML/CSS, and backgrounds.
- Preserve speaker notes and slide metadata when represented in the document model.
- Support ordered multi-slide navigation without remounting the editor shell.
- Support add, duplicate, delete, and reorder operations with structural undo and redo.
- Keep every slide as an independently editable, complete HTML document.
- Provide an experimental Claude Design `<deck-stage>` adapter without making its undocumented format canonical.
- Support standalone HTML export and an asset bundle.
- Permit host-defined learner interaction and tracking attributes.

### 9.3 Responsive web profile

The responsive web profile must prioritize normal-flow layout and breakpoint behavior.

Required behavior:

- Support named viewport widths and breakpoints.
- Expose Flexbox and Grid controls.
- Preserve normal document flow.
- Avoid silently applying absolute positioning.
- Support breakpoint-specific style overrides.
- Support links, images, responsive image attributes, and semantic HTML.
- Support configurable external stylesheets.

## 10. Configuration requirements

The public configuration model must cover at least the following areas:

```ts
interface EditorConfiguration {
  html: {
    allowedTags: string[];
    allowedAttributes: string[];
    allowedCssProperties: string[];
    allowedProtocols: string[];
  };
  capabilities: {
    editText: boolean;
    insertImages: boolean;
    moveElements: boolean;
    resizeElements: boolean;
    rotateElements: boolean;
    editSource: boolean;
  };
  viewport: {
    aspectRatios: Array<{ id: string; width: number; height: number }>;
    breakpoints: Array<{ id: string; width: number }>;
    allowCustomSize: boolean;
  };
  assets: {
    acceptedTypes: string[];
    maxBytes: number;
    upload?: (file: File) => Promise<string>;
  };
  export: {
    fidelity: 'preserve' | 'balanced' | 'normalize';
    transform?: (html: string) => string | Promise<string>;
  };
}
```

The final API does not need to match this exact shape, but all represented capabilities are required.

## 11. Element-level authoring contract

Integrators should be able to define element rules through configuration, selectors, or optional HTML annotations.

Illustrative annotations:

```html
<section data-vhe-locked>
  This section cannot be moved or deleted.
</section>

<h1 data-vhe-editable="text">
  This heading supports text edits only.
</h1>

<div data-vhe-repeatable>
  Children may be duplicated or reordered.
</div>
```

Requirements:

- Annotation names must be configurable or namespaced.
- Editor-only annotations may be removed during export when requested.
- Policies must also work without annotations through selectors and callbacks.
- Annotations must never override stricter host security policy.

## 12. Security requirements

**VHE-NFR-SEC-001** — Untrusted documents must be isolated from the host application.

**VHE-NFR-SEC-002** — Scripts must be disabled by default.

**VHE-NFR-SEC-003** — Event-handler attributes must be blocked by default.

**VHE-NFR-SEC-004** — Dangerous URL protocols must be rejected.

**VHE-NFR-SEC-005** — The document must not navigate or replace the host page.

**VHE-NFR-SEC-006** — Clipboard and drag-and-drop input must pass through policy enforcement.

**VHE-NFR-SEC-007** — Asset upload credentials must remain controlled by the host.

**VHE-NFR-SEC-008** — Export must run security validation even if a control was hidden in the UI.

**VHE-NFR-SEC-009** — Security behavior must have automated tests for known bypass classes.

## 13. Accessibility requirements

**VHE-NFR-A11Y-001** — The editor UI must target WCAG 2.2 AA.

**VHE-NFR-A11Y-002** — Core operations must be keyboard accessible.

**VHE-NFR-A11Y-003** — Selection, locks, errors, and validation states must not rely on color alone.

**VHE-NFR-A11Y-004** — Toolbars and inspector controls must have accessible names.

**VHE-NFR-A11Y-005** — The editor must expose document-level accessibility validation for headings, links, images, contrast, and landmarks where feasible.

**VHE-NFR-A11Y-006** — Inline editing must preserve focus and selection predictably.

## 14. Performance and reliability requirements

Initial performance targets are provisional and should be validated with representative real-world artifacts.

**VHE-NFR-PERF-001** — Opening a typical single-document artifact of up to 500 KB should feel interactive within one second on a modern desktop.

**VHE-NFR-PERF-002** — Selection overlays should track at interactive frame rates during normal dragging and resizing.

**VHE-NFR-PERF-003** — Typing must not cause full iframe reloads.

**VHE-NFR-PERF-004** — History must be bounded to avoid unbounded memory growth.

**VHE-NFR-REL-001** — An invalid edit must not destroy the last valid document state.

**VHE-NFR-REL-002** — Export must be deterministic and covered by snapshot fixtures.

**VHE-NFR-REL-003** — Source-fidelity tests must use real-world email, slide, and responsive page fixtures.

## 15. Browser support

The initial release should support current stable versions of:

- Chrome and Chromium-based browsers.
- Microsoft Edge.
- Firefox.
- Safari.

Mobile browser editing is not required for the first release, but mobile preview is required.

## 16. Open-source repository requirements

- One public monorepo.
- MIT license preferred, subject to final review.
- Clear contribution guide and code of conduct.
- Public roadmap and issue templates.
- Automated tests and build checks.
- Versioned changelog.
- Semantically versioned packages.
- Documentation site generated from repository content.
- Examples that can run without proprietary services.
- No dependency on a paid Visual HTML Editor backend.

## 17. Showcase application requirements

The public showcase is a product surface, documentation tool, and integration reference—not a disposable demo.

It must allow a visitor to:

1. Paste or upload HTML.
2. Select Email, Slides, or Responsive Web.
3. Edit text directly.
4. Select and style elements.
5. Insert or replace images.
6. Switch aspect ratios or viewport widths.
7. Inspect developer configuration.
8. Enable or disable capabilities live.
9. View the source diff.
10. Export the result.
11. Copy a minimal integration example.

The showcase must include representative fixtures for:

- A table-based phishing or notification email.
- A 16:9 learner-training slide.
- A responsive marketing or training page.

## 18. Initial MVP

The first usable release should focus on a single HTML document and include:

### P0 — Required

- React integration.
- Complete document and fragment import.
- Sandboxed rendering.
- Tag, attribute, CSS, protocol, and operation policies.
- Hover and single-element selection.
- Inline text editing.
- Basic text formatting toolbar.
- Image insertion and replacement through a host adapter.
- Style inspector for a configured property set.
- Fixed aspect ratios and responsive viewport presets.
- Move and resize for fixed-layout profiles.
- Undo and redo.
- Optional source view.
- Validation results.
- HTML export.
- Source diff view.
- Email, Slides, and Web presets.
- Public showcase.

### P1 — Important follow-up

- Flexbox and Grid-specific controls.
- Breakpoint-specific overrides.
- Snapping and alignment guides.
- Image crop and focal point.
- Repeating regions.
- Custom inspector controls.
- Additional deck adapters beyond Claude Design and the canonical Visual HTML deck format.
- Asset bundle export.
- Plugin API.

### P2 — Later

- Multi-user collaboration.
- Comments and review workflows.
- Animation timeline.
- Framework source adapters for React or Vue.
- Hosted asset management.
- Email-client screenshot testing integrations.
- Presentation export formats such as PPTX or PDF.

## 19. MVP acceptance criteria

The MVP is acceptable when all of the following are demonstrated:

1. A developer can install and render the editor in a React application using documented configuration.
2. A developer can prohibit tags such as `script`, `iframe`, and `form` and verify that the prohibition cannot be bypassed through paste or source mode.
3. A developer can configure accepted aspect ratios and hide custom sizing from the content consumer.
4. A content consumer can edit text directly in a supplied HTML email.
5. A content consumer can replace an image through a host-provided upload adapter.
6. A content consumer can move and resize an element in a slide profile.
7. A content consumer can switch between configured responsive viewport widths without changing source.
8. Undo and redo restore text, style, image, and structural changes.
9. The editor exports standalone HTML without editor runtime attributes or styles.
10. A source diff demonstrates that untouched regions remain unchanged under preserve mode.
11. Email merge tokens and conditional comments survive a no-op open and export cycle.
12. The showcase demonstrates all three initial profiles.

## 20. Success metrics

Initial success should be measured through product and engineering outcomes rather than repository stars alone.

- Time for a developer to embed the basic editor.
- Percentage of common email edits completed without source editing.
- Percentage of common learner-slide edits completed without engineering assistance.
- No-op import/export source-diff size.
- Number of unsupported constructs reported rather than silently modified.
- Editor crashes or unrecoverable document states.
- Bundle size and initial render time.
- Community adoption, issues, integrations, and external contributors.

## 21. Major technical risks

### 21.1 Source-to-DOM mapping

Browsers normalize HTML during parsing. Runtime DOM nodes must map back to original source locations without using browser serialization as the default export mechanism.

### 21.2 Responsive-layout intent

A visual drag does not uniquely determine the correct Flexbox or Grid source change. The product needs profile-defined strategies and explicit constraints.

### 21.3 Arbitrary JavaScript

Runtime-generated DOM cannot always map back to authored source. The initial product should prioritize static and controlled HTML/CSS artifacts.

### 21.4 Email compatibility

Browser rendering does not guarantee rendering parity in Outlook and other email clients. Email-specific validation and export transforms are required.

### 21.5 Security versus fidelity

Sanitization can conflict with source preservation. The product must report removals and allow the host to choose reject, sanitize, or read-only behavior.

### 21.6 Scope expansion

The project could easily become a website builder, presentation suite, email platform, and IDE simultaneously. The editor kernel and integration use case must remain central.

## 22. Open questions

1. Should the first production profile be Email or Slides?
2. What level of source fidelity is mandatory for the first public release?
3. Should imported `<style>` blocks be patched directly or should edits initially use a generated override stylesheet?
4. How should selectors remain stable when documents do not contain IDs?
5. Should source view be part of the core package or an optional UI extension?
6. Should the initial package be React-only or should the kernel be framework-neutral from day one?
7. Which template syntaxes must be preserved in the first email profile?
8. Which external asset and stylesheet loading policies are required?
9. Which additional deck formats should receive first-party adapters after Claude Design?
10. What representative compatibility fixtures can be included privately in the automated test suite?

## 23. Recommended next decisions

Before implementation resumes, decide:

1. The first production profile: Email or Slides.
2. The minimum acceptable fidelity mode for MVP.
3. Whether the first release supports full documents, fragments, or both.
4. Whether external stylesheets are supported in MVP.
5. The element annotation convention and namespace.
6. The initial public package name and repository name.
7. Which representative documents become golden test fixtures.
8. Which additional slide-deck adapter should follow Claude Design compatibility.
