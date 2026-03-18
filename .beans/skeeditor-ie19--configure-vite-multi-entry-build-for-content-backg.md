---
# skeeditor-ie19
title: Configure Vite multi-entry build for content, background, popup
status: in-progress
type: task
priority: critical
created_at: 2026-03-18T14:26:00Z
updated_at: 2026-03-18T15:37:49Z
parent: skeeditor-5atd
branch: feature/skeeditor-5atd-project-scaffolding-build-pipeline
---

Set up Vite config with multiple entry points for content script, service worker/background, popup and options pages; ensure build outputs per browser.

## Todo

- [ ] Review the current scaffold and identify the entry files and assets needed for a Vite extension build
- [ ] Add Vite and the supporting TypeScript tooling needed for multi-entry browser extension builds
- [ ] Create placeholder runtime entry files for content, background, popup, and options
- [ ] Add `vite.config.ts` with multi-entry outputs for extension assets
- [ ] Add build helper scripts/config that align with the Vite build
- [ ] Validate the Vite config with a successful build run
