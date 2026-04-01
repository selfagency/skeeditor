---
# skeeditor-kaal
title: Add edit vs recreate save strategy
status: completed
type: feature
priority: high
branch: feat/skeeditor-l11x-refactor-ui-web-components
created_at: 2026-04-01T03:28:39Z
updated_at: 2026-04-01T03:49:21Z
---

## Todo
- [x] Replace timestamp-only settings model with binary save strategy
- [x] Update options UI copy and persistence for Edit record vs Recreate record
- [x] Add targeted failing tests for new setting and branching behavior
- [x] Implement atomic recreate message/API flow via applyWrites
- [x] Branch content save flow between PUT_RECORD and recreate path
- [x] Update docs and verify targeted tests/build

## Summary of Changes
- Replaced the old post date mode setting with a binary save strategy (`edit` vs `recreate`) and migrated legacy stored values.
- Added an atomic `RECREATE_RECORD` path backed by `com.atproto.repo.applyWrites` for delete+create saves at the same rkey.
- Updated options UI copy, content-script branching, background routing, docs, and targeted unit/integration/E2E coverage for both strategies.