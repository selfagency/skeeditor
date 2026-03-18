---
# skeeditor-ys7h
title: Set up manifests (Chrome MV3, Firefox MV3 w/ gecko ID, Safari MV3)
status: completed
type: task
priority: critical
created_at: 2026-03-18T14:26:04Z
updated_at: 2026-03-18T15:57:22Z
parent: skeeditor-5atd
---

Create base.json and browser-specific manifest files under manifests/, ensure required permissions and gecko ID for Firefox, prepare Safari manifest conversion.

## Todo

- [x] Review current build outputs and identify the shared extension manifest fields needed across browsers
- [x] Confirm Manifest V3 differences for Chrome, Firefox, and Safari configuration
- [x] Add `manifests/base.json` with shared extension metadata, permissions, and UI entries
- [x] Add browser-specific manifest overrides for Chrome, Firefox, and Safari
- [x] Add a small manifest merge helper script for later build integration
- [x] Validate manifest JSON structure and file references against the current scaffold

## Summary of Changes

- added `manifests/base.json` with shared MV3 metadata, permissions, host permissions, popup, options, and content script entries
- added browser overrides for Chrome, Firefox, and Safari, including a Firefox `browser_specific_settings.gecko.id` placeholder and browser-specific background configuration
- added `scripts/merge-manifest.ts` plus package scripts to generate merged manifests per browser
- verified the setup with `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm manifest:chrome`, `pnpm manifest:firefox`, and `pnpm manifest:safari`
