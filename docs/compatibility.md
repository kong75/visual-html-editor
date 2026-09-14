# Compatibility

## Package runtime and module format

All four packages require Node.js **20.19.0 or newer** for Node execution and
installation. The `entities` dependency used by the parsers requires this minimum;
the former Node 18 declaration was inaccurate. This is a metadata correction made
before the first public release.

Packages ship ESM and TypeScript declarations. CommonJS `require()` is not a
supported entry point. Core and deck can run without React or a browser DOM. The
React editor itself runs in a browser; Node support covers package installation,
resolution, and the headless packages, not server-side canvas editing.

CI runs the same packed core/deck runtime consumer on Node 20.19.0, 22.18.0, and
24.11.1. It exercises public and subpath imports, source editing, export, undo, and
deck serialization without installing the development workspace on the older Node
runtime. These are the maintained reference versions, not a claim that every later
Node patch has been independently tested.

## React

Peer ranges remain `^18.2.0 || ^19.0.0` for React and React DOM. Packed React/Vite
consumers compile and run the browser smoke test at **18.2.0** and **19.0.0**, the
minimums of those ranges. The showcase exercises the React version pinned by its
lockfile. Keep React and React DOM on the same version in a host.

The packed-consumer test defaults to React 19. To exercise React 18 locally:

```bash
pnpm exec cross-env VHE_TEST_REACT_MAJOR=18 pnpm test:e2e:packed:prepare
```

## Development tools

Use Node **24.11.1** from `.nvmrc` and pnpm **12.4.1**. The supported development
range is `^22.18.0 || >=24.11.0`; Babel 8 in the existing build/test toolchain requires
this newer range. CI covers the Node 22 minimum on Linux and the pinned Node 24
version on Linux and Windows. Development tools need not run on the minimum package
runtime.

## Browsers

The main browser suite runs against Playwright's Chromium, Firefox, and WebKit
builds. The default local command uses managed Chromium; installed Edge is an
explicit alternative. Visual baselines and touch injection are maintained for
Chromium. WebKit coverage is useful engine evidence, not a guarantee for every
Safari version, iOS device, or embedded webview.

Install browsers with `pnpm exec playwright install chromium firefox webkit` before
running the full matrix. On Linux, use `--with-deps` when system dependencies are
missing. See [test architecture](../tests/README.md) for commands and limitations.

Email preview is browser rendering; validate exported email separately in the
actual email clients your product supports.
