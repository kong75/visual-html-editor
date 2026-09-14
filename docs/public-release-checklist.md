# Public release checklist

Complete the repository items before changing visibility. Complete the package items
before publishing the first npm prerelease.

- [ ] Confirm ownership of the `@visual-html` npm scope and availability of all four package names.
- [ ] Enable and verify GitHub private vulnerability reporting.
- [ ] Review repository history and third-party notices before changing visibility.
- [ ] Confirm the final public repository URL and package `repository`, `homepage`, and `bugs` metadata.
- [ ] Configure main-branch protection and required CI checks using the actual hosted job names.
- [ ] Enable the intended support channels and verify their issue forms and links.
- [ ] Configure and verify the npm publication identity and a provenance-capable publishing environment for the public repository.
- [ ] Complete `pnpm release:check` and CI on the exact release commit, including both React-major packed consumers.
- [ ] Complete the first prerelease and registry-install verification described in `RELEASING.md`.

Do not infer scope ownership from package names or successful local packing. Hosting
a showcase or documentation site can be planned separately; no deployment domain is
required to review contributions.
