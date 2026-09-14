# ADR-0004: Application-owned React source distribution

- **Status:** Accepted
- **Date:** 2026-09-14

## Context

The compiled `@visual-html/react` package provides a small supported integration surface, but products commonly need to change an editor's layout, controls, and browser interactions more deeply than stable extension props permit. Requiring each product to reimplement the canvas integration or maintain a repository fork makes adoption and contribution unnecessarily expensive.

Publishing every internal React module as a stable package API would prematurely commit the project to component boundaries that have not yet been validated by independent integrations. Copying the framework-neutral source engine into applications would also fragment security, validation, and source-fidelity fixes.

## Decision

Extend the `@visual-html/editor` executable with a source registry workflow. `visual-html init` records an application-relative destination and `visual-html add editor` copies the complete non-deck React workspace and stylesheet into that destination. The generated workspace depends on the versioned `@visual-html/core` engine and directly declares its third-party UI dependencies.

The registry is generated from `packages/react/src` during tests, builds, and package creation so the compiled and source-owned workspaces share one implementation. Deck-only modules are excluded from the initial item. The generated entry point imports its stylesheet and omits deck exports.

Installations record hashes in `.visual-html/registry-lock.json`. `diff` compares installed, local, and current registry hashes. `update` replaces only files that still match their installed hashes; it preserves modified, deleted, and upstream-removed files. Explicit `--overwrite` remains available for intentional replacement.

## Consequences

Applications can own and modify the complete React interface without forking this repository, while core fixes continue to arrive through normal dependency updates. Copied React modules are application code, not stable library extension points, so consumers own their modifications and review update conflicts. The release package grows by the compressed registry source and packed-consumer tests must compile a generated installation. Independently installable canvas, inspector, toolbar, and deck items remain future boundary work informed by actual integrations.
