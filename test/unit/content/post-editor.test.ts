import { describe, expect, it } from 'vitest';

import { buildUpdatedPostRecord } from '@src/content/post-editor';

describe('post-editor', () => {
  it('should preserve the existing record fields while updating text and facets', () => {
    const currentRecord = {
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
    const currentRecord = {
      $type: 'app.bsky.feed.post' as const,
      text: 'Hello @alice.test',
      createdAt: '2026-03-18T12:00:00.000Z',
      facets: [{ $type: 'app.bsky.richtext.facet' }],
    };

    const nextRecord = buildUpdatedPostRecord(currentRecord, 'Plain post text');

    expect(nextRecord).not.toHaveProperty('facets');
  });
});
