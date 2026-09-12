# Visual HTML Editor test cases

## Test strategy

The alpha is checked at five levels:

1. **Package unit tests** prove exact source preservation, minimal patching, stable node identity, policy enforcement, transactions, and history.
2. **Repository fixture and property tests** exercise realistic AI-generated HTML, deterministic fuzz cases, and hostile-input matrices.
3. **Cross-browser tests** prove that the React adapter, iframe projection, toolbar, inspector, security boundary, accessibility semantics, generated-content fixtures, and profile configuration work together in Chromium, Firefox, and WebKit.
4. **Browser quality tests** enforce host accessibility, a large-document response budget, maintained visual baselines, touch input behavior, and a packed clean-consumer runtime.
5. **Hands-on Edge regression** checks visual quality, responsive behavior, focus handling, pointer interactions, and browser-console cleanliness.

## Automated core cases

| ID | Behavior | Expected result |
| --- | --- | --- |
| CORE-01 | Create and export without edits | Export is byte-for-byte identical to input HTML. |
| CORE-02 | Edit leaf text | Only the inner source range changes. |
| CORE-03 | Reparse after a patch | Unchanged elements retain their opaque NodeKeys. |
| CORE-04 | Add or update an attribute | Source quoting and surrounding markup remain intact. |
| CORE-05 | Change one or many inline styles | One atomic transaction updates the style attribute. |
| CORE-06 | Use a disallowed CSS property | Command is rejected by the active profile. |
| CORE-07 | Undo and redo | Forward and inverse patches restore exact source states. |
| CORE-08 | Dispatch against a stale revision | Command fails with a revision conflict. |
| CORE-09 | Build runtime projection | Runtime node markers appear only in the iframe projection. |
| CORE-10 | Validate disallowed source | A blocking issue prevents export. |
| CORE-11 | Insert an image | A source-backed image with alt text is inserted. |
| CORE-12 | Extend an editor profile | Overrides merge defensively without mutating the preset. |
| CORE-13 | Define an invalid profile | Invalid viewport configuration fails before an editor is created. |
| CORE-14 | Subscribe to typed lifecycle events | Transactions, revisions, dirty state, validation, profile changes, and rejections emit structured events once. |
| CORE-15 | Replace external HTML with an explicit policy | Replace, ignore-when-dirty, and reject-when-dirty behavior preserve the documented source and history state. |
| CORE-16 | Toggle an inline mark across mixed markup | Existing inline tags and character references are preserved while the selected text gains or loses balanced `<strong>` markup. |
| CORE-17 | Apply a disallowed inline mark | The command is rejected by the active profile without changing source. |
| CORE-18 | Edit wording inside mixed inline markup | Changed text nodes receive minimal escaped patches, existing inline source syntax remains intact, and undo/redo restore exact states. |
| DECK-01 | Add, duplicate, remove, and reorder slides | Ordered slide state changes predictably and retains a valid active slide. |
| DECK-02 | Undo and redo structural deck operations | Slide ordering and removed slide content are restored without discarding later slide-source edits. |
| DECK-03 | Serialize a deck | Canonical JSON round-trips without changing slide HTML. |
| DECK-04 | Import Claude Design HTML | Direct-child `<deck-stage>` sections and speaker notes become independent HTML slides. |
| DECK-05 | Export Claude-compatible HTML | Slides become direct-child sections with notes and a standalone navigation runtime. |

## Automated browser cases

| ID | Behavior | Expected result |
| --- | --- | --- |
| UI-00 | Open the product landing page | A motion-led product illustration appears without mounting the editor; the primary route opens the dedicated editor workspace. |
| UI-01 | Load showcase | Email canvas renders in a sandboxed same-origin iframe with no validation issues. |
| UI-02 | Click a canvas element | Selection overlay and matching inspector appear. |
| UI-03 | Click leaf text once | A caret appears immediately and inline editing commits to source on blur. |
| UI-04 | Undo and redo text | Canvas and source move backward and forward consistently. |
| UI-05 | Edit typography and box shorthand values in inspector | Computed canvas styles and source attributes update without requiring per-side expansion. |
| UI-06 | Duplicate or delete an element with keyboard commands | `Ctrl/Cmd+D` and Delete/Backspace update source-backed elements and remain undoable without adding canvas controls. |
| UI-07 | Switch Email, Slides, and Web profiles | Profile-specific content, controls, and viewports load. |
| UI-08 | Change aspect ratio | The iframe keeps the exact configured logical viewport while the canvas scales proportionally inside the shared-height workspace. |
| UI-09 | Click text in a draggable profile | A short click edits immediately without activating a drag. |
| UI-10 | Press and drag a slide element | Movement beyond the drag threshold previews movement; pointer release commits one atomic position or size transaction. |
| UI-11 | Insert an image file | A source-backed data URL image appears with generated alt text. |
| UI-12 | Replace source in source mode | The visual projection reparses and renders the new document. |
| UI-13 | Export valid HTML | Browser downloads a profile-named HTML file and reports success. |
| UI-14 | Add a disallowed script tag | Preview remains sandboxed and export is blocked by policy. |
| UI-15 | Select a flex container | Typography, Size, Layout, and Box groups appear; box-model rows expand to side-specific controls. |
| UI-16 | Open both routes at mobile width | Landing content remains legible and the editor stacks the canvas above the contextual sidebar without losing functionality. |
| UI-17 | Switch document profiles | The existing editor shell remains mounted while only the active controller and profile-specific panels change. |
| UI-18 | Navigate a slide deck | Selecting a thumbnail swaps only the active slide and preserves cached per-slide history. |
| UI-19 | Manage slide collection | Add, duplicate, delete, and reorder update the thumbnail rail and active canvas. |
| UI-20 | Export a slide deck | Browser downloads standalone `<deck-stage>` HTML containing every slide and speaker-notes JSON. |
| UI-21 | Navigate with the component selector | Tree selection updates the canvas and canvas selection reveals the active tree branch. |
| UI-22 | Select nested and overlapping elements | Alt-click cycles the hit stack, while dragging a selected rear layer is not stolen by the front layer. |
| UI-23 | Use the controlled React API | One transaction produces one host change, dirty and validation callbacks update, selection is reported, and external values do not recreate the controller. |
| UI-24 | Bold a selection across mixed inline markup | Toolbar and `Ctrl/Cmd+B` produce source-backed balanced `<strong>` tags, preserve existing markup, and restore the selection. |
| UI-25 | Load generated email, slide, report, and fragment fixtures | Each fixture renders, edits source-backed text, preserves template/vendor tokens, and exports no editor metadata. |
| UI-26 | Reject invalid image files and host upload failures | Non-images, files over 10 MB, and rejected asset-adapter uploads leave source unchanged and expose an actionable notice. |
| UI-27 | Receive controlled external HTML while dirty | Reject and ignore policies preserve the local edit and report a typed outcome to the host. |
| UI-28 | Audit representative application states with axe-core | Landing, visual, selected-element, source, and controlled states have no serious or critical WCAG 2.0/2.1 A/AA host-shell violations. |
| UI-29 | Load and select inside a 200-card generated document | Rendering completes within 12 seconds and selecting the last heading completes within 3 seconds. |
| UI-30 | Compare maintained visual baselines | Landing illustration, toolbar, selected-element inspector, and import confirmation remain within the configured Chromium pixel-difference tolerance. |
| UI-31 | Drag and resize slide content with touch input | Touch-pointer gestures commit source-backed position and size values in Chromium. |
| UI-32 | Run the packed React package in a clean consumer | Published tarballs install, boot, render, edit, and expose updated source without workspace aliases. |
| UI-33 | Import a single HTML document | A reviewed confirmation identifies the file and unsaved work; confirmation replaces source as one undoable host-visible transaction. |
| UI-34 | Import a Claude-style HTML deck | The adapter previews slide count and warnings, atomically replaces the deck, updates its title, and navigates every imported slide. |
| UI-35 | Reject invalid HTML imports | Wrong extensions, files over 5 MB, and HTML incompatible with the active adapter leave current work unchanged and show an actionable notice. |
| UI-36 | Inspect imported email-table hierarchy | Browser-inserted virtual table wrappers remain hidden while source-backed tables, rows, cells, nested tables, and text descendants remain visible and selectable. |
| UI-37 | Edit an imported email CTA link | Native link semantics keep the anchor selected instead of its parent cell, while generic cascade-safe styling appends `background-color` after an existing `background` shorthand. |
| UI-38 | Edit wording inside mixed inline markup | Typing, deletion, and plain-text paste preserve inline styles, commit one source-backed wording transaction, remain undoable, and export no runtime or clipboard markup. |

## Manual Edge regression checklist

- Canvas and inspector remain usable at 1440 px, 900 px, and 620 px browser widths.
- Selection overlays stay aligned after scrolling and viewport changes.
- Slide elements drag directly from the canvas without a dedicated Move button, and resize previews commit once on pointer release.
- Nested and overlapping layers remain selectable through Alt-click, including at scaled canvas sizes.
- Image insertion, rejection notices, and host asset-adapter behavior remain visually coherent.
- Keyboard focus is visible; Escape exits inline text editing.
- Anchor clicks in the preview do not navigate the host application.
- No uncaught errors or policy violations appear in the Edge console.
- Exported source contains no `data-vhe-node` or other editor-only metadata.
