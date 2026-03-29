---
# skeeditor-femg
title: fix missing pencil edited text and autoswitch regression
status: in-progress
type: fix
priority: critical
created_at: 2026-03-28T22:34:19Z
updated_at: 2026-03-28T22:36:30Z
branch: fix/femg-debug-edited-content
---

Investigate regression where content script logs authenticated state but shows no pencil, no edited text replacement, and auto-switch does not activate on current profile. Patch selector/matching and account-switch triggers; validate with tests and E2E.

## Todo

- [x] Reproduce and inspect content-script logs/context
- [x] Fix DOM matching contamination for nested post structures
- [x] Add DID canonicalization from feed container metadata
- [x] Ensure auto-switch runs on initial page load
- [x] Add/adjust tests for initial-load auto-switch
- [x] Validate with unit tests, typecheck, and Chromium E2E reruns
- [x] Add runtime debug instrumentation for edited-content resolution flow
- [x] Validate instrumentation changes with unit tests and typecheck
- [ ] Collect live debug logs from failing bsky surface and identify first failing stage

## Summary of Changes

- Fixed post container detection to support dynamic bsky test IDs (`feedItem-*`, `postThreadItem-*`, `notificationItem-*`) so real-world posts are detected consistently.
- Hardened post identity extraction by canonicalizing handle-form links/URIs to DID when feed container metadata includes a DID hint.
- Added ownership-scoped DOM selection so nested quoted/reposted post anchors/text no longer contaminate outer post detection or text updates.
- Added thread-root fallback lookup for DID-canonicalized cache keys when permalink URL uses handle-form repo.
- Added initial-page auto-switch execution (`checkProfileSwitch(location.href)`) after auth/account bootstrap, not only on SPA navigation events.
- Added/updated unit tests for nested contamination, DID canonicalization, and initial-load auto-switch.
- Added detailed debug instrumentation in `content-script.ts` for cache-apply, edited-badge fetch, own-post fallback fetch, permalink fetch, and scan summaries. Debug mode can be enabled using any of:
  - `localStorage.setItem('skeeditor:debug', '1')`
  - URL query param `?skeeditor_debug=1`
  - `<html data-skeeditor-debug="1">`
- Verification passed:
  - unit: `content-script.test.ts`, `content-script-debounce.test.ts` (plus full unit suite invoked by script)
  - typecheck: `pnpm run typecheck`
  - focused Chromium E2E: edit button visibility, unauthenticated no-pencil behavior, and conflict modal flow (from prior validation)
