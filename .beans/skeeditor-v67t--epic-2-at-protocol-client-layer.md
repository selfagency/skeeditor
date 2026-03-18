---
# skeeditor-v67t
title: 'Epic 2: AT Protocol Client Layer'
status: in-progress
type: epic
priority: critical
created_at: 2026-03-18T14:25:21Z
updated_at: 2026-03-18T18:13:14Z
parent: skeeditor-bmr4
branch: feature/skeeditor-v67t-at-protocol-client-layer
---

Implement AT Protocol client layer: AT URI parsing, byte/grapheme utilities, facet detection and recalculation, XRPC client wrapper, putRecord with swapRecord and validation.

## Todo

- [ ] Implement AT URI parser utility and export types
- [ ] Implement UTF-8 byte length & grapheme utilities (integrate with `text.ts`)
- [ ] Implement facet detection and initial facet generation
- [ ] Implement facet byte-offset recalculation and helpers
- [ ] Implement XRPC client wrapper using `@atproto/lex` or fetch-based wrapper
- [ ] Implement putRecord with `swapRecord` handling, structured errors, and hooks for edited-post labeling
- [ ] Add Lexicon validation step before `putRecord`
- [ ] Write Vitest unit tests for all utilities (target: ≥90% coverage for `src/shared/`)
- [ ] Add integration Vitest tests (MSW) for read→modify→write flows
- [ ] Document API & public helpers in `src/shared/api/README.md`

### Planned follow-up beans

- `skeeditor-3g2u` — implement edited-post labeler integration
