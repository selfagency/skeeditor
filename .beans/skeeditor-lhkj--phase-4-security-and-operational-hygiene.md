---
# skeeditor-lhkj
title: Phase 4 — Security and operational hygiene
status: in-progress
type: task
priority: high
created_at: 2026-03-29T17:19:00Z
updated_at: 2026-03-29T17:19:16Z
---

## Context
Phase 4 of the Unified Implementation Plan. Security and operational hygiene hardening.

## Todo
- [ ] Gate sensitive logs in message-router.ts (DID/URI/CID only under debug flag)
- [ ] Audit and reduce innerHTML usage in options.ts
- [ ] Document DPoP key persistence posture in dpop.ts with threat model
- [ ] Write tests for log-gating and innerHTML reduction
- [ ] Run full test suite — all green
- [ ] Commit and open PR
