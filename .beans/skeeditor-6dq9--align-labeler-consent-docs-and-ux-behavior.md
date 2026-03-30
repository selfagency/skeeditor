---
# skeeditor-6dq9
title: Align labeler consent docs and UX behavior
status: completed
type: task
priority: normal
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T23:35:11Z
parent: skeeditor-d3m1
branch: feat/6dq9-align-labeler-consent-docs-ux
pr: 91
---

Labeler consent docs describe an automatic subscription flow that the popup does not currently perform. Either implement the documented behavior or update docs and UX copy to reflect the manual flow.

## Todo
- [x] Confirm the desired consent behavior with current product/docs expectations
- [x] Implement automatic preference mutation or narrow the docs/UI copy
- [x] Add tests for the chosen popup consent behavior
- [x] Verify labeler prompt dismissal and follow-through are documented accurately

### Behavior audit (current)
- Background checks labeler subscription status and only sets `pendingLabelerPrompt` (`src/background/message-router.ts`).
- Popup consent UX is manual: consent CTA opens the labeler profile URL, and both CTA click and "Not now" remove `pendingLabelerPrompt` (`src/popup/auth-popup.ts`).
- No automatic `app.bsky.actor.putPreferences` mutation exists in extension code today.

### Implementation direction
Proceed with **manual-flow alignment** (docs + popup copy + tests), not automatic preference mutation.

## Summary of Changes
- Updated popup labeler consent copy in `src/popup/auth-popup.ts` to explicitly describe manual Bluesky-managed subscription (`Open labeler profile`, `Not now`).
- Added popup unit tests for manual consent behavior and prompt dismissal in `test/unit/popup/auth-popup.test.ts`.
- Added docs drift guard `test/unit/docs/labeler-consent-alignment.test.ts`.
- Updated user docs (`docs/guide/usage.md`, `docs/guide/faq.md`) to remove implicit auto-subscribe wording and document manual follow-through.

### Verification run
- `test/unit/popup/auth-popup.test.ts`
- `test/unit/docs/labeler-consent-alignment.test.ts`
