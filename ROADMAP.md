# Roadmap

This is the current delivery plan. Historical requirements and sequencing proposals are retained under [docs/design](./docs/design/README.md).

## Implemented alpha foundation

- Core, deck, and React packages with a source-first transaction model.
- Controlled React integration, typed controller events, and external-update policies.
- Mixed-text wording edits and source-preserving Bold formatting.
- Reviewed HTML and deck import, nested layer selection, and drag/resize operations.
- Packed consumer checks, declaration-graph snapshots, package-size budgets, and versioning guidance.
- Configured Chromium, Firefox, and WebKit CI, plus React-major and Node-runtime consumer jobs.
- Contributor documentation and focused internal React modules.

Configured checks describe repository automation; passing release evidence comes from a run on the release commit.

## Alpha follow-up

- Complete the first prerelease cycle and verify packages from the registry.
- Collect real host integrations and representative customer-supplied fixtures.
- Add deterministic compatibility diagnostics for unsupported or partially editable HTML.

## Beta

- Additional built-in rich-text controls for italic, underline, strike, and links; rich clipboard import.
- Layer locking, ordering controls, and interaction customization.
- Composable inspector controls and React primitives.
- External stylesheet policy and multi-file workspace experiments.
- Snapping, alignment guides, rotation, and image crop controls.

## 1.0

- Compatibility and migration commitments exercised by independent integrations.
- Stable extension boundaries.
- Independent security and accessibility review.
- Representative performance characterization beyond the existing browser budget.
