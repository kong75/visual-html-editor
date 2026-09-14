# Security policy

Visual HTML renders and edits user-supplied HTML. Reports affecting preview isolation, source policy, assets, paste, or export deserve prompt review.

## During private development

Repository collaborators should contact the repository owner through their existing private collaboration channel. Do not publish vulnerability details or customer HTML in public issues or discussions. A dedicated public reporting contact has not yet been designated.

Before this repository becomes public, the owner must enable and verify GitHub private vulnerability reporting or publish a monitored private security contact, then replace this section with the working reporting instructions. This is an explicit [public release prerequisite](./docs/public-release-checklist.md).

A report should include a minimal reproduction, the affected package version and profile, expected impact, and any known workaround. Remove credentials and private templates.

## Supported versions

During private development, fixes target the current main branch. After public alpha begins, only the latest published prerelease is supported until a broader support policy is announced. Security fixes may require upgrading.

## Security boundaries

- The default preview disables document scripts and uses a sandboxed iframe.
- Core policy rejects event-handler attributes and disallowed protocols.
- The host owns authentication, authorization, persistence, publishing, and asset credentials.
- Trusted interactive previews require a separate, explicit host mode.

See the [security model](./docs/security.md) for integration guidance.
