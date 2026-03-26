---
# skeeditor-ukhz
title: debug missing pencil on logged-in page
status: in-progress
type: fix
priority: critical
created_at: 2026-03-26T18:18:37Z
updated_at: 2026-03-26T18:18:37Z
branch: fix/t9j2-edit-button-lazy-handle-storage-listener
---

Use browser inspection to determine why no edit affordance appears when logged in, compare live bsky.app DOM with content script assumptions, and patch the PR branch if needed.

## Todo

- [ ] Inspect live bsky.app DOM and post actions with browser tools
- [ ] Compare live DOM against `content-script.ts` and `post-detector.ts` assumptions
- [ ] Implement fix if the selector/injection logic is wrong
- [ ] Verify via tests and/or browser inspection
- [ ] Commit and push PR updates
