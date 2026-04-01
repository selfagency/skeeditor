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

import {
  APP_BSKY_FEED_POST_COLLECTION,
  APP_NAME,
  BSKY_APP_ORIGIN,
  EDIT_TIME_LIMIT_OPTIONS,
  getSettings,
  isValidEditTimeLimit,
} from '@src/shared/constants';
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

  it('only accepts supported edit time limit options', () => {
    expect(EDIT_TIME_LIMIT_OPTIONS).toEqual([0.5, 1, 3, 5, 15, 30]);
    expect(isValidEditTimeLimit(3)).toBe(true);
    expect(isValidEditTimeLimit(2.5)).toBe(false);
  });
});
