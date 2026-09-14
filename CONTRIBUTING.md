# Contributing

Contributions are welcome during the public alpha. Read the [contributor map](./docs/contributor-map.md) before making a broad change.

## Development setup

Use Node.js 24.11.1 (pinned in `.nvmrc`) and pnpm 12.4.1. The development toolchain also supports the Node 22 line starting at 22.18.0. Package runtime requirements are different; see [compatibility](./docs/compatibility.md).

```bash
npm install --global pnpm@12.4.1
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm dev
```

Open `http://127.0.0.1:4173/#/editor`. On Linux, install browser system dependencies with `pnpm exec playwright install --with-deps chromium`. The browser download is needed for tests, not for starting the application.

`pnpm test:e2e` uses Playwright-managed Chromium on Windows, macOS, and Linux. To use an already installed Microsoft Edge, run `pnpm test:e2e:edge` explicitly.

## Before opening a pull request

```bash
pnpm check
pnpm test:e2e
```

`pnpm check` validates documentation links, coordinated versions, maintenance scripts, TypeScript, unit/integration tests, builds, and package metadata. Browser scenarios verify rendered interactions. Add a regression test for a behavioral change; documentation-only changes normally need `pnpm check:docs`.

For public API changes, run `pnpm api:update`, review the complete declaration diff in `api/`, and update the relevant package guide and changelog. Do not update snapshots just to silence an unexpected failure.

Before release or after a change affecting browser portability:

```bash
pnpm exec playwright install chromium firefox webkit
pnpm release:check
```

See [test architecture](./tests/README.md) for focused commands, visual baseline updates, React compatibility consumers, coverage, and mutation testing. CI checks both supported React majors, the minimum Node runtime, and Windows/Linux development builds.

## Architectural invariants

- Authored source is canonical; never export the live iframe DOM as the document.
- Durable changes go through typed source commands and transactions.
- Security and profile policy are enforced in core, not only by hiding UI controls.
- Runtime markers and editor styles must not appear in exported HTML.
- Core and deck remain framework-neutral.
- Domain-specific behavior belongs in configuration or a narrow adapter.

## Review expectations

Keep a pull request focused. Explain the user or integration problem, the chosen design, and how it was verified. Public API changes need a changelog entry; breaking changes need a migration note. Changes to architecture, package responsibilities, security boundaries, or major dependencies need an [ADR](./docs/adr/README.md).

New dependencies need a clear reason, compatible licensing, and package-size consideration. Follow the surrounding TypeScript style and `.editorconfig`; avoid repository-wide formatting changes in behavioral PRs.

Tests write generated traces, screenshots, and consumer tarballs to ignored output directories. Commit maintained baselines only under `tests/snapshots`, never local `test-results*` output.

Handle vulnerability reports according to the [security policy](./SECURITY.md).
