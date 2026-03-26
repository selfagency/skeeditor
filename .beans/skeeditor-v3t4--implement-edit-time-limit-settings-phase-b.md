---
# skeeditor-v3t4
title: implement edit time limit settings phase b
status: completed
type: feature
priority: high
created_at: 2026-03-26T18:28:46Z
updated_at: 2026-03-26T18:42:33Z
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
- [x] Commit and push PR updates

## Summary of Changes

- Added persisted extension settings storage with `getSettings()` / `setSettings()` and a typed `ExtensionSettings` shape containing `editTimeLimit`.
- Added `GET_SETTINGS` / `SET_SETTINGS` message types and router handlers.
- Expanded the options page to save both PDS URL and edit time limit in one settings form.
- Enforced the configured edit time limit in the content script after fetching the record, opening the modal in read-only mode with a clear error if the post is too old.
- Extended `EditModal` with an editable/read-only toggle and added unit coverage for settings messages, router handling, and blocked editing behavior.
