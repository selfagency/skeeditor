---
# skeeditor-fgss
title: Wire edit modal to background service worker via message passing
status: todo
type: feature
priority: critical
created_at: 2026-03-18T14:29:19Z
updated_at: 2026-03-18T14:43:51Z
parent: skeeditor-02o8
---

Send typed messages from modal to background to read post, submit putRecord, and receive progress/error responses. Ensure message interface is compatible with Web Component events and properties.

## Todo

- [ ] Define message contracts for read/put/auth flows
- [ ] Wire `edit-modal` Web Component to send/receive messages
- [ ] Handle progress, errors and conflict responses in the modal
- [ ] Add Vitest integration tests for message handling
