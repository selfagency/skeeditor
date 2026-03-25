---
# skeeditor-vrnp
title: Route auth status queries from content script and popup
status: completed
type: feature
priority: high
created_at: 2026-03-18T14:29:57Z
updated_at: 2026-03-25T01:50:28Z
parent: skeeditor-618f
blocked_by:
    - skeeditor-noiw
    - skeeditor-1e94
---

Expose auth status endpoints via message router so content scripts and popup can check login state and trigger sign-in flows.

## Todo

- [ ] Implement `handleAuthStatus` to return logged-in state and current DID
- [ ] Implement `handleTriggerSignIn` to start PKCE flow via background
- [ ] Add Vitest tests for auth-status messaging and sign-in triggers (mock background APIs)
- [ ] Document how `auth-popup` Web Component should call these message endpoints
