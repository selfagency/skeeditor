---
# skeeditor-je5f
title: Implement facet byte-offset recalculation on text change
status: todo
type: feature
priority: critical
created_at: 2026-03-18T14:26:52Z
updated_at: 2026-03-18T14:48:10Z
parent: skeeditor-v67t
---

Recalculate facet byte offsets when text is edited, handling multi-byte characters and grapheme boundaries to preserve correct annotations.

Note: This module is non-UI but must expose a stable API for the UI Web Components and message router to call before putRecord.

## Todo

- [ ] Design API: `recalculateFacets(originalText, editedText, originalFacets) -> newFacets`
- [ ] Implement algorithm using `utf8ByteLength` and grapheme helpers from `text.ts`
- [ ] Handle insertions, deletions, and replacements; preserve facet anchors when possible
- [ ] Add Vitest unit tests with multi-byte characters (emoji, CJK, combining marks)
- [ ] Add fuzz tests for random edits to validate invariants
- [ ] Add integration test that reads a record, opens modal, edits text, recalculates facets, and calls putRecord (MSW + Vitest)
- [ ] Document edge cases and recommended calling patterns in `src/shared/utils/README.md`
