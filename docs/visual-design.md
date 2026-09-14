# Visual HTML identity

The identity uses a folded V, ink-dark surfaces, lavender accents, and a pairing of Manrope and Instrument Serif. The landing page leads with a sculptural image and oversized type, switches to a light workspace preview, then returns to illustrated feature cards and a developer section. The working editor uses the same identity with quieter, light surfaces around the document.

## Assets

- Shared vector mark: `packages/react/src/brand-mark.tsx`; matching favicon: `apps/showcase/public/favicon.svg`.
- Hero artwork: `apps/showcase/src/assets/chrome-ribbon.webp` (1536 × 1024, 158 KB). Generated with the built-in image generation tool, then encoded as WebP. The email sample imports this same asset inline so its exported image does not depend on the development server.
- Manrope and Instrument Serif: self-hosted WOFF2 files in `apps/showcase/public/fonts/`. Their SIL Open Font License files are included there. Fonts require no external requests at runtime.
- Page styles: `apps/showcase/src/landing.css`. Global fonts and application shell: `apps/showcase/src/showcase.css`. Embeddable editor styles: `packages/react/src/styles.css`.

## Artwork prompt

Create one spectacular high-end CGI artwork for an experimental design-tool website hero. Landscape 1536x1024. A single monumental folded ribbon made of thick optically clear violet glass and highly polished liquid chrome, forming an abstract angular V / downward chevron with elegant looping folds, floating in space. Rich translucent periwinkle, electric cobalt, pale lavender and tiny warm peach refractions along polished edges. Sophisticated luxury art direction, extremely refined surface detail and caustics, intense dramatic studio rim light, physically rendered, premium design magazine cover. Object centered slightly to the right, fills 75% of image, 3/4 camera view, a sense of weight and sculptural depth. Background perfectly near-black charcoal #0b0c10, subtle diffuse blue illumination below object, no floor horizon. Striking sculptural silhouette. No text, no typography, no UI, no symbols, no watermarks. Must feel like real luminous glass and chrome, not an illustration. Output a local file for integration into a website.

## Interaction and accessibility

- Pointer movement subtly offsets the hero artwork without React rerenders. Reduced-motion preferences disable this movement and entrance animations.
- Preview buttons switch between email, slides, and web examples and announce the active format.
- The setup command can be copied with visible and screen-reader feedback.
- The logo is decorative inside named home links. Keyboard focus is visible on both light and dark backgrounds.
- The editor is loaded on demand; the artwork and font files are compressed independently of JavaScript.
