# Open-source readiness

## Current scope

The project is prepared for a public alpha. Core, deck, and React have established package boundaries, documentation, and validation workflows. Application maturity and release readiness remain separate decisions.

## Repository preparation

- [Contributor onboarding](./CONTRIBUTING.md) documents a portable browser setup and focused checks.
- [Architecture](./ARCHITECTURE.md) describes implemented behavior; historical proposals are explicitly separated.
- [Compatibility](./docs/compatibility.md) distinguishes development tools, package runtime, and React peers.
- CI is configured for development builds, runtime consumers, React-major consumers, and the browser matrix.
- API review follows all local declarations reachable from published type entry points.
- [Release guidance](./RELEASING.md) defines coordinated versions, prerelease tags, publication order, verification, and recovery.
- Generated test output is excluded from source control.

These are repository capabilities, not a claim that every configured job has passed on every commit. The release gate is `pnpm release:check` plus successful CI on the exact release commit. Do not carry test totals or coverage percentages forward from an older run.

## Distribution work

Follow the [public release checklist](./docs/public-release-checklist.md) before publishing npm packages. A hosted docs site and showcase are useful distribution work, but are not prerequisites for accepting an alpha contribution.

## Product maturity

Mixed-text wording edits and Bold are implemented. Additional rich-text controls, rich clipboard HTML, generic inspector composition, and multi-file workspaces remain on the [roadmap](./ROADMAP.md). A stable 1.0 promise requires independent integrations, an exercised migration policy, and security/accessibility review.

## Verification records

[Historical reviews](./docs/reviews/2026-09-11-correctness-review.md) contain dated observations and follow-ups. Their counts, failures, and line numbers describe those runs. Current test organization and commands are documented in [tests/README.md](./tests/README.md).
