---
# skeeditor-n1du
title: Define typed message protocol (content ↔ background)
status: todo
type: feature
priority: critical
created_at: 2026-03-18T14:29:37Z
updated_at: 2026-03-18T14:50:12Z
parent: skeeditor-618f
---

Document and implement the TypeScript types and shape for messages sent between content scripts, popup, and background/service worker.

## Todo

- [ ] Define `MessageRequest` and `MessageResponse` TypeScript discriminated unions for all flows (read, put, auth, status)
- [ ] Add helper `sendMessage<TReq, TRes>(req): Promise<TRes>` with type safety for consumers (Web Components)
- [ ] Add Vitest unit tests for the type helpers and compile-time checks
- [ ] Generate example usage docs showing `edit-modal` and `auth-popup` usage
