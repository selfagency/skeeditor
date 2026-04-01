---
# skeeditor-swti
branch: fix/recreate-edit-labeler-regression
pr: https://github.com/selfagency/skeeditor/pull/96
title: fix recreate edit propagation and labeler regression
status: completed
type: task
priority: critical
created_at: 2026-04-01T17:40:27Z
updated_at: 2026-04-01T17:40:27Z
---
## Context
Users report edited posts still do not visibly change across clients, even after recent save-strategy changes. The labeler flow has also stopped working.

## Todo
- [x] Verify current recreate/applyWrites path against working external implementations
- [x] Reproduce why edits are not visible from another client/account
- [x] Fix recreate save path so Bluesky/AppView reflects edited posts
- [x] Fix labeler emission/subscription regression
- [x] Add or update tests for recreate + labeler behavior
- [x] Verify with targeted test runs
- [x] Harden labeler DPoP/CORS deployment path and client compatibility

## Summary of Changes
- Switched the default save strategy to `recreate` so edits use `applyWrites` delete+create unless the user explicitly chooses in-place edit.
- Updated the options copy/defaults and content-script fallback so cross-client visibility follows the working overwrite strategy by default.
- Hardened the labeler Worker with DPoP-aware CORS/forwarding regression tests and documented the production rollout checklist.
- Deployed the labeler Worker and verified the live preflight now advertises `Access-Control-Allow-Headers: Authorization, Content-Type, DPoP`.
- Re-enabled DPoP-based labeler emits in the extension now that the live service supports them, while retaining Bearer fallback for sessions that explicitly disable DPoP.
- Expanded regression tests for recreate defaults, labeler auth behavior, and worker CORS behavior.
