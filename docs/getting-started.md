# Getting started

Visual HTML adds visual editing to existing HTML. Start by editing a sample, then connect your own HTML and persistence workflow.

## Run the editor

Clone this repository using its **Code** menu, or download and extract the ZIP. Open a terminal in the repository folder. Use Node.js 24.11.1 (pinned in `.nvmrc`) and pnpm 12.4.1; see [development setup](../CONTRIBUTING.md#development-setup) for toolchain details.

```bash
npm install --global pnpm@12.4.1
pnpm install --frozen-lockfile
pnpm dev
```

Open the [local editor](http://127.0.0.1:4173/#/editor). Choose Email, Slides, or Web, click text to edit it, then select another element to commit the change. Try Undo and Export HTML. In Email or Web, use Import HTML to load your own file after reviewing its policy issues. See [importing](./importing.md) for slide-deck formats.

The showcase resolves the packages from source. The project is pre-release; the examples below do not assume that packages are available on npm.

## Try the packaged React integration

To evaluate the distributable packages in a separate React/Vite consumer, run this from the repository root after installing dependencies:

```bash
pnpm test:consumers
```

This builds and packs the three packages, installs them into clean headless and React/Vite consumers, and checks both integrations. The generated React example is in `.artifacts/consumer-tests/react-vite`. Launch it with:

```bash
pnpm --dir .artifacts/consumer-tests/react-vite exec vite --host 127.0.0.1 --port 4174
```

Open the [packaged example](http://127.0.0.1:4174). Use its generated `package.json` as a reference for local tarball dependencies and pnpm overrides in your own app. All three packages are pinned to local tarballs so workspace dependencies do not require an unpublished npm package. Keep React, React DOM, and the editor stylesheet in your host application.

The consumer command recreates `.artifacts/consumer-tests` on each run. Copy an example outside that generated folder before adapting it for your product. The maintained source example is in [tests/consumers/react-vite](../tests/consumers/react-vite).

## Choose an integration level

Visual HTML has three layers:

1. `@visual-html/core` for source-backed commands, validation, history, and export.
2. `@visual-html/react` for the default visual workspace.
3. `@visual-html/deck` when one product document contains multiple HTML slides.

Use only the layers your product needs.

## Controlled React workspace

For most integrations, use the managed wrapper:

```tsx
import { useState } from 'react';
import { webProfile } from '@visual-html/core';
import { HtmlEditor } from '@visual-html/react';
import '@visual-html/react/styles.css';

export function Editor({ initialSource }: { initialSource: string }) {
  const [source, setSource] = useState(initialSource);
  return (
    <HtmlEditor
      value={source}
      profile={webProfile}
      documentTitle="Homepage"
      onChange={({ html }) => setSource(html)}
    />
  );
}
```

See [Controlled React integration](./controlled-react.md) for external-update policies, callbacks, checkpoints, and selection.

## Controller-owned React workspace

```tsx
import { useEffect, useState } from 'react';
import { EditorController, webProfile } from '@visual-html/core';
import { VisualHtmlEditor } from '@visual-html/react';
import '@visual-html/react/styles.css';

export function Editor({ source }: { source: string }) {
  const [controller, setController] = useState<EditorController>();

  useEffect(() => {
    let active = true;
    void EditorController.create({ html: source, profile: webProfile }).then((next) => {
      if (active) setController(next);
    });
    return () => { active = false; };
  }, [source]);

  if (!controller) return <p>Loading editor…</p>;

  return (
    <VisualHtmlEditor
      controller={controller}
      documentTitle="Homepage"
      onExport={(html) => saveHtml(html)}
    />
  );
}
```

Keep the controller stable while editing. Replacing it creates a new document session.

## Persistence with a controller

The editor does not own persistence. Subscribe to revisions or export on an explicit save action:

```ts
const unsubscribe = controller.subscribe(() => {
  const snapshot = controller.getSnapshot();
  updateDirtyIndicator(snapshot.dirty);
});

const { html, issues } = await controller.export();
```

Call `controller.createCheckpoint()` after the host successfully saves.

`export()` returns source and validation issues; it does not reject invalid HTML on its own. Check for `severity === 'blocking'` before publishing. The default React export button performs that check. See [headless export](./headless-core.md#export-and-publishing) for an example.

## Assets

Provide an asset adapter when images must be uploaded instead of embedded:

```ts
const assetAdapter = {
  async upload(file: File) {
    const response = await uploadToYourService(file);
    return { url: response.publicUrl, alt: file.name };
  }
};
```

The host owns credentials, file limits, persistence, and public URL policy.

## Next steps

- [Custom profiles](./custom-profiles.md)
- [Controlled React integration](./controlled-react.md)
- [Email integration](./email-integration.md)
- [Headless core](./headless-core.md)
- [Security](./security.md)
