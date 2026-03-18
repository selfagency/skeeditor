---
# skeeditor-nlfp
title: Implement UTF-8 byte length and grapheme utilities
status: in-progress
type: feature
priority: critical
created_at: 2026-03-18T14:26:42Z
updated_at: 2026-03-18T18:35:45Z
parent: skeeditor-v67t
---

Utilities for UTF-8 byte length, grapheme segmentation, and safe substring operations needed for facet offsets.

## Todo

- [x] Implement `utf8ByteLength(str)` and `byteSlice(str, startByte, endByte)` helpers
- [x] Implement grapheme segmentation helpers using `Intl.Segmenter` for grapheme counting
- [x] Add Vitest unit tests covering emoji, CJK, combining marks, and ZWJ sequences (24 tests)
- [ ] Benchmark common cases and document performance considerations
- [ ] Export helpers and wire into `facet-offsets.ts` implementation
