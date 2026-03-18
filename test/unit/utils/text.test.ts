import { describe, expect, it } from 'vitest';

import { byteSlice, graphemeLength, utf8ByteLength } from '../../../src/shared/utils/text';

describe('utf8ByteLength', () => {
  it('should return 0 for an empty string', () => {
    expect(utf8ByteLength('')).toBe(0);
  });

  it('should return byte length equal to char length for ASCII', () => {
    expect(utf8ByteLength('hello')).toBe(5);
  });

  it('should return correct byte length for a string containing a 2-byte UTF-8 character', () => {
    // é = U+00E9, encoded as 2 bytes in UTF-8
    expect(utf8ByteLength('café')).toBe(5);
  });

  it('should return 3 bytes per character for CJK characters', () => {
    // 日 = U+65E5, encoded as 3 bytes in UTF-8
    expect(utf8ByteLength('日本語')).toBe(9);
  });

  it('should return 4 bytes for emoji (surrogate pair characters)', () => {
    // 😀 = U+1F600, encoded as 4 bytes in UTF-8
    expect(utf8ByteLength('😀')).toBe(4);
  });

  it('should handle mixed ASCII and multi-byte characters', () => {
    // "hi 😀" = 2 + 1 (space) + 4 = 7 bytes
    expect(utf8ByteLength('hi 😀')).toBe(7);
  });

  it('should handle a string with combining characters', () => {
    // e + combining acute accent (U+0301) = 1 + 2 = 3 bytes
    expect(utf8ByteLength('e\u0301')).toBe(3);
  });

  it('should handle a multi-codepoint ZWJ emoji sequence', () => {
    // 👨‍👩‍👧 = 👨(4) + ZWJ(3) + 👩(4) + ZWJ(3) + 👧(4) = 18 bytes
    expect(utf8ByteLength('👨\u200D👩\u200D👧')).toBe(18);
  });
});

describe('graphemeLength', () => {
  it('should return 0 for an empty string', () => {
    expect(graphemeLength('')).toBe(0);
  });

  it('should return character count for ASCII', () => {
    expect(graphemeLength('hello')).toBe(5);
  });

  it('should count each accented character as 1 grapheme', () => {
    expect(graphemeLength('café')).toBe(4);
  });

  it('should count each CJK character as 1 grapheme', () => {
    expect(graphemeLength('日本語')).toBe(3);
  });

  it('should count each emoji as 1 grapheme', () => {
    expect(graphemeLength('😀')).toBe(1);
  });

  it('should count composed grapheme clusters as 1 each', () => {
    // e + combining acute accent renders as 1 visible character
    expect(graphemeLength('e\u0301')).toBe(1);
  });

  it('should count ZWJ emoji sequences as a single grapheme', () => {
    // 👨‍👩‍👧 is one visible family emoji
    expect(graphemeLength('👨\u200D👩\u200D👧')).toBe(1);
  });

  it('should count multiple emojis correctly', () => {
    expect(graphemeLength('😀😂🎉')).toBe(3);
  });
});

describe('byteSlice', () => {
  it('should return an empty string when start equals end', () => {
    expect(byteSlice('hello', 0, 0)).toBe('');
  });

  it('should return the full string when slicing from 0 to byte length', () => {
    expect(byteSlice('hello', 0, 5)).toBe('hello');
  });

  it('should slice ASCII correctly', () => {
    expect(byteSlice('hello world', 6, 11)).toBe('world');
  });

  it('should extract a multi-byte character using correct byte offsets', () => {
    // "café" bytes: c(1) a(1) f(1) é(2) = [0,1,2,3,5]
    // bytes 3–5 = "é"
    expect(byteSlice('café', 3, 5)).toBe('é');
  });

  it('should extract a CJK character using correct byte offsets', () => {
    // 日(3) 本(3) 語(3) → bytes 3–6 = "本"
    expect(byteSlice('日本語', 3, 6)).toBe('本');
  });

  it('should extract an emoji using correct byte offsets', () => {
    // "hi 😀" = h(1) i(1) space(1) 😀(4), bytes 3–7 = "😀"
    expect(byteSlice('hi 😀', 3, 7)).toBe('😀');
  });

  it('should return empty string for out-of-bounds end byte', () => {
    // Silently clamp to available bytes
    expect(byteSlice('hi', 5, 10)).toBe('');
  });

  it('should handle slicing partial grapheme clusters gracefully', () => {
    // e + combining accent: bytes 0–1 is just "e" (without accent)
    expect(byteSlice('e\u0301', 0, 1)).toBe('e');
  });

  it('should drop a leading partial multi-byte codepoint at the start boundary', () => {
    // "😀A" = 😀(4 bytes) A(1 byte); start at byte 1 (inside 😀)
    expect(byteSlice('😀A', 1, 5)).toBe('A');
  });

  it('should drop a trailing partial multi-byte codepoint at the end boundary', () => {
    // "A😀" = A(1 byte) 😀(4 bytes); end at byte 2 (inside 😀)
    expect(byteSlice('A😀', 0, 2)).toBe('A');
  });

  it('should preserve only complete codepoints when both boundaries cut through multi-byte characters', () => {
    // "😀A😀" = 😀(4) A(1) 😀(4); slice bytes 1–8 cuts both emoji
    expect(byteSlice('😀A😀', 1, 8)).toBe('A');
  });
});
