# Test architecture

Visual HTML treats source safety as a product feature. The suite is split by responsibility so new contributors can extend one layer without coupling it to the editor showcase.

## Layers

### Package unit tests

Location: `packages/*/src/*.test.ts`

These tests stay close to framework-neutral implementation details: parsing, source patches, commands, events, history, deck operations, and inline-mark transformations.

Run with:

```bash
pnpm -r test
```

### Repository integration and property tests

Location: `tests/unit/*.test.ts`

- `source-fidelity.test.ts` runs the public compatibility corpus through no-op export, minimal editing, undo/redo, and mixed-text formatting.
- `rich-text-properties.test.ts` uses deterministic seeds to generate nested inline HTML, entities, emoji, and template tokens.
- `security-policy.test.ts` verifies hostile source diagnostics and command-level rejection.

Run with:

```bash
pnpm test:repo
pnpm test:coverage
pnpm test:mutation
```

The coverage command combines core, deck, repository, and controlled React lifecycle tests. It enforces 90% statements, 80% branches, 95% functions, and 92% lines across the measured public-risk modules. Raise thresholds deliberately as coverage improves; do not lower them to merge unrelated work.

`pnpm test:mutation` mutates the source patcher and runtime/security policy modules. It is intentionally bounded so contributors can run it locally, and it runs weekly plus on demand in GitHub Actions. Mutation failures should be addressed by strengthening assertions or documenting a genuinely equivalent mutant—not by excluding ordinary logic.

### Browser tests

Locations:

- `tests/showcase.spec.ts` — primary editing and integration workflows.
- `tests/security.spec.ts` — hostile paste, source validation, export blocking, and iframe isolation.
- `tests/accessibility.spec.ts` — accessible names, landmarks, keyboard focus, Escape behavior, and compact target sizing.
- `tests/accessibility-audit.spec.ts` — automated WCAG 2.0/2.1 A and AA checks for the landing page and host editor states.
- `tests/generated-content.spec.ts` — render-and-edit coverage for the compatibility corpus of generated email, slides, reports, and fragments.
- `tests/resilience.spec.ts` — invalid assets and HTML files, host upload failures, incompatible deck imports, and controlled external-update conflicts.
- `tests/performance.spec.ts` — a browser responsiveness budget for a 200-card generated document.
- `tests/touch.spec.ts` — touch-pointer drag and resize behavior.
- `tests/visual-regression.spec.ts` — stable Chromium snapshots for the landing illustration, toolbar, selected-element inspector, and HTML import confirmation.
- `tests/editing-demo.spec.ts` — guided showcase playback and controls.
- `tests/wysiwyg-regressions.spec.ts` — source/rendering agreement and editing regressions.

The suite includes editing demos and WYSIWYG regression scenarios in addition to the integration and quality checks above. Run `pnpm exec playwright test --list` for the current inventory. Test totals belong to dated run output, not a permanent support promise.

Install and run the default managed Chromium browser:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

Use `pnpm test:e2e:edge` only when Microsoft Edge is installed. On Linux add `--with-deps` to the browser installation command if needed.

Run the supported browser matrix:

```bash
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e:all
```

CI runs Chromium, Firefox, and WebKit. The packed React browser consumer additionally covers React 18.2.0 and 19.0.0, and a separate packed runtime consumer covers Node 20.19.0, 22.18.0, and 24.11.1. See [compatibility](../docs/compatibility.md). Browser-specific failures must be fixed or documented through an explicit support decision; tests should not silently branch around an engine.

Automated accessibility audits cover the application shell. They intentionally exclude the sandboxed consumer-document iframe because hosts control that HTML and should run content-specific accessibility validation before publishing it.

To update the maintained Chromium visual baselines after an intentional design change:

```bash
pnpm exec cross-env VHE_E2E_BROWSER=chromium playwright test tests/visual-regression.spec.ts --update-snapshots
```

### Packed-package browser test

Location: `tests/packed/react-package.packed.ts`

This test builds and packs the publishable packages, installs them into a clean Vite consumer, starts that consumer, and verifies that the shipped React editor can render and commit an edit without workspace aliases.

```bash
pnpm test:e2e:packed:prepare
```

## Compatibility corpus

Location: `tests/fixtures/compatibility`

The manifest describes each fixture's profile, source tokens that must survive, a leaf-text edit target, and an optional mixed-rich-text selection. Fixtures should represent HTML that products genuinely receive, including:

- email tables and conditional comments;
- fixed-canvas slide HTML;
- responsive documents and media queries;
- merge tags and template expressions;
- nested inline formatting and character references.

To add a fixture:

1. Save the smallest representative HTML file under the relevant scenario directory.
2. Add one entry to `manifest.ts`.
3. Include stable element IDs only where the test needs an edit target.
4. List template or vendor tokens that must remain byte-preserved.
5. Avoid normalizing the fixture before committing it—the original formatting is part of the test.

## Deterministic fuzzing

Property tests use an in-repository seeded generator rather than non-repeatable randomness. A failure reports its seed, which must reproduce the exact HTML and selection. Add the failing seed as a named regression when it represents a distinct edge case.

## Test-writing rules

- Assert exact source when fidelity is the behavior under test.
- Assert rendered semantics when multiple source forms are valid.
- Test both command rejection and unchanged source for policy failures.
- Every new source mutation should have undo coverage.
- Browser tests should prefer roles and accessible names over implementation selectors.
- Never weaken a security or accessibility assertion merely to make another feature pass.

## Maintenance checks

Clock-driven demo tests pause automatic time advancement before loading the app and
advance the JavaScript playhead explicitly. Decorative CSS transitions are disabled
in those tests because they do not share that clock. Full multi-chapter sequences
have a 60-second test deadline; the separate editor performance budgets are unchanged.

`pnpm test:tooling` tests the public declaration graph checker and coordinated version preparation. `pnpm check:docs` checks local Markdown file destinations (not external URLs or fragment IDs). `pnpm check:versions` checks the coordinated release manifests. All run in `pnpm check`.

`pnpm test:runtime` uses already packed tarballs from `pnpm test:consumers` and executes core/deck operations in a clean npm consumer with engine checks enabled. CI downloads those tarballs into the minimum-Node runtime job without installing the development toolchain.

Run `pnpm exec cross-env VHE_TEST_REACT_MAJOR=18 pnpm test:e2e:packed:prepare` to exercise the React 18 minimum locally. The default is React 19. Generated traces and consumer output are ignored; maintained pixel baselines belong under `tests/snapshots`.
