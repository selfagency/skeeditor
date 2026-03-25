---
# skeeditor-i979
title: Update message protocol docs for discriminated responses
status: completed
type: task
priority: medium
created_at: 2026-03-25T00:02:44Z
updated_at: 2026-03-25T00:06:09Z
parent: skeeditor-618f
---

Update `docs/messages.md` to reflect discriminated PUT_RECORD responses and add payload validation docs.

## Todo

- [x] Update the Message Catalogue table with correct discriminated response types
- [x] Add Web Component usage example for PUT_RECORD with all three response variants
- [x] Add note about `swapRecord` flow (optimistic concurrency)
- [x] Review and tighten the "Adding a new message type" section
- [x] Document payload validation behaviour

## Summary of Changes

Rewrote the `docs/messages.md` message catalogue to show the three discriminated `PUT_RECORD_*` response types. Added a full `switch (result.type)` Web Component example with all three variants including conflict merge guidance. Added a "Payload validation" section documenting the invalid-payload error shapes. Updated "Adding a new message type" to include the validator step.
