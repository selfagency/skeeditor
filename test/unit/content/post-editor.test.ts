import { describe, expect, it } from 'vitest';

import { buildUpdatedPostRecord, type EditablePostRecord } from '@src/content/post-editor';

describe('post-editor', () => {
  it('should preserve the existing record fields while updating text and facets', () => {
    const currentRecord: EditablePostRecord = {
      $type: 'app.bsky.feed.post' as const,
      text: 'Hello @alice.test https://example.com',
      createdAt: '2026-03-18T12:00:00.000Z',
      embed: { $type: 'app.bsky.embed.external', external: { uri: 'https://example.com', title: 'Example' } },
      langs: ['en'],
    };

    const nextRecord = buildUpdatedPostRecord(currentRecord, 'Updated text with #tag');

    expect(nextRecord).toMatchObject({
      $type: 'app.bsky.feed.post',
      text: 'Updated text with #tag',
      createdAt: '2026-03-18T12:00:00.000Z',
      embed: currentRecord.embed,
      langs: ['en'],
    });
    expect(nextRecord.facets).toHaveLength(1);
  });

  it('should omit facets when the updated text has no detected facets', () => {
    const currentRecord: EditablePostRecord = {
      $type: 'app.bsky.feed.post' as const,
      text: 'Hello @alice.test',
      createdAt: '2026-03-18T12:00:00.000Z',
      facets: [
        {
          $type: 'app.bsky.richtext.facet' as const,
          index: { byteStart: 6, byteEnd: 17 },
          features: [
            {
              $type: 'app.bsky.richtext.facet#mention' as const,
              did: 'did:plc:alice123',
            },
          ],
        },
      ],
    };

    const nextRecord = buildUpdatedPostRecord(currentRecord, 'Plain post text');

    expect(nextRecord).not.toHaveProperty('facets');
  });

  it('should preserve mention facets when the current record already resolved the DID', () => {
    const currentRecord: EditablePostRecord = {
      $type: 'app.bsky.feed.post' as const,
      text: 'Hello @alice.test',
      createdAt: '2026-03-18T12:00:00.000Z',
      facets: [
        {
          $type: 'app.bsky.richtext.facet' as const,
          index: { byteStart: 6, byteEnd: 17 },
          features: [{ $type: 'app.bsky.richtext.facet#mention' as const, did: 'did:plc:alice123' }],
        },
      ],
    };

    const nextRecord = buildUpdatedPostRecord(currentRecord, 'Hi @alice.test and #tag');

    expect(nextRecord.facets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          features: [expect.objectContaining({ $type: 'app.bsky.richtext.facet#mention', did: 'did:plc:alice123' })],
        }),
      ]),
    );
  });

  it('should resolve mention DIDs correctly when text contains multi-byte characters before the mention', () => {
    // "🎉 @alice.test" — the emoji 🎉 is 4 UTF-8 bytes, so @alice.test starts at byte 5 (4 + 1 space)
    const currentRecord: EditablePostRecord = {
      $type: 'app.bsky.feed.post' as const,
      text: '🎉 @alice.test',
      createdAt: '2026-03-18T12:00:00.000Z',
      facets: [
        {
          $type: 'app.bsky.richtext.facet' as const,
          index: { byteStart: 5, byteEnd: 16 },
          features: [{ $type: 'app.bsky.richtext.facet#mention' as const, did: 'did:plc:alice123' }],
        },
      ],
    };

    const nextRecord = buildUpdatedPostRecord(currentRecord, '🎉 @alice.test updated');

    expect(nextRecord.facets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          features: [expect.objectContaining({ $type: 'app.bsky.richtext.facet#mention', did: 'did:plc:alice123' })],
        }),
      ]),
    );
  });
});
