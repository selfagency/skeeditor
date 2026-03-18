---
# skeeditor-nlfp
title: Implement UTF-8 byte length and grapheme utilities
status: todo
type: feature
priority: critical
created_at: 2026-03-18T14:26:42Z
updated_at: 2026-03-18T14:45:31Z
parent: skeeditor-v67t
---

Utilities for UTF-8 byte length, grapheme segmentation, and safe substring operations needed for facet offsets.

## Todo

- [ ] Implement `utf8ByteLength(str)` and `byteSlice(str, startByte, endByte)` helpers
- [ ] Implement grapheme segmentation helpers using `Intl.Segmenter` fallback for older browsers
- [ ] Add Vitest unit tests covering emoji, CJK, and combining marks
- [ ] Benchmark common cases and document performance considerations
- [ ] Export helpers and wire into `facet-offsets.ts` implementation
