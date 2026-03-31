---
# skeeditor-i1di
title: Audit manifest permissions and remove unnecessary access
status: todo
type: task
priority: normal
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T14:04:21Z
parent: skeeditor-d3m1
---

The manifest and docs should request only the permissions the extension truly uses. Re-audit `activeTab`, `tabs`, `alarms`, and related permission disclosures for least-privilege and documentation accuracy.

## Todo
- [ ] Trace runtime usage of all requested permissions
- [ ] Remove unneeded permissions from the manifest if safe
- [ ] Update docs to justify every retained permission
- [ ] Re-run extension tests/build to confirm no regressions
