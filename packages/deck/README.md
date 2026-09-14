# `@visual-html/deck`

Framework-neutral ordered HTML slide documents for Visual HTML.

The package provides `DeckController`, canonical JSON serialization, blank-slide creation, and optional Claude Design import/export helpers.

```ts
import { DeckController, serializeDeck } from '@visual-html/deck';

const controller = await DeckController.create({ deck });
controller.addSlide();
controller.replaceDeck(importedDeck, { description: 'Import deck' });
const json = serializeDeck(controller.export());
```

Each slide remains a complete HTML document and can be edited by its own `@visual-html/core` controller.

## Installation and compatibility

This package is in private alpha preparation and has not been published to npm. Use the workspace or the packed-consumer workflow until the first release. Node.js 20.19.0+ is required; the package ships ESM and TypeScript declarations.

See the [integration guides](https://github.com/kong75/visual-html-editor/tree/main/docs), [compatibility policy](https://github.com/kong75/visual-html-editor/blob/main/docs/compatibility.md), and [release notes](https://github.com/kong75/visual-html-editor/blob/main/CHANGELOG.md). Repository links require collaborator access while the source is private.
