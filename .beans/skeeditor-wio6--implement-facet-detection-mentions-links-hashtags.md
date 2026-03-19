---
# skeeditor-wio6
title: Implement facet detection (mentions, links, hashtags)
status: completed
type: feature
priority: critical
created_at: 2026-03-18T14:26:46Z
updated_at: 2026-03-19T16:59:09Z
parent: skeeditor-v67t
---

Detect mentions, links, and hashtags from text to produce initial facets array.

## Todo

- [x] Implement mention, link, and hashtag detectors with clear interfaces
- [x] Add unit tests (Vitest) for detection across languages and multi-byte characters
- [x] Integrate detection output with facet data model (NSID and indices)
- [x] Provide utility to convert detection ranges to byte-offset facets using `facet-offsets` helpers
- [x] Add integration test that runs detection then putRecord (MSW + Vitest)

## Summary of Changes

- Added `src/shared/utils/facets.ts` with `detectLinks`, `detectMentions`, `detectHashtags`, `toByteOffsets`, and `buildFacets`.
- Normalized mixed-case handles for mention resolution while preserving original span offsets.
- Added unit coverage for detectors, overlap handling, and UTF-8 byte-offset conversion.
- Added integration coverage confirming detected facets are sent in `putRecord` request bodies.
- Landed the feature in main via PR #8, unblocking facet recalculation and edit-flow work.
