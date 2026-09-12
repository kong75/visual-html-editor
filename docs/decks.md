# Slide decks

Use `@visual-html/deck` to let people revise HTML presentations, lessons, and other learning materials in your application. It manages an ordered collection of independently editable HTML documents. Each slide stays HTML, while the deck adds navigation and structure.

Use `slidesProfile` with `HtmlEditor` for a single fixed-canvas document. Add `DeckController` and the React `DeckNavigator` when users need multiple slides. These APIs operate on HTML slides; they do not import PowerPoint or Google Slides files. See [HTML and deck importing](./importing.md) for supported adapters.

```ts
import { DeckController } from '@visual-html/deck';

const deck = await DeckController.create({
  deck: {
    schema: 'visual-html-deck',
    version: 1,
    id: 'course-intro',
    title: 'Course introduction',
    width: 1600,
    height: 900,
    slides: [{ id: 'opening', title: 'Opening', html: openingHtml }]
  }
});
```

Deck history covers add, duplicate, remove, and reorder operations. Each slide's HTML source history remains owned by its `EditorController`.

`DeckNavigator` exposes **Undo deck change** and **Redo deck change**. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y) operate on deck history while focus is in the Slides navigator. The main editor's Undo/Redo controls continue to operate on the active slide's content. Deleted slides recover their latest synchronized HTML.

Hosts that cache slide controllers can use `DeckNavigator.onHistoryChange` to reconcile cached source after an imported deck is restored, particularly when different decks reuse slide IDs. Preserve matching controllers to retain per-slide history; rebuild controllers whose HTML differs from the restored deck.

Pass `workspaceDirty={deckSnapshot.dirty}` to `VisualHtmlEditor` (or `HtmlEditor`) so its save indicator includes deck structure and inactive slide changes. The indicator combines this flag with the current document's dirty state. Create the relevant controller checkpoints only after host persistence succeeds; exporting does not mark work as saved.

The canonical format is `visual-html-deck` JSON. Claude Design `<deck-stage>` support is an optional adapter and should not become an application database format without explicit host ownership.

The standalone Claude Design export uses the current slides' head stylesheets, including additions and deletions. Because its slides share one HTML document and CSS cascade, their head `<style>` and `<link>` elements must match. Export throws an error for differing head stylesheets rather than discarding edits or allowing one slide's CSS to change another. Use canonical deck JSON or export each slide's complete HTML separately when slides require independent stylesheets. Inline style edits remain independent and do not have this restriction.
