---
# skeeditor-je5f
title: Implement facet byte-offset recalculation on text change
status: completed
type: feature
priority: critical
created_at: 2026-03-18T14:26:52Z
updated_at: 2026-03-19T17:01:37Z
parent: skeeditor-v67t
blocked_by:
    - skeeditor-wio6
---

Recalculate facet byte offsets when text is edited, handling multi-byte characters and grapheme boundaries to preserve correct annotations.

Note: This module is non-UI but must expose a stable API for the UI Web Components and message router to call before putRecord.

## Todo

- [x] Design API: `recalculateFacets(originalText, editedText, originalFacets) -> newFacets`
- [x] Implement algorithm using `utf8ByteLength` and grapheme helpers from `text.ts`
- [x] Handle insertions, deletions, and replacements; preserve facet anchors when possible
- [x] Add Vitest unit tests with multi-byte characters (emoji, CJK, combining marks)
- [x] Add fuzz tests for random edits to validate invariants
- [x] Add integration test that reads a record, opens modal, edits text, recalculates facets, and calls putRecord (MSW + Vitest)
- [x] Document edge cases and recommended calling patterns in `src/shared/utils/README.md`

## Summary of Changes

- Added `src/shared/utils/facet-offsets.ts` with `recalculateFacets` for byte-accurate facet offset updates after text edits.
- Implemented edit-region diffing using common prefix/suffix detection and UTF-8 byte-length deltas.
- Preserved unaffected facets, shifted trailing facets, and discarded facets overlapping the edited region.
- Added broad unit coverage for insertions, deletions, replacements, emoji, CJK, combining characters, and fuzz-style invariants.
- Landed the recalculation utility in main via PR #9, unblocking later edit-modal work.
