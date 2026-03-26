import { describe, expect, it } from 'vitest';

import { utf8ByteLength } from '@src/shared/utils/text';
import { buildFacets, detectHashtags, detectLinks, detectMentions, toByteOffsets } from '@src/shared/utils/facets';

describe('facet detectors', () => {
  it('should detect HTTP/HTTPS links with start/end character indices', () => {
    const text = 'Visit https://example.com/path now';
    const links = detectLinks(text);

    expect(links).toEqual([
      {
        kind: 'link',
        value: 'https://example.com/path',
        start: 6,
        end: 30,
      },
    ]);
  });

  it('should detect unicode hashtags', () => {
    const text = '今日は #日本語 のタグを使う';
    const hashtags = detectHashtags(text);

    expect(hashtags).toEqual([
      {
        kind: 'tag',
        value: '日本語',
        start: 4,
        end: 8,
      },
    ]);
  });

  it('should detect single-word handles without a dot segment', () => {
    const text = 'Hello @alice, how are you?';
    const mentions = detectMentions(text);

    expect(mentions).toEqual([
      {
        kind: 'mention',
        value: 'alice',
        start: 6,
        end: 12,
      },
    ]);
  });

  it('should detect handle mentions', () => {
    const text = 'Hello @alice.test and @bob.example';
    const mentions = detectMentions(text);

    expect(mentions).toEqual([
      {
        kind: 'mention',
        value: 'alice.test',
        start: 6,
        end: 17,
      },
      {
        kind: 'mention',
        value: 'bob.example',
        start: 22,
        end: 34,
      },
    ]);
  });

  it('should normalize mixed-case handle mentions to lowercase', () => {
    const text = 'Hey @Alice.Test and @BOB.Example';
    const mentions = detectMentions(text);

    expect(mentions).toEqual([
      {
        kind: 'mention',
        value: 'alice.test',
        start: 4,
        end: 15,
      },
      {
        kind: 'mention',
        value: 'bob.example',
        start: 20,
        end: 32,
      },
    ]);
  });
});

describe('facet byte offset helpers', () => {
  it('should convert character offsets to UTF-8 byte offsets', () => {
    const text = 'Hi 😀 #tag';
    const start = 5;
    const end = 9;
    const offsets = toByteOffsets(text, start, end);

    expect(offsets).toEqual({
      byteStart: utf8ByteLength(text.slice(0, start)),
      byteEnd: utf8ByteLength(text.slice(0, end)),
    });
  });
});

describe('buildFacets', () => {
  it('should build link and hashtag facets with byteStart/byteEnd', () => {
    const text = 'Hi 😀 https://example.com #日本語';
    const facets = buildFacets(text);

    expect(facets).toEqual([
      {
        $type: 'app.bsky.richtext.facet',
        index: {
          byteStart: utf8ByteLength('Hi 😀 '),
          byteEnd: utf8ByteLength('Hi 😀 https://example.com'),
        },
        features: [
          {
            $type: 'app.bsky.richtext.facet#link',
            uri: 'https://example.com',
          },
        ],
      },
      {
        $type: 'app.bsky.richtext.facet',
        index: {
          byteStart: utf8ByteLength('Hi 😀 https://example.com '),
          byteEnd: utf8ByteLength('Hi 😀 https://example.com #日本語'),
        },
        features: [
          {
            $type: 'app.bsky.richtext.facet#tag',
            tag: '日本語',
          },
        ],
      },
    ]);
  });

  it('should include mention facets only when mention DID resolver returns a DID', () => {
    const text = 'Hey @alice.test';
    const facets = buildFacets(text, {
      resolveMentionDid: handle => {
        if (handle === 'alice.test') return 'did:plc:alice123';
        return undefined;
      },
    });

    expect(facets).toEqual([
      {
        $type: 'app.bsky.richtext.facet',
        index: {
          byteStart: 4,
          byteEnd: 15,
        },
        features: [
          {
            $type: 'app.bsky.richtext.facet#mention',
            did: 'did:plc:alice123',
          },
        ],
      },
    ]);
  });

  it('should avoid tag/mention facets that overlap links', () => {
    const text = 'See https://example.com/@user#tag now';
    const facets = buildFacets(text);

    expect(facets).toEqual([
      {
        $type: 'app.bsky.richtext.facet',
        index: {
          byteStart: 4,
          byteEnd: 33,
        },
        features: [
          {
            $type: 'app.bsky.richtext.facet#link',
            uri: 'https://example.com/@user#tag',
          },
        ],
      },
    ]);
  });

  it('should omit mention facet when DID resolver returns undefined', () => {
    const text = 'Hey @unknown.user and @known.user';
    const facets = buildFacets(text, {
      resolveMentionDid: handle => {
        if (handle === 'known.user') return 'did:plc:known123';
        return undefined;
      },
    });

    expect(facets).toHaveLength(1);
    expect(facets[0]!.features[0]).toEqual({
      $type: 'app.bsky.richtext.facet#mention',
      did: 'did:plc:known123',
    });
  });
});
