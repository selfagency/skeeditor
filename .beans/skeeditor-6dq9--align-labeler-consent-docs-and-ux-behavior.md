---
# skeeditor-6dq9
title: Align labeler consent docs and UX behavior
status: in-progress
type: task
priority: normal
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T23:15:47Z
parent: skeeditor-d3m1
---

Labeler consent docs describe an automatic subscription flow that the popup does not currently perform. Either implement the documented behavior or update docs and UX copy to reflect the manual flow.

## Todo
- [x] Confirm the desired consent behavior with current product/docs expectations
- [ ] Implement automatic preference mutation or narrow the docs/UI copy
- [ ] Add tests for the chosen popup consent behavior
- [ ] Verify labeler prompt dismissal and follow-through are documented accurately

### Behavior audit (current)
- Background checks labeler subscription status and only sets `pendingLabelerPrompt` (`src/background/message-router.ts`).
- Popup consent UX is manual: "Subscribe to labeler" opens the labeler profile URL, and both subscribe-click and dismiss remove `pendingLabelerPrompt` (`src/popup/auth-popup.ts`).
- No automatic `app.bsky.actor.putPreferences` mutation exists in extension code today.

### Implementation direction
Proceed with **manual-flow alignment** (docs + popup copy + tests), not automatic preference mutation, unless product direction changes.
