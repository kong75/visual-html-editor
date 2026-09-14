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
