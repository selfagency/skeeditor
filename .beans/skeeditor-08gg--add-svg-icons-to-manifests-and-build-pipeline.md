---
# skeeditor-08gg
title: Add SVG icons to manifests and build pipeline
status: completed
type: feat
priority: medium
created_at: 2026-03-26T05:05:10Z
updated_at: 2026-03-26T05:11:06Z
---

Add skeeditor.svg (transparent) and skeeditor_button.svg (solid background) icons to the extension manifests using @resvg/resvg-js to generate PNGs at required sizes.

## Todo

- [x] Install @resvg/resvg-js and vite-plugin-image-optimizer
- [x] Update build script to render SVGs to PNG icons at 16, 32, 48, 128px (transparent) and 16, 32px (button)
- [x] Update manifests/base.json with icons and action.default_icon
- [x] Update vite.config.ts with vite-plugin-image-optimizer
- [x] Update docs/dev/build.md to document icon pipeline

## Summary of Changes

- Installed `@resvg/resvg-js` and `vite-plugin-image-optimizer` as devDependencies.
- Added `buildIcons()` function to `scripts/build.ts` using `@resvg/resvg-js` (resvg) to render `skeeditor.svg` (transparent) at 16, 32, 48, 128px and `skeeditor_button.svg` (solid) at 16, 32px to `dist/<browser>/icons/`.
- Updated `manifests/base.json` to add `icons` (transparent, 4 sizes) and `action.default_icon` (solid background, 2 sizes).
- Added `ViteImageOptimizer()` plugin to `vite.config.ts` for general asset optimization.
- Updated `docs/dev/build.md` with icon pipeline documentation and updated `dist/` output layout.
