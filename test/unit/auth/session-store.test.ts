import { describe, expect, it, vi } from 'vitest';

import { sessionStore } from '@src/shared/auth/session-store';

const makeSession = (did = 'did:plc:abc123') => ({
  accessToken: 'at_token',
  refreshToken: 'rt_token',
  expiresAt: Date.now() + 3600 * 1000,
  scope: 'atproto transition:generic',
  did,
});

describe('sessionStore.set', () => {
  it('should store the session under sessions[did] and set activeDid', async () => {
    const session = makeSession();

    await sessionStore.set(session);

    expect(browser.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        sessions: { [session.did]: session },
        activeDid: session.did,
      }),
    );
  });
});

describe('sessionStore.get', () => {
  it('should return the session for the active DID', async () => {
    const session = makeSession();
    vi.mocked(browser.storage.local.get)
      .mockResolvedValueOnce({ activeDid: session.did } as never) // getActiveDid
      .mockResolvedValueOnce({ sessions: { [session.did]: session } } as never); // get sessions

    const result = await sessionStore.get();

    expect(result).toEqual(session);
  });

  it('should return null when no active DID is set', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({} as never);

    const result = await sessionStore.get();

    expect(result).toBeNull();
  });

  it('should return null when the active DID has no stored session', async () => {
    vi.mocked(browser.storage.local.get)
      .mockResolvedValueOnce({ activeDid: 'did:plc:abc123' } as never)
      .mockResolvedValueOnce({ sessions: {} } as never);

    const result = await sessionStore.get();

    expect(result).toBeNull();
  });

  it('should return null when stored data is missing required fields', async () => {
    const session = makeSession();
    vi.mocked(browser.storage.local.get)
      .mockResolvedValueOnce({ activeDid: session.did } as never)
      .mockResolvedValueOnce({
        sessions: { [session.did]: { accessToken: 'at', refreshToken: 'rt' } },
      } as never);

    const result = await sessionStore.get();

    expect(result).toBeNull();
  });
});

describe('sessionStore.getByDid', () => {
  it('should return the session for the given DID', async () => {
    const session = makeSession();
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({
      sessions: { [session.did]: session },
    } as never);

    const result = await sessionStore.getByDid(session.did);

    expect(result).toEqual(session);
  });

  it('should return null when the DID has no stored session', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({ sessions: {} } as never);

    const result = await sessionStore.getByDid('did:plc:unknown');

    expect(result).toBeNull();
  });
});

describe('sessionStore.clear', () => {
  it('should remove both "sessions" and "activeDid" keys', async () => {
    await sessionStore.clear();

    expect(browser.storage.local.remove).toHaveBeenCalledWith(['sessions', 'activeDid']);
  });
});

describe('sessionStore.clearForDid', () => {
  it('should delete the session for the given DID from the sessions map', async () => {
    const alice = makeSession('did:plc:alice');
    const bob = makeSession('did:plc:bob');
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({
      sessions: { [alice.did]: alice, [bob.did]: bob },
      activeDid: bob.did,
    } as never);

    await sessionStore.clearForDid(alice.did);

    expect(browser.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        sessions: { [bob.did]: bob },
      }),
    );
  });

  it('should switch active DID when the cleared DID was active', async () => {
    const alice = makeSession('did:plc:alice');
    const bob = makeSession('did:plc:bob');
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({
      sessions: { [alice.did]: alice, [bob.did]: bob },
      activeDid: alice.did,
    } as never);

    await sessionStore.clearForDid(alice.did);

    expect(browser.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({ activeDid: bob.did }));
  });
});

describe('sessionStore.getActiveDid', () => {
  it('should return the stored active DID', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({ activeDid: 'did:plc:alice' } as never);

    const result = await sessionStore.getActiveDid();

    expect(result).toBe('did:plc:alice');
  });

  it('should return null when no active DID is set', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({} as never);

    const result = await sessionStore.getActiveDid();

    expect(result).toBeNull();
  });
});

describe('sessionStore.setActiveDid', () => {
  it('should store the active DID', async () => {
    await sessionStore.setActiveDid('did:plc:alice');

    expect(browser.storage.local.set).toHaveBeenCalledWith({ activeDid: 'did:plc:alice' });
  });
});

describe('sessionStore.listDids', () => {
  it('should return all DIDs with stored sessions', async () => {
    const alice = makeSession('did:plc:alice');
    const bob = makeSession('did:plc:bob');
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({
      sessions: { [alice.did]: alice, [bob.did]: bob },
    } as never);

    const result = await sessionStore.listDids();

    expect(result).toEqual(expect.arrayContaining([alice.did, bob.did]));
  });

  it('should return an empty array when no sessions are stored', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({} as never);

    const result = await sessionStore.listDids();

    expect(result).toEqual([]);
  });
});

describe('sessionStore.listAll', () => {
  it('returns all accounts and the active DID in a single read', async () => {
    const alice = makeSession('did:plc:alice');
    const bob = makeSession('did:plc:bob');
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({
      sessions: { [alice.did]: alice, [bob.did]: bob },
      activeDid: 'did:plc:alice',
    } as never);

    const result = await sessionStore.listAll();

    expect(result.activeDid).toBe('did:plc:alice');
    expect(result.accounts).toHaveLength(2);
    expect(result.accounts.map(a => a.did)).toEqual(expect.arrayContaining([alice.did, bob.did]));
  });

  it('returns empty accounts and null activeDid when no sessions exist', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({} as never);

    const result = await sessionStore.listAll();

    expect(result).toEqual({ accounts: [], activeDid: null });
  });

  it('returns null activeDid when activeDid key is absent', async () => {
    const alice = makeSession('did:plc:alice');
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({
      sessions: { [alice.did]: alice },
    } as never);

    const result = await sessionStore.listAll();

    expect(result.activeDid).toBeNull();
    expect(result.accounts).toHaveLength(1);
  });
});

describe('sessionStore.migrateFromLegacy', () => {
  it('should migrate a legacy session into the sessions map and remove old keys', async () => {
    const legacySession = makeSession();
    vi.mocked(browser.storage.local.get)
      .mockResolvedValueOnce({
        session: legacySession,
        pdsUrl: 'https://bsky.social',
        // sessions not present -> triggers migration
      } as never)
      .mockResolvedValueOnce({ sessions: {} } as never) // called inside set() -> get sessions
      .mockResolvedValueOnce({ pdsUrls: {} } as never); // called for pdsUrls

    await sessionStore.migrateFromLegacy();

    expect(browser.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        sessions: expect.objectContaining({ [legacySession.did]: legacySession }),
        activeDid: legacySession.did,
      }),
    );
    expect(browser.storage.local.remove).toHaveBeenCalledWith('session');
  });

  it('should skip migration when the new sessions key already exists', async () => {
    const legacySession = makeSession();
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({
      sessions: { [legacySession.did]: legacySession },
      session: legacySession,
    } as never);

    await sessionStore.migrateFromLegacy();

    expect(browser.storage.local.set).not.toHaveBeenCalled();
  });

  it('should skip migration when there is no legacy session', async () => {
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({} as never);

    await sessionStore.migrateFromLegacy();

    expect(browser.storage.local.set).not.toHaveBeenCalled();
  });
});

describe('sessionStore.isAccessTokenValid', () => {
  it('should return true when the access token has not expired', async () => {
    const session = makeSession();
    vi.mocked(browser.storage.local.get)
      .mockResolvedValueOnce({ activeDid: session.did } as never)
      .mockResolvedValueOnce({ sessions: { [session.did]: session } } as never);

    const result = await sessionStore.isAccessTokenValid();

    expect(result).toBe(true);
  });

  it('should return false when the access token is expired', async () => {
    const session = { ...makeSession(), expiresAt: Date.now() - 1000 };
    vi.mocked(browser.storage.local.get)
      .mockResolvedValueOnce({ activeDid: session.did } as never)
      .mockResolvedValueOnce({ sessions: { [session.did]: session } } as never);

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
    const session = makeSession();
    vi.mocked(browser.storage.local.get)
      .mockResolvedValueOnce({ activeDid: session.did } as never)
      .mockResolvedValueOnce({ sessions: { [session.did]: session } } as never);

    const result = await sessionStore.getAuthStatus();

    expect(result).toEqual({ did: session.did, expiresAt: session.expiresAt });
  });

  it('should not expose accessToken or refreshToken in the result', async () => {
    const session = makeSession();
    vi.mocked(browser.storage.local.get)
      .mockResolvedValueOnce({ activeDid: session.did } as never)
      .mockResolvedValueOnce({ sessions: { [session.did]: session } } as never);

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
