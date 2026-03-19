import { describe, expect, it, vi } from 'vitest';

import { TokenRefreshManager } from '@src/shared/auth/token-refresh';
import type { StoredSession } from '@src/shared/auth/session-store';

const NOW = 1_700_000_000_000;
const TOKEN_ENDPOINT = 'https://bsky.social/oauth/token';
const CLIENT_ID = 'https://example.com/client-metadata.json';

function makeSession(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    accessToken: 'at_current',
    refreshToken: 'rt_current',
    expiresAt: NOW + 3600_000,
    scope: 'atproto transition:generic',
    did: 'did:plc:abc123',
    ...overrides,
  };
}

describe('TokenRefreshManager.refreshAndStore', () => {
  it('should call refreshAccessToken with the current refresh token and store the new session', async () => {
    const session = makeSession();
    const newTokens = {
      access_token: 'at_new',
      refresh_token: 'rt_new',
      token_type: 'DPoP',
      expires_in: 7200,
      sub: 'did:plc:abc123',
    };

    const mockRefresh = vi.fn().mockResolvedValue(newTokens);
    const mockStore = {
      get: vi.fn().mockResolvedValue(session),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn(),
      isAccessTokenValid: vi.fn(),
    };

    const manager = new TokenRefreshManager({ tokenEndpoint: TOKEN_ENDPOINT, clientId: CLIENT_ID });
    const result = await manager.refreshAndStore(session, mockRefresh, mockStore);

    expect(mockRefresh).toHaveBeenCalledWith(TOKEN_ENDPOINT, session.refreshToken, CLIENT_ID);
    expect(mockStore.set).toHaveBeenCalled();
    expect(result.accessToken).toBe('at_new');
    expect(result.refreshToken).toBe('rt_new');
  });

  it('should calculate expiresAt from expires_in when provided', async () => {
    vi.setSystemTime(NOW);

    const session = makeSession();
    const newTokens = {
      access_token: 'at_new',
      token_type: 'Bearer',
      expires_in: 3600,
    };

    const mockRefresh = vi.fn().mockResolvedValue(newTokens);
    const mockStore = {
      get: vi.fn().mockResolvedValue(session),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn(),
      isAccessTokenValid: vi.fn(),
    };

    const manager = new TokenRefreshManager({ tokenEndpoint: TOKEN_ENDPOINT, clientId: CLIENT_ID });
    const result = await manager.refreshAndStore(session, mockRefresh, mockStore);

    expect(result.expiresAt).toBe(NOW + 3600 * 1000);

    vi.useRealTimers();
  });

  it('should retain the existing refresh token when the response does not include a new one', async () => {
    const session = makeSession({ refreshToken: 'rt_keep_me' });
    const newTokens = { access_token: 'at_new', token_type: 'Bearer' };

    const mockRefresh = vi.fn().mockResolvedValue(newTokens);
    const mockStore = {
      get: vi.fn().mockResolvedValue(session),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn(),
      isAccessTokenValid: vi.fn(),
    };

    const manager = new TokenRefreshManager({ tokenEndpoint: TOKEN_ENDPOINT, clientId: CLIENT_ID });
    const result = await manager.refreshAndStore(session, mockRefresh, mockStore);

    expect(result.refreshToken).toBe('rt_keep_me');
  });
});

describe('TokenRefreshManager queuing', () => {
  it('should not issue a second refresh while one is already in-flight', async () => {
    const session = makeSession();
    let resolveFirst!: (v: unknown) => void;
    const firstCallPromise = new Promise((res) => {
      resolveFirst = res;
    });

    const mockRefresh = vi
      .fn()
      .mockImplementationOnce(() => firstCallPromise)
      .mockResolvedValue({ access_token: 'at_other', token_type: 'Bearer' });

    const mockStore = {
      get: vi.fn().mockResolvedValue(session),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn(),
      isAccessTokenValid: vi.fn(),
    };

    const manager = new TokenRefreshManager({ tokenEndpoint: TOKEN_ENDPOINT, clientId: CLIENT_ID });

    const p1 = manager.refreshAndStore(session, mockRefresh, mockStore);
    const p2 = manager.refreshAndStore(session, mockRefresh, mockStore);

    resolveFirst({ access_token: 'at_first', token_type: 'Bearer' });
    await Promise.all([p1, p2]);

    // Both callers should get a result but only one network call was made
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
