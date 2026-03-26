---
# skeeditor-v3t4
title: implement edit time limit settings phase b
status: in-progress
type: feature
priority: high
created_at: 2026-03-26T18:28:46Z
updated_at: 2026-03-26T18:28:46Z
branch: feat/v3t4-edit-time-limit-settings
---

Implement Phase B edit time limit settings: settings storage/messages/router handlers, options UI, and content-script enforcement using record.createdAt.

## Todo

- [x] Inspect current settings/message/content-script flow
- [x] Add settings storage and message types for edit time limit
- [x] Implement router handlers for GET_SETTINGS / SET_SETTINGS
- [x] Add options UI and persistence for edit time limit
- [x] Enforce edit time limit in content script using record.createdAt
- [x] Add/update tests for settings and enforcement
- [x] Run targeted tests and typecheck
- [ ] Commit and push PR updates
