/**
 * UTF-8 byte length and grapheme utilities for AT Protocol facet handling.
 *
 * AT Protocol facets (rich-text annotations) use byte offsets into the
 * UTF-8-encoded text, not character or grapheme offsets. These helpers
 * provide the building blocks needed to create, validate, and recalculate
 * facet byte ranges after text edits.
 */

const encoder = new TextEncoder();

/**
 * Returns the number of bytes required to encode `str` in UTF-8.
 *
 * AT Protocol mandates byte offsets; always use this instead of
 * `str.length` when working with facet `byteStart` / `byteEnd` values.
 */
export function utf8ByteLength(str: string): number {
  return encoder.encode(str).byteLength;
}

/**
 * Returns the number of visible grapheme clusters in `str`.
 *
 * Grapheme clusters map to what users perceive as individual characters
 * (e.g. an emoji with ZWJ sequences counts as 1, not several code-points).
 * Used for post-length counting displayed to the user, NOT for byte offsets.
 */
export function graphemeLength(str: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  let count = 0;
  for (const _ of segmenter.segment(str)) {
    count++;
  }
  return count;
}

/**
 * Extracts a substring of `str` using UTF-8 byte offsets `[startByte, endByte)`.
 *
 * This mirrors how AT Protocol facets reference text spans. Byte positions
 * that land inside a multi-byte sequence are treated as boundaries of
 * complete code-units — partial bytes are not included.
 *
 * @param str       - The full UTF-8 string to slice.
 * @param startByte - Inclusive start byte offset.
 * @param endByte   - Exclusive end byte offset.
 * @returns The substring corresponding to the byte range, or an empty string
 *          if the range is out of bounds or invalid.
 */
export function byteSlice(str: string, startByte: number, endByte: number): string {
  const bytes = encoder.encode(str);
  const clampedStart = Math.max(0, Math.min(startByte, bytes.byteLength));
  const clampedEnd = Math.max(clampedStart, Math.min(endByte, bytes.byteLength));
  const slice = bytes.slice(clampedStart, clampedEnd);
  return new TextDecoder().decode(slice);
}
