# `@visual-html/core`

Framework-neutral source engine for Visual HTML.

```ts
import { EditorController, emailProfile, extendEditorProfile } from '@visual-html/core';

const profile = extendEditorProfile(emailProfile, {
  id: 'my-email',
  capabilities: { editSource: false }
});

const controller = await EditorController.create({ html, profile });
controller.on('transactionCommitted', ({ description, revision }) => {
  console.log(description, revision);
});
await controller.dispatch({ type: 'setText', nodeKey, text: 'Updated' });
await controller.dispatch({ type: 'setRichText', nodeKey, html: 'Hello <em>updated</em> text' });
await controller.dispatch({
  type: 'toggleInlineMark',
  nodeKey,
  range: { start: 0, end: 7 },
  mark: 'strong'
});
const result = await controller.export();
```

The package provides profiles, parsed source nodes, policy validation, typed commands and events, source-preserving rich-text wording and inline marks, explicit external-source replacement policies, minimal source patches, history, runtime projection, and clean export. It has no React dependency.

The repository includes detailed custom-profile and headless-integration guides.

## Installation and compatibility

This package is in private alpha preparation and has not been published to npm. Use the workspace or the packed-consumer workflow until the first release. Node.js 20.19.0+ is required; the package ships ESM and TypeScript declarations.

See the [integration guides](https://github.com/kong75/visual-html-editor/tree/main/docs), [compatibility policy](https://github.com/kong75/visual-html-editor/blob/main/docs/compatibility.md), and [release notes](https://github.com/kong75/visual-html-editor/blob/main/CHANGELOG.md). Repository links require collaborator access while the source is private.
