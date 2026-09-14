# ADR-0003: Bundled local-file editor CLI

- **Status:** Accepted
- **Date:** 2026-09-12

## Context

The showcase proves the editor with curated documents, but evaluators need a low-friction way to test source fidelity and compatibility with HTML they already own. Installing the React packages and writing a host first makes that evaluation too expensive. Copying showcase samples into a user's project would also blur the boundary between demonstration content and the reusable product.

## Decision

Publish `@visual-html/editor` as a fourth coordinated package. Its single executable starts a loopback-only HTTP server, serves one HTML file and assets within that file's folder, and opens a bundled React workspace. The browser writes the original file only after the user chooses **Save file**. The CLI bundle contains no showcase samples and adds no dependency to the target project.

This decision supersedes the three-package boundary and coordinated-version wording in ADR-0002; its contributor, API-review, compatibility, and release-safety decisions remain in effect.

Relative preview resources use the React `baseUrl` contract. The core hardening layer accepts only absolute HTTP(S) base URLs, removes any authored `base` element from the runtime projection, and keeps the base out of canonical export.

## Consequences

Evaluators can run `npx @visual-html/editor ./document.html` after publication. Releases gain one tarball, package-name ownership check, packed-size budget, and registry smoke test. The CLI intentionally edits one file at a time; storage integrations, multi-file workspaces, and publishing pipelines remain host responsibilities.
