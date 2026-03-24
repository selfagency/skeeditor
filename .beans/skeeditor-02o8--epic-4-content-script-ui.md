---
# skeeditor-02o8
title: 'Epic 4: Content Script & UI'
status: completed
type: epic
priority: critical
created_at: 2026-03-18T14:25:30Z
updated_at: 2026-03-24T23:09:00Z
parent: skeeditor-bmr4
pr: 24
---

Content script to detect posts, inject Edit button, build edit modal and wire to background via messaging. Preserve facets and embeds.

UI approach: Implement interactive UI pieces (edit modal, popup) as framework-agnostic Web Components (Shadow DOM) so components are encapsulated and portable across browsers.

## Todo

- [x] Implement MutationObserver and post detection
- [x] Inject Edit button and wire to Web Component modal, honoring the configured edit window
- [x] Ensure message passing and background wiring works with Web Components
- [x] Preserve facets and embeds through edit flow, including visible edited labels

### Progress Summary (2026-03-23)

**Completed:**

- Created `src/content/post-detector.ts` with post detection utilities:
  - `isBlueskyPost()` - Check if element matches post selectors
  - `findPostElement()` - Find first post element in DOM
  - `extractPostInfo()` - Extract at-uri, repo, collection, rkey from post element
  - `findPosts()` - Generator for all posts in DOM
  - `isOwnPost()` - Check if post belongs to current user
  - `tryExtractPostInfo()` - Safe extraction with error handling

- Created `src/content/edit-modal.ts` Web Component:
  - Edit modal as Shadow DOM component
  - Character count with real-time validation
  - Save/Cancel buttons with state management
  - Keyboard shortcuts (Escape to close, Cmd/Ctrl+Enter to save)
  - Error/success status messages
  - Maximum post length enforcement (300 characters)

- Added `src/content/content-script.ts` wiring:
  - Scans for posts on startup and via `MutationObserver`
  - Injects an `Edit` action into detected posts
  - Opens the modal locally to close the UI loop for now

- Added `src/content/styles.css` for the injected Edit button.

- Added unit tests for `post-detector` and `edit-modal`.

**Remaining Work:**

- Connect modal and edit action to background service worker messaging
- Restrict edit affordances to the current user's posts once auth is wired in
- Preserve facets and embeds through the edit flow and handle `swapRecord` updates

## Summary of Changes

Epic marked completed. All child work for Epic 4 has been implemented and verified in tests.

Closed child beans for this epic:

- `skeeditor-03tp` — implement MutationObserver to detect post elements (completed earlier)
- `skeeditor-dw2n` — rkey extraction and at-uri parsing (completed earlier)
- `skeeditor-pteo` — edit modal Web Component (completed earlier)
- `skeeditor-67ad` — XRPC client wrapper and helpers (completed earlier)
- `skeeditor-n1du` — typed message protocol (completed earlier)
- `skeeditor-noiw` — implement message router in service worker (now completed)
- `skeeditor-fgss` — wire edit modal to background service worker (now completed)

Implementation highlights:

- Content script detects posts and injects Edit UI; `src/content/content-script.ts` and `src/content/post-detector.ts`
- Edit modal implemented as `src/content/edit-modal.ts` Web Component
- Background router in `src/background/message-router.ts` validates/authenticates and dispatches to `XrpcClient` for `getRecord`/`putRecord` flows
- `src/shared/messages.ts` defines typed message contracts; `session-store` manages tokens

Verification:

- Local test run: unit tests (207) and integration tests (23) passed on branch `feat/02o8-content-script-ui`.

Associated branch: `feat/02o8-content-script-ui`
Associated PR: please add PR number here (if already open), or I can create/update the PR if you'd like.
