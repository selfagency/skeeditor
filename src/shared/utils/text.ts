/**
 * UTF-8 byte length and grapheme utilities for AT Protocol facet handling.
 *
 * AT Protocol facets (rich-text annotations) use byte offsets into the
 * UTF-8-encoded text, not character or grapheme offsets. These helpers
 * provide the building blocks needed to create, validate, and recalculate
 * facet byte ranges after text edits.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function graphemeLength(str: string): number {
  let count = 0;
  for (const _ of graphemeSegmenter.segment(str)) {
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
// UTF-8 continuation bytes have the form 10xxxxxx (0x80–0xBF).
const isUtf8ContinuationByte = (byte: number): boolean => (byte & 0xc0) === 0x80;

// Returns the length in bytes of the UTF-8 codepoint that starts at `bytes[i]`.
const utf8SequenceLength = (byte: number): number => {
  if ((byte & 0x80) === 0x00) return 1; // 0xxxxxxx
  if ((byte & 0xe0) === 0xc0) return 2; // 110xxxxx
  if ((byte & 0xf0) === 0xe0) return 3; // 1110xxxx
  return 4; // 11110xxx
};

const alignToCodepointBoundaries = (bytes: Uint8Array, start: number, end: number): { start: number; end: number } => {
  // Advance start past any leading continuation bytes (they belong to a codepoint
  // whose lead byte is before `start`, so they must be excluded).
  let s = start;
  while (s < end && isUtf8ContinuationByte(bytes[s]!)) s++;

  // Walk forward from s to find the last complete codepoint boundary ≤ end.
  let e = s;
  while (e < end) {
    const seqLen = utf8SequenceLength(bytes[e]!);
    if (e + seqLen > end) break; // This codepoint would extend past `end` — stop.
    e += seqLen;
  }

  return { start: s, end: e };
};

export function byteSlice(str: string, startByte: number, endByte: number): string {
  const bytes = encoder.encode(str);
  const clampedStart = Math.max(0, Math.min(startByte, bytes.byteLength));
  const clampedEnd = Math.max(clampedStart, Math.min(endByte, bytes.byteLength));
  const { start, end } = alignToCodepointBoundaries(bytes, clampedStart, clampedEnd);
  if (start >= end) return '';
  return decoder.decode(bytes.slice(start, end));
}
