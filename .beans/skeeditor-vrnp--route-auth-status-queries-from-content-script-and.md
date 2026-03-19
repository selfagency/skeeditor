---
# skeeditor-vrnp
title: Route auth status queries from content script and popup
status: in-progress
type: feature
priority: high
created_at: 2026-03-18T14:29:57Z
updated_at: 2026-03-19T20:18:05Z
parent: skeeditor-618f
blocked_by:
    - skeeditor-noiw
    - skeeditor-1e94
---

Expose auth status endpoints via message router so content scripts and popup can check login state and trigger sign-in flows.

## Todo

- [x] Implement `handleAuthStatus` to return logged-in state and current DID
- [x] Add Vitest tests for content-script auth-status messaging (mock background APIs)
- [ ] Implement `handleTriggerSignIn` to start PKCE flow via background
- [ ] Route auth status queries from popup
- [ ] Document how `auth-popup` Web Component should call these message endpoints
