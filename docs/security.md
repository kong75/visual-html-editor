# Security model

## Default assumptions

- Input HTML may be untrusted.
- The iframe preview is disposable and must not own durable state.
- Script execution is disabled in the default workspace.
- The host application owns authentication, authorization, storage, publishing, and asset credentials.

## Policy is reject-and-report

Visual HTML preserves source fidelity. Existing disallowed markup is reported as validation issues instead of being silently sanitized away. Hosts should block publishing when blocking issues remain.

If your product requires sanitized output, run an explicit sanitizer in a separate import or export pipeline and clearly report transformations to the user.

The same property and URL rules apply to inline styles and declarations inside `<style>` blocks, including nested rules and `@import` URLs. Unparseable CSS and meta refresh redirects produce blocking issues. Stylesheet URLs are checked, but external stylesheet contents are not fetched or validated; hosts that need control over those contents must resolve and validate them separately. Supported template URLs do not exempt an explicit disallowed protocol from validation.

## Host checklist

- Narrow allowed tags, attributes, CSS properties, and protocols.
- Disable source mode for users who do not need it.
- Validate upload MIME type, size, credentials, and returned URLs server-side.
- Store original and edited source using your authorization model.
- Treat exported HTML as untrusted until final product validation completes.
- Do not enable `allow-scripts` in the editor iframe without a separate trusted-preview architecture.
- Test template tokens and conditional comments used by your system.

## Current limitations

The project has not completed an independent security audit. Before a high-risk public deployment, add product-specific bypass fixtures and review the complete import, preview, asset, paste, source-mode, and export pipeline.
