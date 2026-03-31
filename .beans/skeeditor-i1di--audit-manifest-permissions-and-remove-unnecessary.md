---
# skeeditor-i1di
title: Audit manifest permissions and remove unnecessary access
status: completed
type: task
priority: normal
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-31T01:52:52Z
parent: skeeditor-d3m1
branch: feat/i1di-audit-manifest-permissions
pr: 93
---

The manifest and docs should request only the permissions the extension truly uses. Re-audit `activeTab`, `tabs`, `alarms`, and related permission disclosures for least-privilege and documentation accuracy.

## Todo
- [x] Trace runtime usage of all requested permissions
- [x] Remove unneeded permissions from the manifest if safe
- [x] Update docs to justify every retained permission
- [x] Re-run extension tests/build to confirm no regressions

## Summary of Changes
- Removed unused `activeTab` from extension runtime permissions in `wxt.config.ts`.
- Added `test/unit/utils/manifest-permissions.test.ts` to enforce least-privilege permissions and permission-doc drift checks.
- Updated permission disclosures in `docs/auth.md`, `docs/dev/build.md`, `docs/dev/platform.md`, and `docs/guide/installation.md` to reflect retained permissions (`storage`, `tabs`, `alarms`).

### Verification run
- `test/unit/utils/manifest-permissions.test.ts`
- `test/unit/background/service-worker.test.ts`
- `test/unit/background/message-router.test.ts`
- `task build:chrome`
