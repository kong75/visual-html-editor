# Email integration

The email profile is conservative: it preserves table-based source and disables freeform movement that would convert email layout into browser-only positioning.

Its default viewports represent email-client reading panes rather than template widths: `Desktop` is 800 × 900 and `Mobile` is 390 × 844. A typical email may still constrain its inner content table to 600–640px and center that table within the wider desktop preview. Viewport changes never rewrite the source.

## Recommended host flow

1. Load the complete template source, including merge tokens and conditional comments.
2. Extend `emailProfile` to match the HTML and CSS accepted by your delivery system.
3. Disable source mode for nontechnical users unless they explicitly need it.
4. Provide an asset adapter that returns absolute hosted URLs.
5. Run editor validation before saving or sending.
6. Run your email platform's own CSS inlining, template validation, and client testing after export.

## Example

```ts
import { emailProfile, extendEditorProfile } from '@visual-html/core';

export const productionEmailProfile = extendEditorProfile(emailProfile, {
  id: 'production-email',
  capabilities: {
    editSource: false,
    dragElements: false,
    resizeElements: false
  },
  html: {
    allowedProtocols: ['https:', 'mailto:', 'tel:']
  }
});
```

## Important boundary

Browser preview does not guarantee Outlook, Gmail, Apple Mail, or mobile-client parity. Visual HTML edits source faithfully; specialized email-client rendering and send validation remain host responsibilities.
