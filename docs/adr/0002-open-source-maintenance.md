# ADR-0002: Contributor workflow and release maintenance

- **Status:** Accepted
- **Date:** 2026-09-12

## Context

The repository has three publishable packages, but its public documentation mixes
implemented behavior and planned architecture. Contributor browser tests assume
installed Edge, and API snapshots cover re-export lists rather than the declarations
behind them. Releases need one repeatable procedure across dependent packages.

## Decision

- Keep core, deck, and React as the public package boundaries. Extract internal
  React modules without adding package exports or changing component behavior.
- Make `ARCHITECTURE.md` describe the implemented system; retain longer design
  documents under `docs/design` with explicit status and links from the contributor map.
- Use Playwright-managed Chromium by default, with installed Edge available explicitly.
- Review a deterministic snapshot of every local declaration reachable from each
  published type entry point, including subpaths and imported type dependencies.
  This is deliberately conservative: a referenced internal declaration can affect
  a consumer's types even when it is not a named root export.
- Keep the three packages on one version and document prerelease tags, ordered
  publication, verification, and partial-publication recovery.
- Test the declared Node runtime and React peer ranges through packed consumers;
  distinguish package runtime support from development-tool requirements.
- Use the Babel declaration parser for module references rather than TypeScript 7's
  unstable compiler API, and a semantic-version parser for coordinated releases.
  Both are development dependencies already present transitively in the lockfile.
- Configure public metadata from confirmed owner details; never invent reporting
  contacts or treat a configured URL as evidence that reporting is enabled.

## Consequences

Contributors have one entry point and a portable default test command. Public API
reviews show signature changes rather than only export-name changes. CI does more
consumer work, while release commands remain local preparation until a maintainer
explicitly publishes. Historical reviews retain their dated results; current guides
describe executable checks rather than duplicating changing test counts.
