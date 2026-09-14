# Editable source installation

Visual HTML can install its React workspace as application-owned source. The source installation keeps the parsing, validation, history, and source-transformation engine in `@visual-html/core`, while allowing applications to directly change the editor UI and browser interactions.

Initialize a React project from its package root:

```bash
npx @visual-html/editor init
npx @visual-html/editor add editor
```

The default destination is `src/components/visual-html-editor`. Change it during initialization when the application uses another source layout:

```bash
npx @visual-html/editor init --path=src/features/content-editor
```

Import the generated component from the application-owned path. Its entry point loads the generated stylesheet:

```tsx
import { HtmlEditor } from './components/visual-html-editor';
```

`add` records source hashes in `.visual-html/registry-lock.json`. The lock contains no application data and should be committed so future registry versions can distinguish upstream changes from local edits.

Inspect an installation before updating it:

```bash
npx @visual-html/editor diff editor
npx @visual-html/editor update editor
```

`update` replaces only files that still match the version originally installed. Locally modified or deleted files are preserved and reported for manual review. Files removed by a newer registry are also retained. Use `add editor --overwrite` only when intentionally replacing the complete local editor implementation.

Use `--no-install` with `add` to update `package.json` without invoking the detected package manager. This is useful in CI and repository tooling; run the package manager install afterward.

The initial registry item installs the complete non-deck React editor. Deck navigation remains available from `@visual-html/react`; it can become a separate source registry item after its component boundary is stabilized.

The generated `LICENSE.visual-html` keeps the Visual HTML MIT notice alongside the copied implementation. Retain that file when redistributing substantial portions of the generated source.
