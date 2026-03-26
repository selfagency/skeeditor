import { describe, expect, it } from 'vitest';

import { buildUpdatedPostRecord, type EditablePostRecord } from '@src/content/post-editor';

describe('post-editor', () => {
  it('should preserve the existing record fields while updating text and facets', () => {
    const currentRecord: EditablePostRecord = {
      $type: 'app.bsky.feed.post' as const,
      text: 'Hello @alice.test https://example.com',
      createdAt: '2026-03-18T12:00:00.000Z',
      embed: { $type: 'app.bsky.embed.external', external: { uri: 'https://example.com', title: 'Example', description: '' } },
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
    expect(nextRecord.labels).toEqual({
      $type: 'com.atproto.label.defs#selfLabels',
      values: [{ $type: 'com.atproto.label.defs#selfLabel', val: 'edited' }],
    });
    expect(nextRecord.tags).toBeDefined();
    expect(nextRecord.tags).toHaveLength(1);
    expect(nextRecord.tags?.[0]).toMatch(/^skeeditor-edit-/);
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
    expect(nextRecord.labels).toEqual({
      $type: 'com.atproto.label.defs#selfLabels',
      values: [{ $type: 'com.atproto.label.defs#selfLabel', val: 'edited' }],
    });
    expect(nextRecord.tags).toBeDefined();
    expect(nextRecord.tags).toHaveLength(1);
    expect(nextRecord.tags?.[0]).toMatch(/^skeeditor-edit-/);
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
    expect(nextRecord.labels).toEqual({
      $type: 'com.atproto.label.defs#selfLabels',
      values: [{ $type: 'com.atproto.label.defs#selfLabel', val: 'edited' }],
    });
    expect(nextRecord.tags).toBeDefined();
    expect(nextRecord.tags).toHaveLength(1);
    expect(nextRecord.tags?.[0]).toMatch(/^skeeditor-edit-/);
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
    expect(nextRecord.labels).toEqual({
      $type: 'com.atproto.label.defs#selfLabels',
      values: [{ $type: 'com.atproto.label.defs#selfLabel', val: 'edited' }],
    });
    expect(nextRecord.tags).toBeDefined();
    expect(nextRecord.tags).toHaveLength(1);
    expect(nextRecord.tags?.[0]).toMatch(/^skeeditor-edit-/);
  });

  it('should add edited self-label to all updated posts', () => {
    const currentRecord: EditablePostRecord = {
      $type: 'app.bsky.feed.post' as const,
      text: 'Original text',
      createdAt: '2026-03-18T12:00:00.000Z',
    };

    const nextRecord = buildUpdatedPostRecord(currentRecord, 'Updated text');

    expect(nextRecord.labels).toBeDefined();
    expect(nextRecord.labels).toEqual({
      $type: 'com.atproto.label.defs#selfLabels',
      values: [{ $type: 'com.atproto.label.defs#selfLabel', val: 'edited' }],
    });
  });

  it('should preserve existing labels when present', () => {
    const currentRecord: EditablePostRecord = {
      $type: 'app.bsky.feed.post' as const,
      text: 'Original text',
      createdAt: '2026-03-18T12:00:00.000Z',
      labels: {
        $type: 'com.atproto.label.defs#selfLabels',
        values: [{ $type: 'com.atproto.label.defs#selfLabel', val: 'bot' }],
      },
    };

    const nextRecord = buildUpdatedPostRecord(currentRecord, 'Updated text');

    // Should preserve existing labels and add edited label
    expect(nextRecord.labels).toBeDefined();
    expect(nextRecord.labels?.values).toContainEqual({ $type: 'com.atproto.label.defs#selfLabel', val: 'bot' });
    expect(nextRecord.labels?.values).toContainEqual({ $type: 'com.atproto.label.defs#selfLabel', val: 'edited' });
    // Should also add edit history tag
    expect(nextRecord.tags).toBeDefined();
    expect(nextRecord.tags).toHaveLength(1);
    expect(nextRecord.tags?.[0]).toMatch(/^skeeditor-edit-/);
  });

  it('should add edit history tags for content tracking', () => {
    const currentRecord: EditablePostRecord = {
      $type: 'app.bsky.feed.post' as const,
      text: 'Original content that will be edited',
      createdAt: '2026-03-18T12:00:00.000Z',
    };

    const nextRecord = buildUpdatedPostRecord(currentRecord, 'Modified content');

    expect(nextRecord.tags).toBeDefined();
    expect(nextRecord.tags).toHaveLength(1);
    expect(nextRecord.tags?.[0]).toMatch(/^skeeditor-edit-/);

    // The tag should be deterministic for the same content
    const sameRecord = buildUpdatedPostRecord(currentRecord, 'Modified content');
    expect(sameRecord.tags?.[0]).toBe(nextRecord.tags?.[0]);
  });

  it('should preserve existing tags when adding edit history', () => {
    const currentRecord: EditablePostRecord = {
      $type: 'app.bsky.feed.post' as const,
      text: 'Original content',
      createdAt: '2026-03-18T12:00:00.000Z',
      tags: ['existing-tag', 'another-tag'],
    };

    const nextRecord = buildUpdatedPostRecord(currentRecord, 'Modified content');

    expect(nextRecord.tags).toBeDefined();
    expect(nextRecord.tags).toHaveLength(3);
    expect(nextRecord.tags).toContain('existing-tag');
    expect(nextRecord.tags).toContain('another-tag');
    expect(nextRecord.tags?.find(tag => tag.startsWith('skeeditor-edit-'))).toBeDefined();
  });
});
