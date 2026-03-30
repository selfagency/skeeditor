---
# skeeditor-3gmv
title: Review unused auth and utility modules for integration or cleanup
status: todo
type: task
priority: normal
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T14:04:21Z
parent: skeeditor-d3m1
---

Several modules appear under-integrated or unused in production paths. Decide whether to integrate them properly, document them as future-facing, or remove them to reduce maintenance overhead.

## Todo
- [ ] Audit app-password auth, token refresh manager, facet offset utilities, and edited-badge helper usage
- [ ] Remove or integrate stale paths deliberately
- [ ] Update docs and tests for whichever direction is chosen
- [ ] Verify no dead references remain
