# QR Studio

QR code generator & scanner browser extension. One TypeScript source tree, built with Vite for Chrome and Firefox.

```
src/
  popup.html, sidebar.html, page.html   three views of the same UI (body[data-view])
  app/main.ts        UI controller (DOM, storage sync, camera, view switching)
  app/state.ts       state shape, defaults, presets, path/merge helpers   (pure)
  app/scan-utils.ts  content-type detection, Wi-Fi parsing, contrast check (pure)
  app/ext.ts         browser/chrome API shim
  lib/qr-encode.ts   QR encoder (v1-40, ECC L/M/Q/H)                      (pure)
  lib/qr-decode.ts   QR decoder (binarize, finders, homography, Reed-Solomon)
  lib/qr-render.ts   styled SVG renderer
  lib/i18n.ts        UI strings (en is the reference; tsc enforces same keys in ru)
  css/app.css
public/icons/        copied as-is
manifests/
  manifest.base.json     fields common to both browsers
  manifest.chrome.json   Chrome-only (side_panel, sidePanel permission, minimum_chrome_version)
  manifest.firefox.json  Firefox-only (sidebar_action, gecko id)
build/               Vite plugin: emits merged manifest.json, checks referenced files, writes the store zip
tests/               Vitest
```

## Commands

```
npm install
npm run build            typecheck + dist/chrome/ + dist/firefox/ + dist/qr-studio-<target>.zip
npm run build:chrome     only Chrome
npm run build:firefox    only Firefox
npm run dev:chrome       rebuild dist/chrome/ on change (no zip)
npm run dev:firefox      rebuild dist/firefox/ on change (no zip)
npm run typecheck        tsc --noEmit
npm test                 vitest run
npm run test:watch
npm run coverage         coverage report in coverage/
```

Load unpacked: `dist/chrome/` in `chrome://extensions`, or `dist/firefox/manifest.json` in `about:debugging`.
Upload `dist/qr-studio-chrome.zip` / `dist/qr-studio-firefox.zip` to the stores.
The bundle is not minified, so AMO reviewers can read it directly. Node 22.12+ required.
