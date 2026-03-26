---
# skeeditor-1u08
title: 'Code quality remediation: critical bugs, security hardening, SDK alignment'
status: completed
type: epic
priority: critical
created_at: 2026-03-25T21:55:19Z
updated_at: 2026-03-26T00:57:20Z
branch: fix/1u08-code-quality-remediation
pr: 31
---

## Summary of Changes

All planned remediations from the code review are complete:

- Grapheme counting in EditModal uses `graphemeLength()` (not `.length`)
- O(n²) byte slicing replaced with `byteSlice()` from shared utils
- PKCE state stored in `browser.storage.session` with local fallback
- `isStoredSession()` type guard added with `Number.isFinite(expiresAt) && expiresAt > 0`
- Error messages sanitized in `message-router.ts`
- `expires_in` validated as positive finite number
- `valuesEqual()` depth-capped at 20 to prevent stack overflow
- EditModal listener lifecycle fixed: remove-before-add in `open()` prevents duplicate handlers
- MutationObserver scan changed from throttle to true debounce (100ms, `clearTimeout` + restart)
- `cleanupContentScript()` now clears pending `scanTimer` on teardown
