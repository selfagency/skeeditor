import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const findPostsMock = vi.fn(() => []);

vi.mock('@src/content/post-detector', async importOriginal => {
  const original = await importOriginal<typeof import('@src/content/post-detector')>();
  return { ...original, findPosts: findPostsMock };
});

describe('scheduleScanForPosts debounce', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();

    globalThis.browser.runtime.sendMessage = vi.fn(async (request: unknown) => {
      const req = request as { type: string };
      if (req.type === 'AUTH_GET_STATUS') {
        return { authenticated: true, did: 'did:plc:alice123', expiresAt: 0 };
      }
      return { ok: true };
    }) as typeof globalThis.browser.runtime.sendMessage;
  });

  afterEach(async () => {
    const { cleanupContentScript } = await import('@src/content/content-script');
    cleanupContentScript();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should coalesce multiple rapid scheduleScanForPosts calls to a single scanForPosts invocation', async () => {
    const { scheduleScanForPosts } = await import('@src/content/content-script');

    // Two microtask ticks flush the async init chain in content-script:
    // 1st tick: sendMessage() resolves with auth status
    // 2nd tick: the .then() callback runs scanForPosts() and marks the script initialised
    await Promise.resolve();
    await Promise.resolve();

    // Clear the initial scan that fires after auth resolves
    findPostsMock.mockClear();

    // Trigger three rapid schedule calls — only one scan should be debounced
    scheduleScanForPosts();
    scheduleScanForPosts();
    scheduleScanForPosts();

    // Still within the debounce window: no scan should have fired yet
    expect(findPostsMock).not.toHaveBeenCalled();

    // Advance past the 100 ms debounce window
    vi.advanceTimersByTime(100);

    // Exactly one scan should have been triggered regardless of the number of calls
    expect(findPostsMock).toHaveBeenCalledTimes(1);
  });

  it('should cancel a pending scan timer when cleanupContentScript is called', async () => {
    const { scheduleScanForPosts, cleanupContentScript } = await import('@src/content/content-script');

    // Two microtask ticks flush the async init chain in content-script:
    // 1st tick: sendMessage() resolves with auth status
    // 2nd tick: the .then() callback runs scanForPosts() and marks the script initialised
    await Promise.resolve();
    await Promise.resolve();

    // Clear the initial scan
    findPostsMock.mockClear();

    // Schedule a scan then immediately clean up before the timer fires
    scheduleScanForPosts();
    cleanupContentScript();

    // Advance past the timer — the cancelled scan must not fire
    vi.advanceTimersByTime(100);

    expect(findPostsMock).not.toHaveBeenCalled();
  });
});
