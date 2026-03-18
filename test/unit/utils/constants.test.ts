import { screen } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';

import { APP_BSKY_FEED_POST_COLLECTION, APP_NAME, BSKY_APP_ORIGIN } from '../../../src/shared/constants';

describe('shared constants', () => {
  it('should expose the expected Bluesky extension constants', () => {
    document.body.innerHTML = `<main><h1>${APP_NAME}</h1></main>`;

    expect(screen.getByRole('heading', { name: APP_NAME })).toBeTruthy();
    expect(BSKY_APP_ORIGIN).toBe('https://bsky.app');
    expect(APP_BSKY_FEED_POST_COLLECTION).toBe('app.bsky.feed.post');
  });
});
