---
# skeeditor-ukhz
title: debug missing pencil on logged-in page
status: completed
type: fix
priority: critical
created_at: 2026-03-26T18:18:37Z
updated_at: 2026-03-26T18:21:33Z
---

Use browser inspection to determine why no edit affordance appears when logged in, compare live bsky.app DOM with content script assumptions, and patch the PR branch if needed.

## Todo

- [x] Inspect live bsky.app DOM and post actions with browser tools
- [x] Compare live DOM against `content-script.ts` and `post-detector.ts` assumptions
- [x] Implement fix if the selector/injection logic is wrong
- [x] Verify via tests and/or browser inspection
- [x] Commit and push PR updates

## Summary of Changes

- Inspected live `bsky.app` with browser tools and confirmed posts expose real action buttons like `Open post options menu`, while the old fixture-only `postButtonInline` hook is not reliable for live injection.
- Updated `content-script.ts` to insert the edit button into the live action row immediately before the post options button when the legacy hook is absent.
- Added a unit test covering the live-like action row structure and re-ran related content-script tests successfully.
