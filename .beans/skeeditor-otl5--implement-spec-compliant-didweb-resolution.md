---
# skeeditor-otl5
title: Implement spec-compliant did:web resolution
status: todo
type: bug
priority: high
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T14:04:21Z
parent: skeeditor-d3m1
---

`did:web` resolution currently assumes all identifiers map to `/.well-known/did.json`, which breaks path-based identifiers. Implement proper `did:web` URL construction and add regression tests.

## Todo
- [ ] Add failing tests for root and path-based `did:web` identifiers
- [ ] Implement spec-correct URL resolution for `did:web`
- [ ] Cover invalid and percent-encoded path cases
- [ ] Verify existing DID resolution behavior for `did:plc` remains unchanged
