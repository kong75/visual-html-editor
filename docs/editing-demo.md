# Landing page editing demo

The workspace preview contains three distinct 27-second React DOM demonstrations, with new Visual HTML content and styles informed by `samples.ts`. The email uses an ivory editorial layout; the 16:9 slide uses dark surfaces, violet circles, and an amber card; the web page uses a green split hero and a row of feature cards. These are guided demonstrations; the “Your turn” link opens the working editor.

- Email: rewrite the welcome headline, refine type and color, and commit new padding.
- Slides: rewrite a quickstart title, drag it to a new position, and resize a card from its corner handle. Position and dimension readouts follow the selected object.
- Web: rewrite the call-to-action, adjust its corner radius and background, then preview the page stacking into a narrow layout.

Each format has its own chapters, cursor choreography, inspector context, and HTML excerpt. `demo-format-content.tsx` and its stylesheet own the presentation and responsive web layouts.

`apps/showcase/src/editing-demo.tsx` owns the sequence. `frameAt()` derives document text, styles, selection, inspector values, and the HTML excerpt from one playhead. Cursor keyframes address elements by `data-cursor` and resolve their positions in the current responsive layout. New chapters and replays therefore reset all visible state together.

The animation starts when 40% of its workspace is visible, pauses offscreen or when the tab is hidden, and stops on the finished design. Pause, resume, restart, format selection, and four chapter buttons remain available. Reduced-motion visitors start with the finished design; chapter buttons show representative stills. Playback is available on explicit request, with the moving cursor hidden for reduced motion.

Numeric edits mirror the production inspector's text-field workflow: select the CSS value, type a replacement, then apply it with Enter. The canvas retains its previous value until that commit. The color sequence illustrates the browser picker's spectrum, hue bar, preview, and RGB/hex readouts; all handles, cursor positions, and displayed colors derive from the same HSV interpolation. It is a deterministic in-page representation of the browser picker, whose native popup varies by browser and operating system.

`apps/showcase/src/editing-demo.css` uses container queries to move the inspector below the canvas on phones. It reuses the existing artwork and fonts, with no animation library, video download, or external asset request. Cursor movement, click rings, caret blinking, and popover reveals follow the same clock, including while paused.

`tests/editing-demo.spec.ts` covers synchronized playback, pause/resume/replay, visibility changes, chapter and format selection, cursor alignment, keyboard access, contrast, and narrow-screen containment. The existing landing visual regression uses reduced motion for a deterministic frame.
