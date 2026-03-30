---
# skeeditor-2jwe
title: Align extension-labeler auth contract and third-party token handling
status: todo
type: bug
priority: critical
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T14:04:21Z
parent: skeeditor-d3m1
---

The extension forwards a bearer token to the labeler, while product docs claim tokens are never sent to third parties. Align implementation and trust boundaries so credential handling is explicit, justified, and secure.

## Todo
- [ ] Write failing tests or assertions for the current emit contract
- [ ] Decide and implement the supported auth contract between extension and labeler
- [ ] Remove unnecessary token forwarding or document it accurately if retained
- [ ] Verify successful edits still trigger labels correctly
- [ ] Update user-facing auth/privacy docs
