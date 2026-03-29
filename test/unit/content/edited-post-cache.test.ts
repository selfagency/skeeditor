import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('edited-post-cache', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('prefers authenticated PDS text for own posts over stale Slingshot text', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ value: { text: 'stale slingshot text' } }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const sendMessageMock = vi.fn(async (request: unknown) => {
      const message = request as { type?: string };
      if (message.type === 'GET_RECORD') {
        return { value: { text: 'fresh pds text' }, cid: 'bafyreitest' };
      }
      return { ok: true };
    });
    globalThis.browser.runtime.sendMessage = sendMessageMock as typeof globalThis.browser.runtime.sendMessage;

    const cache = await import('@src/content/edited-post-cache');
    cache.setIdentity('did:plc:me123', 'me.bsky.social');

    const text = await cache.resolve(
      'at://did:plc:me123/app.bsky.feed.post/3abc',
      'did:plc:me123',
      'app.bsky.feed.post',
      '3abc',
    );

    expect(text).toBe('fresh pds text');
    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'GET_RECORD',
      repo: 'did:plc:me123',
      collection: 'app.bsky.feed.post',
      rkey: '3abc',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to Slingshot for own posts when PDS fetch fails', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ value: { text: 'slingshot fallback text' } }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const sendMessageMock = vi.fn(async (request: unknown) => {
      const message = request as { type?: string };
      if (message.type === 'GET_RECORD') {
        return { error: 'Not authenticated' };
      }
      return { ok: true };
    });
    globalThis.browser.runtime.sendMessage = sendMessageMock as typeof globalThis.browser.runtime.sendMessage;

    const cache = await import('@src/content/edited-post-cache');
    cache.setIdentity('did:plc:me123', 'me.bsky.social');

    const text = await cache.resolve(
      'at://did:plc:me123/app.bsky.feed.post/3def',
      'did:plc:me123',
      'app.bsky.feed.post',
      '3def',
    );

    expect(text).toBe('slingshot fallback text');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  describe('handle↔DID registry and bidirectional cache', () => {
    it('should find cached entry via DID when stored under handle-based key', async () => {
      const cache = await import('@src/content/edited-post-cache');

      cache.registerIdentity('other.bsky.social', 'did:plc:other123');
      cache.setCached('at://other.bsky.social/app.bsky.feed.post/3abc', 'edited text');

      const entry = cache.getCached('at://did:plc:other123/app.bsky.feed.post/3abc');

      expect(entry).not.toBeNull();
      expect(entry!.text).toBe('edited text');
    });

    it('should find cached entry via handle when stored under DID-based key', async () => {
      const cache = await import('@src/content/edited-post-cache');

      cache.registerIdentity('other.bsky.social', 'did:plc:other123');
      cache.setCached('at://did:plc:other123/app.bsky.feed.post/3abc', 'edited text');

      const entry = cache.getCached('at://other.bsky.social/app.bsky.feed.post/3abc');

      expect(entry).not.toBeNull();
      expect(entry!.text).toBe('edited text');
    });

    it('should normalize cache key for any registered user, not just current', async () => {
      const cache = await import('@src/content/edited-post-cache');

      cache.setIdentity('did:plc:me123', 'me.bsky.social');
      cache.registerIdentity('other.bsky.social', 'did:plc:other123');

      const normalized = cache.normalizeCacheKey('at://other.bsky.social/app.bsky.feed.post/3abc', 'other.bsky.social');

      expect(normalized).toBe('at://did:plc:other123/app.bsky.feed.post/3abc');
    });

    it('should return handle-based key as-is when no registry entry exists', async () => {
      const cache = await import('@src/content/edited-post-cache');

      const normalized = cache.normalizeCacheKey(
        'at://unknown.bsky.social/app.bsky.feed.post/3abc',
        'unknown.bsky.social',
      );

      expect(normalized).toBe('at://unknown.bsky.social/app.bsky.feed.post/3abc');
    });

    it('setIdentity should register the handle↔DID pair in the registry', async () => {
      const cache = await import('@src/content/edited-post-cache');

      cache.setIdentity('did:plc:me123', 'me.bsky.social');
      cache.setCached('at://did:plc:me123/app.bsky.feed.post/3abc', 'my edited text');

      const entry = cache.getCached('at://me.bsky.social/app.bsky.feed.post/3abc');

      expect(entry).not.toBeNull();
      expect(entry!.text).toBe('my edited text');
    });

    it('should store under both keys when identity is known', async () => {
      const cache = await import('@src/content/edited-post-cache');

      cache.registerIdentity('other.bsky.social', 'did:plc:other123');
      cache.setCached('at://did:plc:other123/app.bsky.feed.post/3abc', 'text via did');

      expect(cache.getCacheSize()).toBeGreaterThanOrEqual(2);
    });
  });
});
