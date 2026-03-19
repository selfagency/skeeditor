---
# skeeditor-v67t
title: 'Epic 2: AT Protocol Client Layer'
status: completed
type: epic
priority: critical
created_at: 2026-03-18T14:25:21Z
updated_at: 2026-03-18T18:13:14Z
parent: skeeditor-bmr4
branch: feature/skeeditor-v67t-at-protocol-client-layer
---

Implement AT Protocol client layer: AT URI parsing, byte/grapheme utilities, facet detection and recalculation, XRPC client wrapper, putRecord with swapRecord and validation.

## Todo

- [x] Implement AT URI parser utility and export types
- [x] Implement UTF-8 byte length & grapheme utilities (integrate with `text.ts`)
- [x] Implement facet detection and initial facet generation
- [x] Implement facet byte-offset recalculation and helpers
- [x] Implement XRPC client wrapper using `@atproto/lex` or fetch-based wrapper
- [x] Implement putRecord with `swapRecord` handling, structured errors, and hooks for edited-post labeling
- [x] Add Lexicon validation step before `putRecord`
- [x] Write Vitest unit tests for all utilities (target: ≥90% coverage for `src/shared/`)
- [x] Add integration Vitest tests (MSW) for read→modify→write flows
- [x] Document API & public helpers in `src/shared/api/README.md`

## Summary of Changes

- Implemented the AT Protocol client foundation across `src/shared/` including AT URI parsing, UTF-8/grapheme utilities, facet detection, facet byte-offset recalculation, and the XRPC client wrapper.
- Added optimistic-concurrency support for edit flows via `putRecordWithSwap()` and three-way merge advisory helpers for conflict-aware UI retry flows.
- Landed comprehensive unit and integration coverage for the client-layer utilities and read→modify→write workflows.
- Documented shared APIs and conflict-handling guidance so later message-router and modal beans can consume a stable client layer.

### Planned follow-up beans

- `skeeditor-3g2u` — implement edited-post labeler integration
