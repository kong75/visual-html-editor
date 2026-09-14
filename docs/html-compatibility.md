# HTML compatibility matrix

Visual HTML edits source-backed static HTML. The preview is a hardened browser rendering of that source; export returns the canonical source without editor markers. “Limited” means the document previews and round-trips, while a narrower set of visual operations is available.

| HTML pattern | Preview | Visual editing | Source preservation and export | Practical boundary |
| --- | --- | --- | --- | --- |
| Tables and email layouts | Supported | Text, allowed inline styles, images, and attributes | Untouched table markup is preserved | Structural row, column, and cell-span editing is not a dedicated visual workflow |
| Mixed inline formatting | Supported | Supported for text with `strong`, `em`, `u`, and `s`, plus selected-range font, size, weight, color, line height, and tracking where the profile allows them | Only the edited inline region is patched; surrounding source remains unchanged | Nested block structure should be selected by child layer or edited in Source |
| Images and other media | Supported when the browser can load the URL | Image source, alt text, replacement, and allowed sizing | Relative URLs remain relative in exported source | Upload and permanent asset URLs belong to the host through `AssetAdapter` |
| Media queries and responsive CSS | Supported at the selected viewport | Viewport switching and source-backed inline style edits | Stylesheets and media rules are preserved | There is no visual media-query rule editor |
| Email conditional comments | Preserved; browser preview shows the non-client fallback | Content outside client-only branches can be edited | Conditional syntax round-trips when untouched | Test exported email in the actual clients you support |
| Template expressions such as `{{name}}` | Preserved | Limited; edit around expressions carefully | Untouched expressions round-trip | Visual HTML does not evaluate a template language |
| External stylesheets, fonts, and relative assets | Supported when reachable; pass `baseUrl` for relative paths | Computed values can be reported; visual changes are written inline | URLs and external stylesheet references are not rewritten | CORS, authentication, and browser availability still apply |
| Positioned elements | Supported | Move and resize when the active profile allows the required CSS properties | Position, offsets, width, and height are written to the selected start tag | Rotation, snapping, constraints, and multi-selection are outside the current scope |
| Complex `rowspan` and `colspan` tables | Supported | Text and allowed properties inside addressable cells | Span attributes and untouched structure are preserved | Changing span topology is a source-editing task |
| Scripts and runtime-generated application UI | Scripts are disabled in the isolated preview | Not supported as an application runtime | Script source can be preserved, but blocking policy issues can prevent export | Render application data to static HTML before loading it into the editor |

The selected-element **Compatibility** panel reports whether text, styles, movement, resizing, and preview are available for that specific node. It also explains whether a restriction comes from read-only mode, the active profile, missing source ranges, or CSS policy.

Use the [compatibility fixtures](../tests/fixtures/compatibility/manifest.ts) and [source-fidelity tests](../tests/unit/source-fidelity.test.ts) as executable examples. Browser and package runtime support are tracked separately in [runtime and framework compatibility](./compatibility.md).
