# Releasing

The repository is currently private. **Public npm publication is deferred** until the owner completes the [public release checklist](./docs/public-release-checklist.md). Preparing versions, builds, and tarballs is safe to do privately; none of the preparation commands publishes, creates a tag, or changes repository visibility.

## Version policy

Core, deck, the editor CLI, and React use one coordinated version, including prerelease suffixes. The private root manifest uses the same version for tooling. The private showcase is not published and does not need a coordinated version.

Use `0.1.0-alpha.1`, `0.1.0-alpha.2`, and so on for the first alpha cycle. Publish prereleases to the `next` dist-tag. Use `latest` only for a deliberately approved non-prerelease release. Breaking changes need migration notes even during `0.x`.

## Prepare a release commit

1. Start from an up-to-date, clean checkout of `main`. Confirm the intended changes are reviewed.
2. Set all release versions with one command:

   ```bash
   pnpm release:version 0.1.0-alpha.1
   pnpm install --lockfile-only
   ```

3. Move the relevant `Unreleased` changelog entries into a dated `0.1.0-alpha.1` section. Include migration guidance and any narrowed support requirements. Keep a new `Unreleased` section for subsequent work.
4. Install and validate:

   ```bash
   pnpm install --frozen-lockfile
   pnpm exec playwright install chromium firefox webkit
   pnpm release:check
   pnpm exec cross-env VHE_TEST_REACT_MAJOR=18 pnpm test:e2e:packed:prepare
   ```

   On Linux use `--with-deps` when installing browsers. `release:check` covers docs, versions, maintenance scripts, unit tests, types, builds, coverage, declaration graphs, package lint, packed consumers, runtime smoke tests, and the full browser matrix. Mutation checks run separately with `pnpm test:mutation` when engine/security changes warrant them.
5. Review the complete diff, including `api/` and package manifests. Commit the release preparation through a pull request. Wait for CI on the final release commit, including Windows/Linux builds, the Node runtime matrix, and both React packed consumers. Local success is not a substitute for those jobs.

## Tag and rebuild the exact source

After that commit is merged and CI passes, create an annotated tag on it:

```bash
git switch main
git pull --ff-only
git tag -a v0.1.0-alpha.1 -m "Visual HTML 0.1.0-alpha.1"
git push origin v0.1.0-alpha.1
```

Publish only from a provenance-capable runner checking out that tag. The runner must use the committed lockfile, Node 24.11.1, pnpm 12.4.1, and npm 11.5.1 or newer. Use GitHub Actions with `contents: read` and `id-token: write`, and configure the matching npm trusted publisher before using OIDC. Initial package registration or alternate publishing credentials remain owner setup work.

npm provenance requires a public source repository and matching package repository metadata. This is why publication is not part of private preparation. See npm's [trusted publishing instructions](https://docs.npmjs.com/trusted-publishers/) and [provenance requirements](https://docs.npmjs.com/generating-provenance-statements/).

In that runner, rebuild and pack from the release tag:

```bash
pnpm install --frozen-lockfile
pnpm test:consumers
pnpm test:api
pnpm test:types
```

`test:consumers` produces exactly these tarballs for the example version under `.artifacts/consumer-tests/tarballs/`:

- `visual-html-core-0.1.0-alpha.1.tgz`
- `visual-html-deck-0.1.0-alpha.1.tgz`
- `visual-html-editor-0.1.0-alpha.1.tgz`
- `visual-html-react-0.1.0-alpha.1.tgz`

Inspect each with `tar -tzf <tarball>` and `npm publish <tarball> --dry-run`. They should contain built code, declarations, README, license, and package metadata. Workspace dependencies must have been rewritten to the coordinated version. Preserve the verified tarballs as release-run artifacts.

## Publish in dependency order

The following commands are publication operations for an authorized public release, not preparation commands. Run them in the configured runner only after the preceding gates pass:

```bash
npm publish .artifacts/consumer-tests/tarballs/visual-html-core-0.1.0-alpha.1.tgz --access public --provenance --tag next
npm publish .artifacts/consumer-tests/tarballs/visual-html-deck-0.1.0-alpha.1.tgz --access public --provenance --tag next
npm publish .artifacts/consumer-tests/tarballs/visual-html-react-0.1.0-alpha.1.tgz --access public --provenance --tag next
npm publish .artifacts/consumer-tests/tarballs/visual-html-editor-0.1.0-alpha.1.tgz --access public --provenance --tag next
```

Core and deck are independent; publish both before React, which depends on them. Publish the bundled editor CLI after React. Stop on the first failure. Do not run a recursive publish that obscures which packages succeeded.

## Verify the registry release

```bash
npm view @visual-html/core@0.1.0-alpha.1 version dist.integrity repository
npm view @visual-html/deck@0.1.0-alpha.1 version dist.integrity repository
npm view @visual-html/react@0.1.0-alpha.1 version dist.integrity repository
npm view @visual-html/editor@0.1.0-alpha.1 version dist.integrity repository bin
npm view @visual-html/react@0.1.0-alpha.1 dependencies
npm view @visual-html/core dist-tags
npm view @visual-html/deck dist-tags
npm view @visual-html/react dist-tags
npm view @visual-html/editor dist-tags
```

Use a new directory outside the monorepo to install the registry versions together with matching React and React DOM versions. Run the core/deck scenario from `tests/consumers/runtime/index.mjs`, then compile and run the React/Vite consumer using registry versions instead of tarball placeholders. Run `npx @visual-html/editor ./document.html --no-open` against a disposable document and verify load, relative assets, and explicit save. Confirm provenance appears on npm. Create release notes from the versioned changelog and link the exact Git tag only after all four packages are usable.

## Partial-publication recovery

Publication is not atomic across packages, and a published version cannot simply be overwritten.

1. Stop and record the commit, tarball artifacts, successful packages, and full error.
2. Query each exact version with `npm view` before retrying. A timeout is not proof that publication failed.
3. Compare any existing registry `dist.integrity` with the saved tarball's SHA-512 integrity. For example:

   ```bash
   node --input-type=module -e "import{readFileSync}from'node:fs';import{createHash}from'node:crypto';console.log('sha512-'+createHash('sha512').update(readFileSync(process.argv[1])).digest('base64'))" .artifacts/consumer-tests/tarballs/visual-html-core-0.1.0-alpha.1.tgz
   ```

4. If an existing package matches, skip it and publish only the missing packages from the same verified artifacts, in order. Fix authentication or transient registry failures before retrying.
5. If source, dependencies, or package contents must change, prepare a new coordinated version and release commit. Do not retag the old commit or try to overwrite an existing version. Document the incomplete prerelease and complete registry verification for its replacement.
6. If a dist-tag was changed incorrectly, restore it explicitly to the last known complete release with `npm dist-tag add @visual-html/<package>@<known-version> next`. Verify all four tags before announcing completion.

