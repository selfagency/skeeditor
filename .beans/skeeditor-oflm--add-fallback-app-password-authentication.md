---
# skeeditor-oflm
title: 'Add fallback: app password authentication'
status: todo
type: feature
priority: normal
created_at: 2026-03-18T14:28:56Z
updated_at: 2026-03-18T14:49:51Z
parent: skeeditor-1e94
---

Optional fallback to app-password authentication for users who cannot complete OAuth; UI and secure storage handling required.

## Todo

- [ ] Design UI flow for entering an app-password (Web Component optional)
- [ ] Implement secure storage guidance and validation for app-passwords
- [ ] Add Vitest tests to validate auth fallback behavior and error handling
- [ ] Document security trade-offs and recommend OAuth PKCE as primary method
