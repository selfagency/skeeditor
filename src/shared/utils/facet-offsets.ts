/**
 * Facet byte-offset recalculation for AT Protocol rich text.
 *
 * AT Protocol facets reference text spans via UTF-8 byte offsets. Whenever
 * a post's text is edited, every facet's `byteStart`/`byteEnd` pair must be
 * recalculated to reflect the new byte positions in the edited text.
 *
 * Call `recalculateFacets` **before** `putRecord` whenever the post text has
 * changed. Pass it the original text, the edited text, and the facets from
 * the original record; it returns the updated facets ready to include in the
 * new record value.
 */

import type { Main as RichtextFacet } from '../../lexicons/app/bsky/richtext/facet.defs';

import { utf8ByteLength } from './text';

// ---------------------------------------------------------------------------
// Internal helpers — common prefix / suffix in UTF-16 code-unit space
// ---------------------------------------------------------------------------

/**
 * Returns the number of leading UTF-16 code units that are identical in
 * `a` and `b`, snapped back to a codepoint boundary so we never split a
 * surrogate pair.
 */
function commonPrefixCodeUnits(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  let i = 0;
  while (i < len && a[i] === b[i]) i++;

  // If we stopped with a high surrogate as the last matched code unit,
  // its low surrogate at `i` was not matched — retreat one position.
  if (i > 0) {
    const prev = a.charCodeAt(i - 1);
    if (prev >= 0xd800 && prev <= 0xdbff) i--;
  }

  return i;
}

/**
 * Returns the number of trailing UTF-16 code units shared between `a` and
 * `b`, without crossing `prefixLen`. Snapped forward past any leading low
 * surrogate at the suffix boundary so we never split a surrogate pair.
 */
function commonSuffixCodeUnits(a: string, b: string, prefixLen: number): number {
  let ia = a.length;
  let ib = b.length;

  while (ia > prefixLen && ib > prefixLen && a[ia - 1] === b[ib - 1]) {
    ia--;
    ib--;
  }

  // `ia` is now the start of the common suffix in `a`. If it lands on a low
  // surrogate (second half of a pair), advance one to keep the pair whole.
  if (ia < a.length) {
    const code = a.charCodeAt(ia);
    if (code >= 0xdc00 && code <= 0xdfff) ia++;
  }

  return a.length - ia;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Recalculates facet byte offsets after a text edit.
 *
 * ## Algorithm
 *
 * 1. Find the longest common prefix and suffix between `originalText` and
 *    `editedText` (in UTF-16 code-unit space, clamped to codepoint
 *    boundaries to handle emoji surrogate pairs).
 * 2. Convert the boundary positions to UTF-8 byte offsets, giving us:
 *    - `origEditStart`  — first byte in `originalText` that changed
 *    - `origEditEnd`    — first byte in `originalText` that is again shared
 *    - `editedEditEnd`  — first byte in `editedText` that is again shared
 *    - `delta`          — net byte-length change (`editedEditEnd − origEditEnd`)
 * 3. For each facet in `originalFacets`:
 *    - **Before edit** (`byteEnd ≤ origEditStart`): keep unchanged.
 *    - **After edit** (`byteStart ≥ origEditEnd`): shift both offsets by `delta`.
 *    - **Overlapping edit**: discard — the annotated text has been modified or
 *      destroyed and the facet can no longer be trusted.
 *
 * ## When to call
 *
 * Call this function **before** `XrpcClient.putRecord` whenever the post
 * text differs from the original. Pass the result as the `facets` field of
 * the updated record value. If the returned array is empty you may omit the
 * `facets` key entirely (or keep an empty array — both are valid).
 *
 * ## Edge cases
 *
 * - **Identical texts**: returns a shallow copy of `originalFacets`.
 * - **Empty facets**: returns `[]` immediately.
 * - **Full replacement**: all facets overlap → returns `[]`.
 * - **Multi-byte characters** (emoji, CJK, combining marks): byte delta is
 *   computed from `utf8ByteLength`, so multi-byte characters are handled
 *   correctly regardless of their JavaScript string length.
 *
 * @param originalText   - The post text before the edit.
 * @param editedText     - The post text after the edit.
 * @param originalFacets - Facets whose byte offsets reference `originalText`.
 * @returns New facets whose byte offsets reference `editedText`.
 */
export function recalculateFacets(
  originalText: string,
  editedText: string,
  originalFacets: RichtextFacet[],
): RichtextFacet[] {
  if (originalFacets.length === 0) return [];
  if (originalText === editedText) return originalFacets.slice();

  // Locate the edit region in code-unit (UTF-16) space.
  const prefixChars = commonPrefixCodeUnits(originalText, editedText);
  const suffixChars = commonSuffixCodeUnits(originalText, editedText, prefixChars);

  const origSuffixStart = originalText.length - suffixChars;
  const editedSuffixStart = editedText.length - suffixChars;

  // Convert code-unit positions to UTF-8 byte offsets.
  const origEditStart = utf8ByteLength(originalText.slice(0, prefixChars));
  const origEditEnd = utf8ByteLength(originalText.slice(0, origSuffixStart));
  const editedEditEnd = utf8ByteLength(editedText.slice(0, editedSuffixStart));

  // Net byte change introduced by the edit.
  const delta = editedEditEnd - origEditEnd;

  const result: RichtextFacet[] = [];

  for (const facet of originalFacets) {
    const { byteStart, byteEnd } = facet.index;

    if (byteEnd <= origEditStart) {
      // Entirely before the edit — preserve as-is.
      result.push(facet);
    } else if (byteStart >= origEditEnd) {
      // Entirely after the edit — shift both offsets by the byte delta.
      result.push({
        ...facet,
        index: { ...facet.index, byteStart: byteStart + delta, byteEnd: byteEnd + delta },
      });
    }
    // else: overlaps the edit region → discard.
  }

  return result;
}
