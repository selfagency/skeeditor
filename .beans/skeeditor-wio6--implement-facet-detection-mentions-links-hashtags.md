---
# skeeditor-wio6
title: Implement facet detection (mentions, links, hashtags)
status: completed
type: feature
priority: critical
created_at: 2026-03-18T14:26:46Z
updated_at: 2026-03-18T19:59:51Z
parent: skeeditor-v67t
---

Detect mentions, links, and hashtags from text to produce initial facets array.

## Todo

- [ ] Implement mention, link, and hashtag detectors with clear interfaces
- [ ] Add unit tests (Vitest) for detection across languages and multi-byte characters
- [ ] Integrate detection output with facet data model (NSID and indices)
- [ ] Provide utility to convert detection ranges to byte-offset facets using `facet-offsets` helpers
- [ ] Add integration test that runs detection then putRecord (MSW + Vitest)
