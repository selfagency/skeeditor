---
# skeeditor-tz8r
title: Handle Safari API incompatibilities (document and shim)
status: todo
type: task
priority: normal
created_at: 2026-03-18T14:30:30Z
updated_at: 2026-03-18T14:52:00Z
parent: skeeditor-7d7e
---

Identify Safari API incompatibilities and add shims or graceful degradations in `src/platform/safari/` and docs.

## Todo

- [ ] Audit APIs used by the extension for Safari compatibility
- [ ] Implement shims for missing APIs or provide graceful fallbacks
- [ ] Ensure messaging and storage behave under Safari's extension model
- [ ] Add Vitest unit tests where possible and manual QA steps for Safari
- [ ] Document limitations and suggested user messaging when a feature is unavailable in Safari
