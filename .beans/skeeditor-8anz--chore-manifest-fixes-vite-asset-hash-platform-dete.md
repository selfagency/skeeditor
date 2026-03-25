---
# skeeditor-8anz
title: chore manifest fixes vite asset hash platform dete
status: todo
type: task
priority: normal
created_at: 2026-03-25T17:57:02Z
updated_at: 2026-03-25T18:00:31Z
parent: skeeditor-pjwz
---

Build config, manifest, and code quality fixes from the codebase audit:

1. **Missing `minimum_chrome_version`** — `manifests/chrome/manifest.json` should declare `"minimum_chrome_version": "88"` (MV3 baseline).
2. **`incognito` mode unspecified** — `manifests/base.json` should explicitly declare `"incognito": "not_allowed"` or `"spanning"`.
3. **Vite asset names have no hash** — `vite.config.ts` `assetFileNames` pattern lacks `[hash]`, so cached assets won't bust on update.
4. **Safari service worker undocumented** — `manifests/safari/manifest.json` should note Safari 15.4+ requirement in a comment or README.
5. **`AppPasswordAuthError` naming** — `src/shared/auth/app-password.ts` error class name is inconsistent with the `<Module>Error` convention; rename to `AppPasswordError`.
6. **`detect.ts` never returns `'unknown'`** — `src/platform/detect.ts` has `'unknown'` in its return type but the fallback branch is unreachable; add explicit fallback with `console.warn`.
7. **Session store buffer undocumented** — `src/shared/auth/session-store.ts:55` 30-second refresh buffer is unexplained; add an inline comment.

## Todo

- [ ] Add `minimum_chrome_version: "88"` to `manifests/chrome/manifest.json`
- [ ] Add explicit `incognito` mode to `manifests/base.json`
- [ ] Add `[hash]` to `assetFileNames` in `vite.config.ts`
- [ ] Add Safari 15.4+ note to `manifests/safari/manifest.json` or `docs/platform.md`
- [ ] Rename `AppPasswordAuthError` → `AppPasswordError` (class + all references)
- [ ] Add `'unknown'` fallback + `console.warn` to `src/platform/detect.ts`
- [ ] Add comment to 30-second buffer in `session-store.ts`
- [ ] `pnpm test` + `tsc --noEmit` clean
- [ ] Commit with `chore(build)` prefix
