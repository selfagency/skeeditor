---
# skeeditor-sykd
title: Implement login/logout UI in popup
status: todo
type: feature
priority: high
created_at: 2026-03-18T14:28:50Z
updated_at: 2026-03-18T15:10:01Z
parent: skeeditor-1e94
blocked_by:
    - skeeditor-v7k9
---

Popup UI to show login status, trigger OAuth sign-in, logout, and quick actions like reauthorize or switch accounts. Implement popup UI as a small Web Component to keep logic encapsulated and reusable.

## Todo

- [ ] Create `auth-popup` Web Component and markup
- [ ] Wire sign-in/sign-out flows to background via typed messages
- [ ] Add account switch and reauthorize actions
- [ ] Add tests (Vitest) for popup behavior
