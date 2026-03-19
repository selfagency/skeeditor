import { describe, expect, it, vi } from 'vitest';

import { sessionStore } from '@src/shared/auth/session-store';

describe('sessionStore.set', () => {
  it('should call browser.storage.local.set with the session data keyed under "session"', async () => {
    const session = {
      accessToken: 'at_token',
      refreshToken: 'rt_token',
      expiresAt: Date.now() + 3600 * 1000,
      scope: 'atproto transition:generic',
      did: 'did:plc:abc123',
    };

    await sessionStore.set(session);

    expect(browser.storage.local.set).toHaveBeenCalledWith({ session });
  });
});

describe('sessionStore.get', () => {
  it('should return the stored session when one exists', async () => {
    const stored = {
      accessToken: 'at_token',
      refreshToken: 'rt_token',
      expiresAt: Date.now() + 3600 * 1000,
      scope: 'atproto transition:generic',
      did: 'did:plc:abc123',
    };

    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({ session: stored } as never);

    const result = await sessionStore.get();

    expect(result).toEqual(stored);
  });

  it('should return null when no session is stored', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({} as never);

    const result = await sessionStore.get();

    expect(result).toBeNull();
  });
});

describe('sessionStore.clear', () => {
  it('should call browser.storage.local.remove with "session"', async () => {
    await sessionStore.clear();

    expect(browser.storage.local.remove).toHaveBeenCalledWith('session');
  });
});

describe('sessionStore.isAccessTokenValid', () => {
  it('should return true when the access token exists and has not expired', async () => {
    const stored = {
      accessToken: 'at_token',
      refreshToken: 'rt_token',
      expiresAt: Date.now() + 3600 * 1000,
      scope: 'atproto transition:generic',
      did: 'did:plc:abc123',
    };

    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({ session: stored } as never);

    const result = await sessionStore.isAccessTokenValid();

    expect(result).toBe(true);
  });

  it('should return false when the access token is expired', async () => {
    const stored = {
      accessToken: 'at_expired',
      refreshToken: 'rt_token',
      expiresAt: Date.now() - 1000, // expired
      scope: 'atproto transition:generic',
      did: 'did:plc:abc123',
    };

    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({ session: stored } as never);

    const result = await sessionStore.isAccessTokenValid();

    expect(result).toBe(false);
  });

  it('should return false when no session exists', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({} as never);

    const result = await sessionStore.isAccessTokenValid();

    expect(result).toBe(false);
  });
});

describe('sessionStore.getAuthStatus', () => {
  it('should return did and expiresAt when a session exists', async () => {
    const stored = {
      accessToken: 'at_token',
      refreshToken: 'rt_token',
      expiresAt: Date.now() + 3600 * 1000,
      scope: 'atproto transition:generic',
      did: 'did:plc:abc123',
    };

    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({ session: stored } as never);

    const result = await sessionStore.getAuthStatus();

    expect(result).toEqual({ did: 'did:plc:abc123', expiresAt: stored.expiresAt });
  });

  it('should not expose accessToken or refreshToken in the result', async () => {
    const stored = {
      accessToken: 'at_secret',
      refreshToken: 'rt_secret',
      expiresAt: Date.now() + 3600 * 1000,
      scope: 'atproto transition:generic',
      did: 'did:plc:abc123',
    };

    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({ session: stored } as never);

    const result = await sessionStore.getAuthStatus();

    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('should return null when no session is stored', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({} as never);

    const result = await sessionStore.getAuthStatus();

    expect(result).toBeNull();
  });
});
