# Versioning and API stability

Visual HTML follows semantic versioning after packages are published.

During `0.x` releases:

- Public APIs may evolve, but changes require a changelog entry and API snapshot review.
- Prefer additive changes and documented deprecations over removals.
- A deprecated API should remain available through at least one subsequent minor prerelease unless it creates a security or correctness risk.
- Source fidelity, export cleanliness, and policy enforcement are compatibility promises even before 1.0.

Every release candidate must pass packed consumer installation, declaration resolution, package linting, unit tests, and browser tests.

## Coordinated package versions

Core, deck, editor CLI, and React share one release version. Use `pnpm release:version <exact-semver>` to update all four and the private root. Prereleases use the `next` dist-tag. See the [release procedure](../RELEASING.md) for exact preparation, publishing, and recovery steps.

Public API review snapshots the full reachable declaration graph, including subpath entries and types behind re-exports. Run `pnpm api:update` only for intentional changes and include the resulting diff in review. Current support ranges and tested reference versions are documented in [compatibility](./compatibility.md).
