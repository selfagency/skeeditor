---
# skeeditor-ph3q
title: Fix media upload ordering and mixed-media validation
status: todo
type: bug
priority: high
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T14:04:21Z
parent: skeeditor-d3m1
---

Media uploads currently depend on selection order and can mis-map uploaded blobs to embeds. Enforce valid media combinations and ensure blob assignment always matches the embed placeholders.

## Todo
- [ ] Add failing tests for image-only, video-only, and mixed-media cases
- [ ] Reject unsupported mixed-media or over-limit selections in the UI
- [ ] Preserve deterministic blob-to-embed ordering
- [ ] Verify upload success and user-facing error handling
- [ ] Run relevant unit and integration tests
