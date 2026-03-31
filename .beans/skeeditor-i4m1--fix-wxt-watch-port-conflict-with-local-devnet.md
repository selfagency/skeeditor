---
# skeeditor-i4m1
title: fix wxt watch port conflict with local devnet
status: completed
type: bug
priority: high
created_at: 2026-03-31T13:55:41Z
updated_at: 2026-03-31T14:03:07Z
---

`task build:watch:chrome` fails because WXT starts its dev server on port 3000 while the local ATProto devnet also binds to port 3000 by default. Update the extension watch/dev configuration to use a non-conflicting port and document or verify the behavior.

## Todo
- [x] Confirm the supported WXT config for overriding the dev server port
- [x] Add a regression test or validation for the chosen port configuration where practical
- [x] Update WXT config to use a non-conflicting dev/watch port
- [x] Verify `task build:watch:chrome` no longer fails when port 3000 is occupied
- [x] Summarize the change and any follow-up notes

## Summary of Changes
- Added a regression test in `test/unit/utils/wxt-dev-server-config.test.ts` that asserts the exported WXT config uses `dev.server.port = 3001` and `dev.server.origin = 'http://localhost:3001'`.
- Updated `wxt.config.ts` to configure WXT 0.20.20 via `dev.server` instead of the incorrect top-level `server` key.
- Verified that `task build:watch:chrome` now starts its dev server on `http://localhost:3001` while port 3000 remains occupied.
- Observed an existing dependency scan warning about unresolved `dist/chrome/*.html` entries during watch startup, but the extension still builds and the original port-conflict failure is resolved.
