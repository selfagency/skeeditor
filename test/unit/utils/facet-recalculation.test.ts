import { describe, expect, it } from 'vitest';

import type { Main as RichtextFacet } from '@src/lexicons/app/bsky/richtext/facet.defs';
import { recalculateFacets } from '@src/shared/utils/facet-offsets';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal tag facet for test assertions. */
function tagFacet(byteStart: number, byteEnd: number, tag = 'test'): RichtextFacet {
  return {
    $type: 'app.bsky.richtext.facet',
    index: { byteStart, byteEnd },
    features: [{ $type: 'app.bsky.richtext.facet#tag', tag }],
  };
}

/** Build a minimal link facet for test assertions. */
function linkFacet(byteStart: number, byteEnd: number, uri = 'https://example.com'): RichtextFacet {
  return {
    $type: 'app.bsky.richtext.facet',
    index: { byteStart, byteEnd },
    features: [{ $type: 'app.bsky.richtext.facet#link', uri: uri as `${string}:${string}` }],
  };
}

/** Build a minimal mention facet for test assertions. */
function mentionFacet(byteStart: number, byteEnd: number, did = 'did:plc:abc123'): RichtextFacet {
  return {
    $type: 'app.bsky.richtext.facet',
    index: { byteStart, byteEnd },
    features: [{ $type: 'app.bsky.richtext.facet#mention', did: did as `did:${string}:${string}` }],
  };
}

// ---------------------------------------------------------------------------
// No-op / identity
// ---------------------------------------------------------------------------

describe('recalculateFacets — no-op edits', () => {
  it('should return a copy of facets unchanged when text is identical', () => {
    const text = 'Hello #tag';
    const facets = [tagFacet(6, 10)];

    const result = recalculateFacets(text, text, facets);

    expect(result).toEqual(facets);
  });

  it('should return an empty array when originalFacets is empty', () => {
    expect(recalculateFacets('Hello', 'Hello world', [])).toEqual([]);
  });

  it('should preserve all facets when only appending text after last facet', () => {
    // "#tag" at start, append " more text" at end — facet is untouched
    const original = '#tag';
    const edited = '#tag more text';
    const facets = [tagFacet(0, 4, 'tag')];

    const result = recalculateFacets(original, edited, facets);

    expect(result).toEqual(facets);
  });
});

// ---------------------------------------------------------------------------
// Insertions (delta > 0)
// ---------------------------------------------------------------------------

describe('recalculateFacets — ASCII insertions', () => {
  it('should shift facet right when ASCII text is prepended before it', () => {
    // original: "Hello #tag"  — "#tag" at byte 6–10
    // edited:   "Yo! Hello #tag"  — 4 bytes prepended → "#tag" at byte 10–14
    const original = 'Hello #tag';
    const edited = 'Yo! Hello #tag';
    const facets = [tagFacet(6, 10, 'tag')];

    const result = recalculateFacets(original, edited, facets);

    expect(result).toEqual([tagFacet(10, 14, 'tag')]);
  });

  it('should shift facet right when ASCII text is inserted before it mid-string', () => {
    // original: "Hi @alice today"
    //           0123456789...
    // "@alice" → byteStart=3, byteEnd=9
    // edited:   "Hi there, @alice today"  — "there, " (7 bytes) inserted after "Hi "
    const original = 'Hi @alice today';
    const edited = 'Hi there, @alice today';
    const facets = [mentionFacet(3, 9)];

    const result = recalculateFacets(original, edited, facets);

    // "Hi there, " = 10 bytes → "@alice" at byte 10–16
    expect(result).toEqual([mentionFacet(10, 16)]);
  });

  it('should not shift facet when insertion is after it', () => {
    // "#tag" at bytes 0–4, then insert " - more" after
    const original = '#tag Hello';
    const edited = '#tag Hello - more';
    const facets = [tagFacet(0, 4, 'tag')];

    const result = recalculateFacets(original, edited, facets);

    expect(result).toEqual([tagFacet(0, 4, 'tag')]);
  });

  it('should shift only facets after the insertion point, not those before', () => {
    // original: "@alice and #cool"
    //   @alice  → 0–6
    //   #cool   → 11–16
    // edited: "@alice and some more #cool"  — "some more " inserted after "and "
    const original = '@alice and #cool';
    const edited = '@alice and some more #cool';
    const facets = [mentionFacet(0, 6), tagFacet(11, 16, 'cool')];

    const result = recalculateFacets(original, edited, facets);

    // "@alice" unchanged; "#cool" shifts by 10 bytes ("some more " = 10)
    expect(result).toEqual([mentionFacet(0, 6), tagFacet(21, 26, 'cool')]);
  });
});

// ---------------------------------------------------------------------------
// Multi-byte insertions (emoji and CJK)
// ---------------------------------------------------------------------------

describe('recalculateFacets — multi-byte character insertions', () => {
  it('should shift facet by 4 bytes when a single emoji is prepended', () => {
    // "😀" encodes to 4 bytes in UTF-8
    // original: "Hello #tag"  — "#tag" at byte 6–10
    // edited:   "😀Hello #tag"  — "#tag" shifts to byte 10–14
    const original = 'Hello #tag';
    const edited = '😀Hello #tag';
    const facets = [tagFacet(6, 10, 'tag')];

    const result = recalculateFacets(original, edited, facets);

    expect(result).toEqual([tagFacet(10, 14, 'tag')]);
  });

  it('should shift facet by correct byte count when emoji + space are prepended', () => {
    // "😀 " = 4 + 1 = 5 bytes
    const original = 'Hello #tag';
    const edited = '😀 Hello #tag';
    const facets = [tagFacet(6, 10, 'tag')];

    const result = recalculateFacets(original, edited, facets);

    // "#tag" in edited: "😀 Hello " = 5+6 = 11 bytes before "#tag"
    expect(result).toEqual([tagFacet(11, 15, 'tag')]);
  });

  it('should shift facet by 9 bytes when 3 CJK characters are prepended', () => {
    // Each CJK char is 3 bytes; "日本語" = 9 bytes
    const original = '#tag';
    const edited = '日本語#tag';
    const facets = [tagFacet(0, 4, 'tag')];

    const result = recalculateFacets(original, edited, facets);

    expect(result).toEqual([tagFacet(9, 13, 'tag')]);
  });

  it('should shift facet correctly when a ZWJ emoji sequence is inserted', () => {
    // 👨‍👩‍👧 = 👨(4) + ZWJ(3) + 👩(4) + ZWJ(3) + 👧(4) = 18 bytes
    const original = '#tag';
    const edited = '👨\u200D👩\u200D👧 #tag';
    const facets = [tagFacet(0, 4, 'tag')];

    const result = recalculateFacets(original, edited, facets);

    // 18 bytes (ZWJ sequence) + 1 space = 19 bytes before "#tag"
    expect(result).toEqual([tagFacet(19, 23, 'tag')]);
  });
});

// ---------------------------------------------------------------------------
// Deletions (delta < 0)
// ---------------------------------------------------------------------------

describe('recalculateFacets — deletions', () => {
  it('should shift facet left when ASCII text before it is deleted', () => {
    // original: "Hello world #tag"  — "#tag" at byte 12–16
    // edited:   "Hello #tag"  — " world" (6 bytes) deleted → "#tag" at byte 6–10
    const original = 'Hello world #tag';
    const edited = 'Hello #tag';
    const facets = [tagFacet(12, 16, 'tag')];

    const result = recalculateFacets(original, edited, facets);

    expect(result).toEqual([tagFacet(6, 10, 'tag')]);
  });

  it('should not shift facet when text after it is deleted', () => {
    // original: "#tag and some extra words"
    // edited:   "#tag"  — delete everything after "#tag"
    const original = '#tag and some extra words';
    const edited = '#tag';
    const facets = [tagFacet(0, 4, 'tag')];

    const result = recalculateFacets(original, edited, facets);

    expect(result).toEqual([tagFacet(0, 4, 'tag')]);
  });

  it('should shift facet left by correct byte count when emoji before it is deleted', () => {
    // original: "😀 #tag"  — "#tag" at byte 5–9 (4+1 space before)
    // edited:   "#tag"
    const original = '😀 #tag';
    const edited = '#tag';
    const facets = [tagFacet(5, 9, 'tag')];

    const result = recalculateFacets(original, edited, facets);

    expect(result).toEqual([tagFacet(0, 4, 'tag')]);
  });

  it('should shift facet left by 9 bytes when 3 CJK chars before it are deleted', () => {
    // original: "日本語#tag"  — "#tag" at byte 9–13
    // edited:   "#tag"
    const original = '日本語#tag';
    const edited = '#tag';
    const facets = [tagFacet(9, 13, 'tag')];

    const result = recalculateFacets(original, edited, facets);

    expect(result).toEqual([tagFacet(0, 4, 'tag')]);
  });
});

// ---------------------------------------------------------------------------
// Discards — edits overlapping the annotated region
// ---------------------------------------------------------------------------

describe('recalculateFacets — overlapping edits discard the facet', () => {
  it('should discard a facet when its entire text is replaced', () => {
    // "#tag" replaced with "something else"
    const original = 'Hello #tag world';
    const edited = 'Hello something else world';
    const facets = [tagFacet(6, 10, 'tag')];

    const result = recalculateFacets(original, edited, facets);

    expect(result).toEqual([]);
  });

  it('should discard a facet when its start is overlapped by the edit', () => {
    // original: "Check #tag out"  — "#tag" at byte 6–10
    // edited:   "Check ta out"  — "# " at start of facet replaced
    const original = 'Check #tag out';
    const edited = 'Check ta out';
    const facets = [tagFacet(6, 10, 'tag')];

    const result = recalculateFacets(original, edited, facets);

    expect(result).toEqual([]);
  });

  it('should discard a facet when its end is overlapped by the edit', () => {
    // original: "say #cool bye"  — "#cool" at byte 4–9
    // edited:   "say #co bye"  — "ol" at end trimmed
    const original = 'say #cool bye';
    const edited = 'say #co bye';
    const facets = [tagFacet(4, 9, 'cool')];

    const result = recalculateFacets(original, edited, facets);

    expect(result).toEqual([]);
  });

  it('should discard a facet when the edit region exactly matches it', () => {
    // delete the exact bytes that are the facet
    const original = 'before #tag after';
    const edited = 'before  after';
    const facets = [tagFacet(7, 11, 'tag')];

    const result = recalculateFacets(original, edited, facets);

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Mixed — multiple facets with varied outcomes
// ---------------------------------------------------------------------------

describe('recalculateFacets — multiple facets', () => {
  it('should selectively keep, shift, and discard facets based on edit position', () => {
    // original: "@alice check https://example.com and #cool"
    //   @alice        → byteStart=0,  byteEnd=6
    //   https://...   → byteStart=13, byteEnd=32
    //   #cool         → byteStart=37, byteEnd=42
    //
    // edited:   "@alice check and #cool"
    //   — "https://example.com " deleted (19+1 = 20 bytes at position 13)
    //
    // Result:
    //   @alice stays at 0–6 (before edit)
    //   link is discarded (overlaps)
    //   #cool shifts: 37 - 20 = 17, 42 - 20 = 22
    const original = '@alice check https://example.com and #cool';
    const edited = '@alice check and #cool';

    // "@alice" = 6 bytes, then " check " = 7 → link starts at 13
    // "https://example.com" = 19 bytes → ends at 32
    // " and " = 5 bytes (32..37), "#cool" = 5 bytes (37..42)
    const facets: RichtextFacet[] = [
      mentionFacet(0, 6),
      linkFacet(13, 32, 'https://example.com'),
      tagFacet(37, 42, 'cool'),
    ];

    const result = recalculateFacets(original, edited, facets);

    expect(result).toEqual([mentionFacet(0, 6), tagFacet(17, 22, 'cool')]);
  });

  it('should preserve feature data (type, payload) on shifted facets', () => {
    // Verify the features array is passed through unchanged when shifting
    const original = 'Hello #cool';
    const edited = 'Well hello there, Hello #cool';
    const originalFacet = tagFacet(6, 11, 'cool');
    const facets = [originalFacet];

    const result = recalculateFacets(original, edited, facets);

    expect(result[0]?.features).toEqual(originalFacet.features);
  });

  it('should handle a mix of kept-unchanged and shifted facets', () => {
    // Three hashtags in a row; insert text between first and second
    // original: "#a #b #c"  (bytes: 0-2, 3-5, 6-8)
    // edited:   "#a inserted #b #c"
    const original = '#a #b #c';
    const edited = '#a inserted #b #c';

    // "#a" = 0–2, "#b" = 3–5, "#c" = 6–8
    const facets = [tagFacet(0, 2, 'a'), tagFacet(3, 5, 'b'), tagFacet(6, 8, 'c')];

    const result = recalculateFacets(original, edited, facets);

    // "inserted " = 9 bytes inserted after "#a "
    // "#a" unchanged, "#b" shifts 3→12, "#c" shifts 6→15
    expect(result).toEqual([tagFacet(0, 2, 'a'), tagFacet(12, 14, 'b'), tagFacet(15, 17, 'c')]);
  });
});

// ---------------------------------------------------------------------------
// Boundary conditions
// ---------------------------------------------------------------------------

describe('recalculateFacets — boundary conditions', () => {
  it('should keep a facet that ends exactly at the edit start (boundary case)', () => {
    // Facet exactly ends where edit begins — facet is "before" the edit
    // original: "#tag next"  — "#tag" at byte 0–4
    // edited:   "#tag REPLACED"  — edit starts at byte 5 (after "#tag ")
    const original = '#tag next';
    const edited = '#tag REPLACED';
    // "#tag" ends at byte 4; " next" → "REPLACED" edit starts at byte 5
    const facets = [tagFacet(0, 4, 'tag')];

    const result = recalculateFacets(original, edited, facets);

    expect(result).toEqual([tagFacet(0, 4, 'tag')]);
  });

  it('should shift a facet that starts exactly at the edit end (boundary case)', () => {
    // Edit ends exactly where the facet starts — facet is "after" the edit
    // original: "remove#tag"  — "#tag" at byte 6–10
    // edited:   "#tag"  — "remove" (6 bytes) deleted at front, "#tag" starts at 0
    const original = 'remove#tag';
    const edited = '#tag';
    const facets = [tagFacet(6, 10, 'tag')];

    const result = recalculateFacets(original, edited, facets);

    expect(result).toEqual([tagFacet(0, 4, 'tag')]);
  });

  it('should handle a combining mark character insertion (2-byte UTF-8) before a facet', () => {
    // "é" decomposed = "e" + combining acute (U+0301, 2 bytes) = 3 bytes total
    // original: "#tag"
    // edited:   "e\u0301#tag" — "e" + combining accent = 3 bytes prepended
    const original = '#tag';
    const edited = 'e\u0301#tag';
    const facets = [tagFacet(0, 4, 'tag')];

    const result = recalculateFacets(original, edited, facets);

    // "e" (1 byte) + "\u0301" (2 bytes) = 3 bytes before "#tag"
    expect(result).toEqual([tagFacet(3, 7, 'tag')]);
  });

  it('should produce no results when all text is replaced', () => {
    const original = 'Hello #tag @alice';
    const edited = 'Completely different content';
    const facets = [tagFacet(6, 10, 'tag'), mentionFacet(11, 17)];

    const result = recalculateFacets(original, edited, facets);

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Fuzz: invariant checking
// ---------------------------------------------------------------------------

describe('recalculateFacets — fuzz invariants', () => {
  // Simple LCG pseudo-random for reproducibility (no external dependency)
  function lcg(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0x100000000;
    };
  }

  const ASCII_CHARS = 'abcdefghijklmnopqrstuvwxyz #@. ';
  const MULTIBYTE_CHARS = ['😀', '😂', '日', '本', '語', 'é', '\u0301', '👨\u200D👩\u200D👧'];

  function randomString(rand: () => number, len: number): string {
    const chars = [...ASCII_CHARS, ...MULTIBYTE_CHARS];
    let s = '';
    for (let i = 0; i < len; i++) {
      s += chars[Math.floor(rand() * chars.length)] ?? 'a';
    }
    return s;
  }

  it('should always produce facets with valid byte offsets in the edited text (100 random edits)', () => {
    const rand = lcg(42);

    for (let trial = 0; trial < 100; trial++) {
      const baseLen = Math.floor(rand() * 30) + 5;
      const originalText = randomString(rand, baseLen);

      // Simulate a random edit: pick insertion or deletion point
      const editKind = rand() < 0.5 ? 'insert' : 'delete';
      const pos = Math.floor(rand() * (originalText.length + 1));

      let editedText: string;
      if (editKind === 'insert') {
        const insertion = randomString(rand, Math.floor(rand() * 10) + 1);
        editedText = originalText.slice(0, pos) + insertion + originalText.slice(pos);
      } else {
        const delLen = Math.floor(rand() * Math.min(10, originalText.length - pos)) + 1;
        editedText = originalText.slice(0, pos) + originalText.slice(pos + delLen);
      }

      // Build some synthetic facets on valid byte positions in original
      const encoder = new TextEncoder();
      const origBytes = encoder.encode(originalText);
      const totalOrigBytes = origBytes.byteLength;

      const facets: RichtextFacet[] = [];
      if (totalOrigBytes >= 2) {
        const s = Math.floor(rand() * (totalOrigBytes - 1));
        const e = s + Math.floor(rand() * (totalOrigBytes - s)) + 1;
        facets.push(tagFacet(s, Math.min(e, totalOrigBytes)));
      }

      const result = recalculateFacets(originalText, editedText, facets);

      const totalEditedBytes = encoder.encode(editedText).byteLength;

      for (const facet of result) {
        const { byteStart, byteEnd } = facet.index;
        expect(byteStart, `trial ${trial}: byteStart must be ≥ 0`).toBeGreaterThanOrEqual(0);
        expect(byteEnd, `trial ${trial}: byteEnd must be ≥ byteStart`).toBeGreaterThanOrEqual(byteStart);
        expect(byteEnd, `trial ${trial}: byteEnd must be ≤ editedText byte length`).toBeLessThanOrEqual(
          totalEditedBytes,
        );
      }
    }
  });
});
