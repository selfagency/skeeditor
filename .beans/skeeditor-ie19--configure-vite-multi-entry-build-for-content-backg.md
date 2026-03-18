---
# skeeditor-ie19
title: Configure Vite multi-entry build for content, background, popup
status: completed
type: task
priority: critical
created_at: 2026-03-18T14:26:00Z
updated_at: 2026-03-18T15:41:26Z
parent: skeeditor-5atd
---

Set up Vite config with multiple entry points for content script, service worker/background, popup and options pages; ensure build outputs per browser.

## Todo

- [x] Review the current scaffold and identify the entry files and assets needed for a Vite extension build
- [x] Add Vite and the supporting TypeScript tooling needed for multi-entry browser extension builds
- [x] Create placeholder runtime entry files for content, background, popup, and options
- [x] Add `vite.config.ts` with multi-entry outputs for extension assets
- [x] Add build helper scripts/config that align with the Vite build
- [x] Validate the Vite config with a successful build run

## Summary of Changes

- added `vite`, `tsx`, and root scripts for build, watch, and workspace orchestration
- created placeholder entry points for content script, background worker, popup, and options UI
- added `vite.config.ts` with multi-entry inputs rooted under `src/` and stable output paths for extension assets
- added `scripts/build.ts` and verified the build with `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`
