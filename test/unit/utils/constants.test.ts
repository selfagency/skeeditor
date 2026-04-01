import { screen } from '@testing-library/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
      },
      sync: {
        get: vi.fn(),
        set: vi.fn(),
      },
    },
  },
}));

import { APP_BSKY_FEED_POST_COLLECTION, APP_NAME, BSKY_APP_ORIGIN, getSettings } from '@src/shared/constants';
import { browser } from 'wxt/browser';

describe('shared constants', () => {
  beforeEach(() => {
    vi.mocked(browser.storage.local.get).mockReset();
  });

  it('should expose the expected Bluesky extension constants', () => {
    document.body.innerHTML = `<main><h1>${APP_NAME}</h1></main>`;

    expect(screen.getByRole('heading', { name: APP_NAME })).toBeTruthy();
    expect(BSKY_APP_ORIGIN).toBe('https://bsky.app');
    expect(APP_BSKY_FEED_POST_COLLECTION).toBe('app.bsky.feed.post');
  });

  it('defaults saveStrategy to recreate when settings are missing', async () => {
    vi.mocked(browser.storage.local.get).mockImplementation(async () => ({}));

    await expect(getSettings()).resolves.toEqual({
      editTimeLimit: null,
      saveStrategy: 'recreate',
    });
  });
});
