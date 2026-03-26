---
# skeeditor-bmr4
title: v0.1.0 — MVP Post Editing
status: completed
type: milestone
priority: critical
created_at: 2026-03-18T14:25:11Z
updated_at: 2026-03-25T23:33:51Z
---

Milestone aggregating epics and tasks required for the v0.1.0 MVP: cross-browser Bluesky post editor (edit existing posts).

## Todo

- [x] Implement project scaffolding, builds, and manifests (Epic 1: skeeditor-5atd)
- [x] Implement AT Protocol client layer and facet utilities (Epic 2: skeeditor-v67t)
- [x] Implement authentication and background orchestration (Epic 3: skeeditor-1e94)
- [x] Implement content script UI and edit flow (Epic 4: skeeditor-02o8)
- [x] Implement message passing and background orchestration (Epic 5: skeeditor-618f)
- [x] Implement cross-browser shims and conversion steps (Epic 6: skeeditor-7d7e)
- [x] Testing: E2E test suite with Playwright (Epic 7: skeeditor-965j)
- [x] Code quality and bug remediation (Epic 8: skeeditor-pjwz)

## Summary of Changes

All 8 epics completed for the v0.1.0 MVP:

- **Epic 1** (skeeditor-5atd): Project scaffolding — Vite multi-entry build, manifests (Chrome/Firefox/Safari MV3), Vitest, Playwright, CI pipeline
- **Epic 2** (skeeditor-v67t): AT Protocol client — XrpcClient with getRecord/putRecord/putRecordWithSwap, facet detection (links, mentions, hashtags), AT-URI parsing
- **Epic 3** (skeeditor-1e94): Authentication — OAuth PKCE flow, session token storage, automatic token refresh, popup login/logout UI
- **Epic 4** (skeeditor-02o8): Content script UI — MutationObserver post detection, Edit button injection, Web Component edit modal with Shadow DOM
- **Epic 5** (skeeditor-618f): Message passing — typed message protocol, background message router, getRecord/putRecord routing with swapRecord conflict handling
- **Epic 6** (skeeditor-7d7e): Cross-browser — webextension-polyfill integration, platform shims, Safari build script, Firefox/Chrome-specific fixes
- **Epic 7** (skeeditor-965j): E2E tests — Playwright extension fixtures, popup load, content script inject, edit modal flow, conflict handling
- **Epic 8** (skeeditor-pjwz): Code quality — mention regex fix, Shadow DOM, security hardening, accessibility (ARIA/focus trap), performance (debounce/memoization), test coverage (275 tests), build config fixes
