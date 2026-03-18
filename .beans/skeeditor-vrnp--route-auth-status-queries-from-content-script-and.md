---
# skeeditor-vrnp
title: Route auth status queries from content script and popup
status: todo
type: feature
priority: high
created_at: 2026-03-18T14:29:57Z
updated_at: 2026-03-18T14:50:35Z
parent: skeeditor-618f
---

Expose auth status endpoints via message router so content scripts and popup can check login state and trigger sign-in flows.

## Todo

- [ ] Implement `handleAuthStatus` to return logged-in state and current DID
- [ ] Implement `handleTriggerSignIn` to start PKCE flow via background
- [ ] Add Vitest tests for auth-status messaging and sign-in triggers (mock background APIs)
- [ ] Document how `auth-popup` Web Component should call these message endpoints
