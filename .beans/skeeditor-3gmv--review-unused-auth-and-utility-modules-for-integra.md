---
# skeeditor-3gmv
title: Review unused auth and utility modules for integration or cleanup
status: completed
type: task
priority: normal
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-31T02:34:50Z
parent: skeeditor-d3m1
---

Several modules appear under-integrated or unused in production paths. Decide whether to integrate them properly, document them as future-facing, or remove them to reduce maintenance overhead.

## Todo
- [x] Audit app-password auth, token refresh manager, facet offset utilities, and edited-badge helper usage
- [x] Remove or integrate stale paths deliberately
- [x] Update docs and tests for whichever direction is chosen
- [x] Verify no dead references remain

### Initial audit findings
- `src/shared/auth/app-password.ts` appears test-only (no runtime imports found in `src/**`).
- `src/shared/auth/token-refresh.ts` appears test-only; runtime refresh path uses `refreshAccessToken` from `src/shared/auth/auth-client.ts` in `src/background/message-router.ts`.
- `src/shared/utils/facet-offsets.ts` appears test-only; runtime edit flow rebuilds facets via `buildFacets` in `src/content/post-editor.ts`.
- `src/content/post-badges.ts` (`markPostAsEdited`) appears test-only; runtime surfaces edited state via Bluesky `button[aria-label="Edited"]` handling in `src/content/content-script.ts`.

## Summary of Changes
- Removed unused modules that were not integrated into production paths: `src/shared/auth/app-password.ts`, `src/shared/auth/token-refresh.ts`, `src/shared/utils/facet-offsets.ts`, and `src/content/post-badges.ts`.
- Removed stale tests that only targeted those deleted modules.
- Added `test/unit/docs/unused-modules-cleanup.test.ts` to enforce cleanup expectations (deleted module files and stale doc references).
- Updated active documentation to match runtime behavior:
  - `docs/auth.md`
  - `docs/dev/auth.md`
  - `docs/dev/architecture.md`
  - `docs/dev/project-structure.md`
  - `docs/dev/facets.md`
- Removed unused `.skeeditor-edited-badge` styles from `src/content/styles.css` and `src/global.css`.
- Validation: targeted auth/content/utils/doc tests are green, including the new cleanup guard test.
