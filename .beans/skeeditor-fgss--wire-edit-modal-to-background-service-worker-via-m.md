---
# skeeditor-fgss
title: Wire edit modal to background service worker via message passing
status: completed
type: feature
priority: critical
created_at: 2026-03-18T14:29:19Z
updated_at: 2026-03-24T22:59:03Z
parent: skeeditor-02o8
blocked_by:
    - skeeditor-pteo
    - skeeditor-noiw
    - skeeditor-67ad
---

Send typed messages from modal to background to read post, submit putRecord, and receive progress/error responses. Ensure message interface is compatible with Web Component events and properties.

## Todo

- [ ] Define message contracts for read/put/auth flows
- [ ] Wire `edit-modal` Web Component to send/receive messages
- [ ] Handle progress, errors and conflict responses in the modal
- [ ] Add Vitest integration tests for message handling



## Summary of Changes

Marked completed: wired the `edit-modal` Web Component to the background service worker via typed messages.

- `src/content/content-script.ts` now sends `GET_RECORD` before opening modal and `PUT_RECORD` (with swapRecord) on save
- `src/content/edit-modal.ts` receives and displays progress/errors and handles conflict responses
- Modal ↔ background flow validated by integration tests and unit tests (unit: 207, integration: 23)

Files: `src/content/content-script.ts`, `src/content/edit-modal.ts`, `src/shared/messages.ts`
