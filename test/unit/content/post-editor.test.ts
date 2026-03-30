import { describe, expect, it } from 'vitest';

import { buildUpdatedPostRecord, type EditablePostRecord } from '@src/content/post-editor';

describe('post-editor', () => {
  const baseRecord: EditablePostRecord = {
    $type: 'app.bsky.feed.post' as const,
    text: 'Original text',
    createdAt: '2026-03-18T12:00:00.000Z',
  };

  const createFile = (name: string, type: string): File => new File(['x'], name, { type });

  it('should preserve the existing record fields while updating text and facets', () => {
    const currentRecord: EditablePostRecord = {
      $type: 'app.bsky.feed.post' as const,
      text: 'Hello @alice.test https://example.com',
      createdAt: '2026-03-18T12:00:00.000Z',
      embed: {
        $type: 'app.bsky.embed.external',
        external: { uri: 'https://example.com', title: 'Example', description: '' },
      },
      langs: ['en'],
    };

    const nextRecord = buildUpdatedPostRecord(currentRecord, 'Updated text with #tag');

    expect(nextRecord).toMatchObject({
      $type: 'app.bsky.feed.post',
      text: 'Updated text with #tag',
      embed: currentRecord.embed,
      langs: ['en'],
    });
    expect(nextRecord.createdAt).not.toBe('2026-03-18T12:00:00.000Z');
    expect(nextRecord.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(nextRecord.facets).toHaveLength(1);
    expect(nextRecord.labels).toBeUndefined();
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
    expect(nextRecord.labels).toBeUndefined();
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
    expect(nextRecord.labels).toBeUndefined();
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
    expect(nextRecord.labels).toBeUndefined();
    expect(nextRecord.tags).toBeDefined();
    expect(nextRecord.tags).toHaveLength(1);
    expect(nextRecord.tags?.[0]).toMatch(/^skeeditor-edit-/);
  });

  it('should not add edited self-labels to updated posts', () => {
    const currentRecord: EditablePostRecord = {
      $type: 'app.bsky.feed.post' as const,
      text: 'Original text',
      createdAt: '2026-03-18T12:00:00.000Z',
    };

    const nextRecord = buildUpdatedPostRecord(currentRecord, 'Updated text');

    expect(nextRecord.labels).toBeUndefined();
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

    // Should preserve existing labels unchanged
    expect(nextRecord.labels).toBeDefined();
    expect(nextRecord.labels?.values).toContainEqual({ $type: 'com.atproto.label.defs#selfLabel', val: 'bot' });
    expect(nextRecord.labels?.values).toHaveLength(1);
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

  it('should build an image embed preserving image order for uploads', () => {
    const mediaFiles = [
      createFile('first.jpg', 'image/jpeg'),
      createFile('second.png', 'image/png'),
      createFile('third.webp', 'image/webp'),
    ];

    const nextRecord = buildUpdatedPostRecord(baseRecord, 'Updated text', mediaFiles);

    expect(nextRecord.embed?.$type).toBe('app.bsky.embed.images');
    if (!nextRecord.embed || nextRecord.embed.$type !== 'app.bsky.embed.images') {
      throw new Error('Expected images embed');
    }
    expect(nextRecord.embed.images.map(image => image.alt)).toEqual(['first.jpg', 'second.png', 'third.webp']);
  });

  it('should build a video embed when one video is selected', () => {
    const mediaFiles = [createFile('clip.mp4', 'video/mp4')];

    const nextRecord = buildUpdatedPostRecord(baseRecord, 'Updated text', mediaFiles);

    expect(nextRecord.embed?.$type).toBe('app.bsky.embed.video');
    if (!nextRecord.embed || nextRecord.embed.$type !== 'app.bsky.embed.video') {
      throw new Error('Expected video embed');
    }
    expect(nextRecord.embed.alt).toBe('clip.mp4');
  });

  it('should reject mixed image and video selections', () => {
    const mediaFiles = [createFile('photo.jpg', 'image/jpeg'), createFile('clip.mp4', 'video/mp4')];

    expect(() => buildUpdatedPostRecord(baseRecord, 'Updated text', mediaFiles)).toThrow(
      'Cannot mix images and video in one post',
    );
  });

  it('should reject more than four images', () => {
    const mediaFiles = [
      createFile('1.jpg', 'image/jpeg'),
      createFile('2.jpg', 'image/jpeg'),
      createFile('3.jpg', 'image/jpeg'),
      createFile('4.jpg', 'image/jpeg'),
      createFile('5.jpg', 'image/jpeg'),
    ];

    expect(() => buildUpdatedPostRecord(baseRecord, 'Updated text', mediaFiles)).toThrow(
      'You can attach up to 4 images',
    );
  });

  it('should reject selecting more than one video', () => {
    const mediaFiles = [createFile('a.mp4', 'video/mp4'), createFile('b.mp4', 'video/mp4')];

    expect(() => buildUpdatedPostRecord(baseRecord, 'Updated text', mediaFiles)).toThrow('You can attach only 1 video');
  });
});
