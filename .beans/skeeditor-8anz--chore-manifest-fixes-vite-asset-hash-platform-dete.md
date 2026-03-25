---
# skeeditor-8anz
title: chore manifest fixes vite asset hash platform dete
status: completed
type: task
priority: normal
created_at: 2026-03-25T17:57:02Z
updated_at: 2026-03-25T23:32:45Z
parent: skeeditor-pjwz
---

Build config, manifest, and code quality fixes from the codebase audit:

## Todo

- [x] Add `minimum_chrome_version: "88"` to `manifests/chrome/manifest.json`
- [x] Add explicit `incognito` mode to `manifests/base.json`
- [x] Add `[hash]` to `assetFileNames` in `vite.config.ts`
- [x] Add Safari 15.4+ note to `docs/platform.md`
- [x] Rename `AppPasswordAuthError` → `AppPasswordError` (class + all references)
- [x] Add `'unknown'` fallback + `console.warn` to `src/platform/detect.ts`
- [x] Add comment to 30-second buffer in `session-store.ts`
- [x] `pnpm test` + `tsc --noEmit` clean
- [x] Commit with `chore(build)` prefix

## Summary of Changes

All 7 build/config items implemented:

1. Added `minimum_chrome_version: "88"` to Chrome manifest
2. Added `incognito: "not_allowed"` to base manifest
3. Added `[hash]` to Vite `assetFileNames` for cache busting
4. Added Safari 15.4+ requirement note to docs/platform.md
5. Renamed `AppPasswordAuthError` → `AppPasswordError` with deprecated re-export
6. Added try/catch + `'unknown'` fallback in `src/platform/detect.ts`
7. Documented the 30-second refresh buffer in session-store.ts

branch: chore/8anz-manifest-vite-config-fixes
