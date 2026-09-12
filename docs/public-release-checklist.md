# Public release checklist

The owner has chosen private repository development first. The items below are
intentionally unresolved until a public launch is authorized. They do not prevent
collaboration in the private repository.

- [ ] Confirm ownership of the `@visual-html` npm scope and availability of all three package names.
- [ ] Publish maintainer identities, a monitored conduct contact, and an alternate escalation contact.
- [ ] Enable and verify GitHub private vulnerability reporting, or publish a monitored private security contact; update `SECURITY.md` with actual instructions.
- [ ] Review repository history and third-party notices before changing visibility.
- [ ] Confirm the final public repository URL and package `repository`, `homepage`, and `bugs` metadata.
- [ ] Configure main-branch protection and required CI checks using the actual hosted job names.
- [ ] Enable the intended support channels and verify their issue forms and links.
- [ ] Configure and verify the npm publication identity and a provenance-capable publishing environment for the public repository.
- [ ] Complete `pnpm release:check` and CI on the exact release commit, including both React-major packed consumers.
- [ ] Complete the first prerelease and registry-install verification described in `RELEASING.md`.

Do not infer scope ownership from package names or successful local packing. Do not
publish from this private preparation task. Hosting a showcase or documentation site
can be planned separately; no deployment domain is required to review contributions.
