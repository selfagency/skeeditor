---
# skeeditor-ys7h
title: Set up manifests (Chrome MV3, Firefox MV3 w/ gecko ID, Safari MV3)
status: in-progress
type: task
priority: critical
created_at: 2026-03-18T14:26:04Z
updated_at: 2026-03-18T15:54:35Z
parent: skeeditor-5atd
branch: feature/skeeditor-5atd-project-scaffolding-build-pipeline
---

Create base.json and browser-specific manifest files under manifests/, ensure required permissions and gecko ID for Firefox, prepare Safari manifest conversion.

## Todo

- [ ] Review current build outputs and identify the shared extension manifest fields needed across browsers
- [ ] Confirm Manifest V3 differences for Chrome, Firefox, and Safari configuration
- [ ] Add `manifests/base.json` with shared extension metadata, permissions, and UI entries
- [ ] Add browser-specific manifest overrides for Chrome, Firefox, and Safari
- [ ] Add a small manifest merge helper script for later build integration
- [ ] Validate manifest JSON structure and file references against the current scaffold
