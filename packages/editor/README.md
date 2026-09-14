# `@visual-html/editor`

Open a local HTML document in Visual HTML Editor without adding a dependency to a project:

```bash
npx @visual-html/editor ./document.html
```

The command starts a temporary localhost editor, resolves relative images, fonts, and styles from the document folder, and writes back only when you choose **Save file**. It does not copy sample content or modify a `package.json`.

Choose another editing profile or port when needed:

```bash
npx @visual-html/editor ./email.html --profile=email --port=4173
```

Use `--no-open` when you do not want the command to open a browser automatically. Node.js 20.19 or newer is required.

## Install editable React source

Install the editor workspace into a React application's own source tree when the application needs to change its interface or interactions directly:

```bash
npx @visual-html/editor init
npx @visual-html/editor add editor
```

The default destination is `src/components/visual-html-editor`. The generated entry point includes its stylesheet and continues to use `@visual-html/core` for the source engine. Use `diff editor` to inspect local and upstream changes, then `update editor` to update untouched files while preserving customized files.

See the [editable source installation guide](https://github.com/kong75/visual-html-editor/blob/main/docs/source-installation.md) for paths, dependency installation, and update behavior.
