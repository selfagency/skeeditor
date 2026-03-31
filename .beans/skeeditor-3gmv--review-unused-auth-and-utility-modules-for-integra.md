---
# skeeditor-3gmv
title: Review unused auth and utility modules for integration or cleanup
status: in-progress
type: task
priority: normal
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-31T00:03:11Z
parent: skeeditor-d3m1
branch: fix/3gmv-review-unused-auth-utility-modules
---

Several modules appear under-integrated or unused in production paths. Decide whether to integrate them properly, document them as future-facing, or remove them to reduce maintenance overhead.

## Todo
- [x] Audit app-password auth, token refresh manager, facet offset utilities, and edited-badge helper usage
- [ ] Remove or integrate stale paths deliberately
- [ ] Update docs and tests for whichever direction is chosen
- [ ] Verify no dead references remain

### Initial audit findings
- `src/shared/auth/app-password.ts` appears test-only (no runtime imports found in `src/**`).
- `src/shared/auth/token-refresh.ts` appears test-only; runtime refresh path uses `refreshAccessToken` from `src/shared/auth/auth-client.ts` in `src/background/message-router.ts`.
- `src/shared/utils/facet-offsets.ts` appears test-only; runtime edit flow rebuilds facets via `buildFacets` in `src/content/post-editor.ts`.
- `src/content/post-badges.ts` (`markPostAsEdited`) appears test-only; runtime surfaces edited state via Bluesky `button[aria-label="Edited"]` handling in `src/content/content-script.ts`.
