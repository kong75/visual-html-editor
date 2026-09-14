# Security policy

Visual HTML renders and edits user-supplied HTML. Reports affecting preview isolation, source policy, assets, paste, or export deserve prompt review.

## Reporting a vulnerability

Use **Report a vulnerability** on the repository's Security tab to open a private report. Do not publish vulnerability details or customer HTML in public issues or discussions.

A report should include a minimal reproduction, the affected package version and profile, expected impact, and any known workaround. Remove credentials and private templates.

## Supported versions

Fixes target the current main branch. Only the latest published prerelease is supported until a broader support policy is announced. Security fixes may require upgrading.

## Security boundaries

- The default preview disables document scripts and uses a sandboxed iframe.
- Core policy rejects event-handler attributes and disallowed protocols.
- The host owns authentication, authorization, persistence, publishing, and asset credentials.
- Trusted interactive previews require a separate, explicit host mode.

See the [security model](./docs/security.md) for integration guidance.
