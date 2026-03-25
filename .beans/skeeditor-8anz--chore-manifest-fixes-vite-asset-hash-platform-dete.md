---
# skeeditor-8anz
title: chore manifest fixes vite asset hash platform dete
status: completed
type: task
priority: normal
created_at: 2026-03-25T17:57:02Z
updated_at: 2026-03-25T22:39:19Z
parent: skeeditor-pjwz
---

Build config, manifest, and code quality fixes from the codebase audit:

1. **Missing `minimum_chrome_version`** — `manifests/chrome/manifest.json` should declare `\"minimum_chrome_version\": \"88\"` (MV3 baseline).
2. **`incognito` mode unspecified** — `manifests/base.json` should explicitly declare `\"incognito\": \"not_allowed\"` or `\"spanning\"`.
3. **Vite asset names have no hash** — `vite.config.ts` `assetFileNames` pattern lacks `[hash]`, so cached assets won't bust on update.
4. **Safari service worker undocumented** — `manifests/safari/manifest.json` should note Safari 15.4+ requirement in a comment or README.
5. **`AppPasswordAuthError` naming** — `src/shared/auth/app-password.ts` error class name is inconsistent with the `<Module>Error` convention; rename to `AppPasswordError`.
6. **`detect.ts` never returns `'unknown'`** — `src/platform/detect.ts` has `'unknown'` in its return type but the fallback branch is unreachable; add explicit fallback with `console.warn`.
7. **Session store buffer undocumented** — `src/shared/auth/session-store.ts:55` 30-second refresh buffer is unexplained; add an inline comment.

## Todo

- [x] Add `minimum_chrome_version: \"88\"` to `manifests/chrome/manifest.json`
- [x] Add explicit `incognito` mode to `manifests/base.json`
- [x] Add `[hash]` to `assetFileNames` in `vite.config.ts`
- [x] Add Safari 15.4+ note to `docs/platform.md`
- [x] Rename `AppPasswordAuthError` → `AppPasswordError` (class + all references)
- [x] Add `'unknown'` fallback + `console.warn` to `src/platform/detect.ts`
- [x] Add comment to 30-second buffer in `session-store.ts`
- [x] `pnpm test` + `tsc --noEmit` clean
- [x] Commit with `chore(build)` prefix

## Summary of Changes

- `manifests/chrome/manifest.json`: added `minimum_chrome_version: \"88\"`
- `manifests/base.json`: added `incognito: \"not_allowed\"`
- `vite.config.ts` + `scripts/build.ts`: `assetFileNames` now includes `[hash]` for cache busting
- `docs/platform.md`: added Safari 15.4+ requirement note in Safari section
- `src/shared/auth/app-password.ts`: renamed class to `AppPasswordError`, kept deprecated re-export for backwards compat
- `src/platform/detect.ts`: wrapped `resolveName()` in try/catch, returns `'unknown'` with `console.warn` on error
- `src/shared/auth/session-store.ts`: documented the 30-second refresh buffer rationale

branch: chore/8anz-manifest-vite-config-fixes

267 unit/integration tests pass, tsc clean.
