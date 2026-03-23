---
# skeeditor-02o8
title: 'Epic 4: Content Script & UI'
status: in-progress
type: epic
priority: critical
created_at: 2026-03-18T14:25:30Z
updated_at: 2026-03-23T17:19:00Z
parent: skeeditor-bmr4
branch: feat/02o8-content-script-ui
---

Content script to detect posts, inject Edit button, build edit modal and wire to background via messaging. Preserve facets and embeds.

UI approach: Implement interactive UI pieces (edit modal, popup) as framework-agnostic Web Components (Shadow DOM) so components are encapsulated and portable across browsers.

## Todo

- [x] Implement MutationObserver and post detection
- [x] Inject Edit button and wire to Web Component modal, honoring the configured edit window
- [ ] Ensure message passing and background wiring works with Web Components
- [ ] Preserve facets and embeds through edit flow, including visible edited labels

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

**Remaining Work:**
- Wire edit button injection into content script
- Connect modal to background service worker via messaging
- Create styles.css for edit button
- Add unit tests for post-detector and edit-modal
