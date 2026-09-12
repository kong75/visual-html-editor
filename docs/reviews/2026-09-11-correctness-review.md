# Correctness and WYSIWYG review — 2026-09-11

## Fix follow-up — 2026-09-12

All nine confirmed findings below have been fixed. The original reproduction notes are retained as historical evidence; their line numbers refer to the reviewed implementation.

| Finding | Resolution |
| --- | --- |
| 1. Resize geometry | Use CSS box dimensions and map pointer deltas through ancestor transforms; preserve the untouched axis. |
| 2. Drag offsets | Preserve computed relative offsets, including right/bottom and percentages, and map movement through containing-block transforms. Defer iframe replacement until native pointer release completes. |
| 3. Omitted end tags | Derive editable inner ranges from parser boundaries for elements with valid optional end tags. |
| 4. Table fragments | Supply the required table parsing context in the preview while preserving canonical source. |
| 5. Responsive image replacement | Replace the source and alt text atomically and clear superseded `srcset`/`sizes` candidates on the image and its picture sources. |
| 6. Text undo/redo | Track active text edits with caret restoration and integrate keyboard and toolbar history with committed source transactions. |
| 7. Mixed text containers | Determine editable regions from their content structure, including inline images, while retaining independent selection of nested layout elements. |
| 8. Standalone formatting roots | Include the root mark in formatting transforms and preserve root attributes when removing it. |
| 9. Unquoted trailing slashes | Share a safe attribute insertion point between source edits and preview instrumentation. |

Regression coverage lives in `tests/wysiwyg-regressions.spec.ts` (26 browser scenarios) and the core parser, projection, image replacement, and root-formatting tests. Package validation, type checking, builds, API snapshots, coverage thresholds, and packed consumer builds pass. The unit suite passes 255 tests; coverage is 92.5% statements and 84.07% branches.

All 78 regression executions pass across Chromium, Firefox, and WebKit (26 per engine). Geometry assertions tolerate the brief iframe replacement between preview and committed source without skipping the final position and undo checks.

The complete Edge suite finished with 78 passed, 5 skipped, and two landing-page failures: insufficient contrast in `.demo-story__number > span` and `.demo-time > i`, and a stale `.landing-motion__selection` assertion. These are in the concurrent landing-page work; all editor scenarios passed. The additional observations below remain follow-up coverage or product decisions, rather than resolved confirmed findings.

## Original review

The project has a useful source-preserving architecture, meaningful automated coverage, and a working main editing loop. It is not yet a dependable general-purpose WYSIWYG editor. Ordinary HTML and CSS cases still cause incorrect geometry, unavailable editing, misleading formatting, or disagreement between the rendered preview and the canonical source.

This review did not change implementation files. Findings below were reproduced in the local editor browser, with source inspection and additional headless core probes. The workspace changed during the review; initial validation failures were fixed by concurrent changes and are not reported as outstanding defects.

## Confirmed findings

### 1. P1 — Resizing counts padding and borders twice

Location: `packages/react/src/visual-html-editor.tsx:1494`.

Load this HTML in Email mode:

```html
<div id="box" style="width:100px;height:50px;padding:20px;border:10px solid black;background:pink">Box</div>
```

Select it, leave inline editing, and drag the resize handle horizontally. At approximately 58% canvas scale, a 12-screen-pixel horizontal drag changed the rendered box from **160 × 110** to **241 × 170**. The saved content dimensions became `width:181px;height:110px`, although there was no vertical drag.

The implementation takes `getBoundingClientRect()` dimensions, which include padding and border, and writes them directly as CSS `width` and `height`. For the default `content-box` sizing model this adds padding and border a second time. Convert pointer movement into the element's CSS coordinate system and account for `box-sizing`. Also cover transformed elements in the regression tests; their bounding rectangles introduce a related mismatch.

### 2. P1 — Dragging discards relative offsets supplied by stylesheets

Location: `packages/react/src/visual-html-editor.tsx:1138`.

In Slides mode, load:

```html
<style>
#box { position:relative; left:100px; top:60px; width:150px; height:100px; background:pink; }
</style>
<div id="box"></div>
```

Drag the box 20 screen pixels to the right. At 42.6% scale its frame coordinates changed from **(108, 68)** to **(55, 8)**. The source gained `position:relative;left:47px;top:0px`. It moved left and up on commit despite a rightward gesture.

For relative positioning the implementation initializes offsets from inline styles and defaults to zero, ignoring the computed `left` and `top`. Preserve existing resolved offsets, including cases driven by `right`/`bottom`, percentages, and containing-block transforms. Verify the committed position against the last preview position.

### 3. P2 — Valid omitted closing tags make text uneditable

Location: `packages/core/src/parser.ts:133`; corresponding UI guard near `visual-html-editor.tsx:1069`.

Examples:

```html
<ul><li id="optional">Optional close<li>Second</ul>
<table><tr><td id="cell">Cell one<td>Cell two</table>
<p>First<p>Second
```

The content renders and reports no validation errors. Double-clicking the first list item does not enable editing; the notice says “This element contains nested markup. Use source mode for this MVP.” The item has no nested markup.

`innerRange` only exists when an explicit end tag exists. Valid HTML end-tag omission therefore disables both the normal text path and the rich-text path. Derive editable content boundaries from parser locations for non-void elements whose end tags can be omitted, and distinguish unsupported boundaries from actual nested-markup limitations.

### 4. P2 — Table fragments lose their table elements in the preview

Location: `packages/core/src/projection.ts:29`.

Load:

```html
<tr id="row"><td id="cell">Cell fragment</td></tr>
```

The outline lists both the row and cell, but the iframe contains **zero `tr` elements and zero `td` elements**. It displays only bare text. Layer selection cannot resolve those source nodes to rendered elements.

The parser indexes this as a fragment, but projection places every fragment directly inside `<body>`. The subsequent document parser discards table-context tags there. Use appropriate preview-only table wrappers for row/cell/section fragments, or explicitly reject unsupported fragment contexts with a useful diagnostic. The existing parser test recognizes `<tr><td>…</td></tr>` but does not verify the resulting browser DOM.

### 5. P2 — Image replacement leaves responsive image candidates active

Location: `packages/react/src/visual-html-editor.tsx:1535` and the image Source inspector.

Load:

```html
<img id="pic" alt="test image" width="200"
     src="/assets/chrome-ribbon.png"
     srcset="/assets/chrome-ribbon.webp 1x">
```

Change the image Source field. The field and `src` attribute update successfully, but `currentSrc` remains the original WebP URL and the image does not change. The file-replacement path likewise changes only `src` and `alt`.

Define replacement behavior for `srcset`, `sizes`, and enclosing `<picture><source>` candidates. A replacement command should either update the responsive sources coherently or explicitly switch the element to the replacement image. It should be one undoable action.

### 6. P2 — Ctrl/Cmd+Z does not undo normal in-place typing

Location: `packages/react/src/visual-html-editor.tsx:497`, `:1321`, and `:1332`.

Load `<p id="undo">Hello</p>`, click it, move to the end, type `XYZ`, then press Ctrl+Z. The browser still displays **HelloXYZ**. Blurring commits HelloXYZ. This was reproduced again against the updated source.

Normal insertion is prevented and replaced with manual Range mutations. Those mutations do not participate in the browser's native editing undo stack. The iframe keyboard handler does not route undo/redo to an editor text history. The toolbar advertises Ctrl/Cmd+Z, but only clicking its Undo button reliably invokes controller history. Implement explicit active-edit history and a coherent handoff to document history on commit; test typing, deletion, paste, line breaks, formatting, and redo while focus stays in the text.

### 7. P2 — Common mixed-text containers cannot be edited as text

Location: `packages/react/src/visual-html-editor.tsx:354`.

Load:

```html
<div id="mixeddiv">Before <strong>bold</strong> after</div>
```

Double-clicking the direct text reports the nested-markup notice. The `div` never becomes contenteditable. The bold child can be edited separately, but the surrounding direct text cannot.

Rich-text eligibility uses a fixed list of outer tags that excludes `div`, `section`, `figcaption`, and standalone mixed inline containers. It also excludes a paragraph with an inline image from the rich-text path. This is a product coverage gap in very common generated HTML, rather than merely a rare malformed-input problem. Determine eligibility using content structure and explicit host constraints, with support for non-text inline objects where appropriate.

### 8. P2 — Removing bold from a standalone strong element adds another strong element

Location: `packages/react/src/visual-html-editor.tsx:428`; `packages/core/src/planner.ts:249`.

Load `<strong id="bold">Bold text</strong>`, click it, select its text with Home then Shift+End, and press Ctrl+B. The Bold control is already active, so the expected operation is to remove bold. Instead the result becomes:

```html
<strong id="bold"><strong>Bold text</strong></strong>
```

The inspector's computed weight changed from 700 to 900 in this browser. The UI's active-mark detection sees the selected root's `<strong>` ancestor, but the core transform only examines the root's inner HTML and concludes the text is unmarked. Align the formatting scope between selection detection and source transformation, and test formatting roots as well as marks inside paragraphs.

### 9. P2 — Runtime instrumentation changes unquoted attribute values ending in a slash

Location: `packages/core/src/projection.ts:6`; analogous insertion logic at `packages/core/src/planner.ts:54`.

Load `<p id="slash" title=folder/>Slash case</p>`. The source parser correctly reads `title` as **folder/**, while the rendered iframe's `title` is **folder**. A headless probe also reproduced the mismatch for `<img src=x/>`: source `src` is `x/`, projected `src` is `x`.

An unquoted attribute can consume the slash in the characters `/>`; those characters alone do not prove a self-closing marker. The current insertion code moves the slash out of the attribute value by inserting the runtime attribute before it. Use token/source-location information to choose a safe insertion point. Preview instrumentation must preserve attribute semantics, not just leave the canonical source untouched.

## Additional observations and remaining coverage

- Typing several normal spaces inserts raw spaces that immediately collapse visually: `A B` plus three spaces and `C` displays `A B C`, while source stores `A B   C`. Decide whether this intentionally follows HTML whitespace semantics or should offer familiar editor spacing behavior.
- Node duplication copies IDs verbatim (`planner.ts:340`). Inspect ID uniqueness, fragment links, ARIA references, and CSS behavior when duplicating components. This is a source-level concern; it was not included among the browser-confirmed findings above.
- Active edits live in the DOM until blur. Add coverage for a host-driven value/profile update, checkpoint, export, or unmount while typing, especially under `replace-when-clean`. Existing committed-edit tests do not establish that pending input is safe.
- Add cases for IME composition, touch selection and scrolling, RTL/bidirectional text, transformed containing blocks, inline images, links crossing selection boundaries, and failed command rollback. These were not comprehensively verified in this review.
- External stylesheets and multi-file assets are already documented limitations. They should be made visible to users during import where they affect preview fidelity.

## Validation and quality assessment

- Type checking and production build passed before the subsequent concurrent showcase edits. This is not a claim that the changing working tree remains buildable at every instant.
- Latest complete unit/integration run: **238 passed** (129 core, 40 deck, 10 React, 59 repository tests).
- The first complete Edge browser run finished with **43 passed, 5 failed, 4 skipped**. Four failures were stale headline/logo assertions; the asset-adapter failure test passed on the later run.
- A second run discovered 58 tests after concurrent additions. It was stopped after the running app began showing a Vite error: `apps/showcase/src/main.tsx` imported `./landing.css`, which did not exist at that time. The subsequent timeouts do not establish new editor regressions. A clean full-suite run is still needed once the concurrent changes settle.
- Four UI assertions still expected the old landing headline or a literal `V` inside the logo. These are stale tests, not evidence that the editor canvas is broken. They nevertheless leave the release check failing and prevent the affected test bodies from reaching their later assertions.
- Firefox, WebKit, packed consumers, mutation testing, and screenshot baseline comparisons were not run in this review. Four Chromium-specific screenshot cases are skipped by the Edge configuration.

The next correctness work should prioritize geometry, source-to-preview equivalence, and coherent text-edit history. The current tests are useful but frequently verify source round trips or expected happy-path markup without asserting that the browser's rendered elements and final geometry still match the user's intended edit.
