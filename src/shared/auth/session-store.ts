import { browser } from 'wxt/browser';

/** Token session data persisted in browser.storage.local */
export interface StoredSession {
  /** OAuth access token */
  accessToken: string;
  /** OAuth refresh token (used to obtain a new access token when expired) */
  refreshToken: string;
  /** Unix timestamp (ms) at which the access token expires */
  expiresAt: number;
  /** OAuth scope string */
  scope: string;
  /** Authenticated user DID */
  did: string;
  /** Authenticated user handle (e.g. user.bsky.social); optional for backward compat */
  handle?: string;
  /**
   * OAuth authorization server URL (e.g. https://bsky.social).
   * Distinct from the PDS URL (which may be a regional shard like *.bsky.network).
   * Used to hit the correct /oauth/token endpoint during token refresh.
   * Optional for backward-compatibility with sessions created before this field existed.
   */
  authServerUrl?: string;
}

/** Non-sensitive session metadata safe to expose in popup context (no tokens) */
export interface AuthStatus {
  /** Authenticated user DID */
  did: string;
  /** Unix timestamp (ms) at which the access token expires */
  expiresAt: number;
}

const SESSIONS_KEY = 'sessions';
const ACTIVE_DID_KEY = 'activeDid';

function isStoredSession(value: unknown): value is StoredSession {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  const expiresAt = obj['expiresAt'];
  return (
    typeof obj['accessToken'] === 'string' &&
    typeof obj['refreshToken'] === 'string' &&
    typeof expiresAt === 'number' &&
    Number.isFinite(expiresAt) &&
    expiresAt > 0 &&
    typeof obj['scope'] === 'string' &&
    typeof obj['did'] === 'string'
  );
}

/**
 * Persist a session to `browser.storage.local` under the sessions map keyed
 * by the session's DID, and mark that DID as the active account.
 *
 * Must be called only from the background service worker — never from content
 * scripts or the page context.
 */
async function set(session: StoredSession): Promise<void> {
  const result = await browser.storage.local.get(SESSIONS_KEY);
  const stored = (result as Record<string, unknown>)[SESSIONS_KEY];
  const sessions: Record<string, unknown> =
    stored !== null && typeof stored === 'object' && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  sessions[session.did] = session;
  await browser.storage.local.set({ [SESSIONS_KEY]: sessions, [ACTIVE_DID_KEY]: session.did });
}

/**
 * Read the session for the currently active DID from `browser.storage.local`.
 *
 * Returns `null` if no active DID is set or no valid session exists for it.
 */
async function get(): Promise<StoredSession | null> {
  const activeDid = await getActiveDid();
  if (activeDid === null) return null;

  const result = await browser.storage.local.get(SESSIONS_KEY);
  const sessions = (result as Record<string, unknown>)[SESSIONS_KEY];
  if (sessions === null || typeof sessions !== 'object' || Array.isArray(sessions)) return null;

  const raw = (sessions as Record<string, unknown>)[activeDid];
  return isStoredSession(raw) ? raw : null;
}

/**
 * Read the session for a specific DID from `browser.storage.local`.
 *
 * Returns `null` when no valid session exists for the given DID.
 */
async function getByDid(did: string): Promise<StoredSession | null> {
  const result = await browser.storage.local.get(SESSIONS_KEY);
  const sessions = (result as Record<string, unknown>)[SESSIONS_KEY];
  if (sessions === null || typeof sessions !== 'object' || Array.isArray(sessions)) return null;
  const raw = (sessions as Record<string, unknown>)[did];
  return isStoredSession(raw) ? raw : null;
}

/**
 * Remove ALL stored sessions and clear the active DID.
 *
 * Call this on sign-out or when tokens are determined to be unrecoverable.
 * To remove a single account's session, use `clearForDid()`.
 */
async function clear(): Promise<void> {
  await browser.storage.local.remove([SESSIONS_KEY, ACTIVE_DID_KEY]);
}

/**
 * Remove the stored session for a specific DID. If that DID was the active
 * account, the active DID is switched to the first remaining account (or
 * cleared if no accounts remain).
 */
async function clearForDid(did: string): Promise<void> {
  const result = await browser.storage.local.get([SESSIONS_KEY, ACTIVE_DID_KEY]);
  const storedSessions = (result as Record<string, unknown>)[SESSIONS_KEY];
  const sessions: Record<string, StoredSession> =
    storedSessions !== null && typeof storedSessions === 'object' && !Array.isArray(storedSessions)
      ? { ...(storedSessions as Record<string, StoredSession>) }
      : {};
  delete sessions[did];

  const activeDid = (result as Record<string, unknown>)[ACTIVE_DID_KEY];
  const updates: Record<string, unknown> = { [SESSIONS_KEY]: sessions };
  if (activeDid === did) {
    const remaining = Object.keys(sessions);
    updates[ACTIVE_DID_KEY] = remaining.length > 0 ? remaining[0] : null;
  }
  await browser.storage.local.set(updates);
}

/**
 * Return the DID of the currently active account, or `null` if none is set.
 */
async function getActiveDid(): Promise<string | null> {
  const result = await browser.storage.local.get(ACTIVE_DID_KEY);
  const did = (result as Record<string, unknown>)[ACTIVE_DID_KEY];
  return typeof did === 'string' && did.length > 0 ? did : null;
}

/**
 * Mark a DID as the currently active account.
 * The DID must already have a stored session.
 */
async function setActiveDid(did: string): Promise<void> {
  await browser.storage.local.set({ [ACTIVE_DID_KEY]: did });
}

/**
 * Return all DIDs that have a stored session.
 */
async function listDids(): Promise<string[]> {
  const result = await browser.storage.local.get(SESSIONS_KEY);
  const sessions = (result as Record<string, unknown>)[SESSIONS_KEY];
  if (sessions === null || typeof sessions !== 'object' || Array.isArray(sessions)) return [];
  return Object.keys(sessions as object);
}

/** Summary of a stored session — no token credentials, safe for popup context. */
export interface AccountSummary {
  did: string;
  handle?: string;
  expiresAt: number;
}

/**
 * Return all stored accounts and the active DID in a single storage read.
 *
 * Prefer this over calling {@link listDids} + {@link getByDid} in a loop to
 * avoid N+1 `browser.storage.local.get` calls.
 */
async function listAll(): Promise<{ accounts: AccountSummary[]; activeDid: string | null }> {
  const result = await browser.storage.local.get([SESSIONS_KEY, ACTIVE_DID_KEY]);
  const raw = result as Record<string, unknown>;
  const sessions = raw[SESSIONS_KEY];
  const activeDid =
    typeof raw[ACTIVE_DID_KEY] === 'string' && (raw[ACTIVE_DID_KEY] as string).length > 0
      ? (raw[ACTIVE_DID_KEY] as string)
      : null;

  if (sessions === null || typeof sessions !== 'object') {
    return { accounts: [], activeDid };
  }

  const accounts: AccountSummary[] = Object.values(sessions as Record<string, unknown>)
    .filter(isStoredSession)
    .map(s => ({ did: s.did, ...(s.handle !== undefined && { handle: s.handle }), expiresAt: s.expiresAt }));

  return { accounts, activeDid };
}

/**
 * One-time migration from the legacy single-slot storage format.
 *
 * Reads the old `session` key and writes it into the new `sessions` map.
 * Also migrates a legacy `pdsUrl` string into `pdsUrls[did]`.
 * Safe to call on every start-up — it exits immediately if the new format
 * already exists or if there is no legacy session to migrate.
 */
async function migrateFromLegacy(): Promise<void> {
  const result = await browser.storage.local.get([SESSIONS_KEY, 'session', 'pdsUrl']);
  const sessions = (result as Record<string, unknown>)[SESSIONS_KEY];
  const hasValidSessions = sessions !== null && typeof sessions === 'object' && !Array.isArray(sessions);
  const legacySession = (result as Record<string, unknown>)['session'];

  // Skip if already using new format or nothing to migrate
  if (hasValidSessions || !isStoredSession(legacySession)) return;

  // Migrate session into new map format
  await set(legacySession);

  // Migrate legacy pdsUrl into pdsUrls map for this DID
  const legacyPdsUrl = (result as Record<string, unknown>)['pdsUrl'];
  if (typeof legacyPdsUrl === 'string' && legacyPdsUrl.length > 0) {
    const pdsUrlsResult = await browser.storage.local.get('pdsUrls');
    const storedPdsUrls = (pdsUrlsResult as Record<string, unknown>)['pdsUrls'];
    const pdsUrls: Record<string, string> =
      storedPdsUrls !== null && typeof storedPdsUrls === 'object' && !Array.isArray(storedPdsUrls)
        ? (storedPdsUrls as Record<string, string>)
        : {};
    if (!pdsUrls[legacySession.did]) {
      pdsUrls[legacySession.did] = legacyPdsUrl;
      await browser.storage.local.set({ pdsUrls });
    }
    await browser.storage.local.remove('pdsUrl');
  }

  await browser.storage.local.remove('session');
}

/**
 * Returns `true` if a non-expired access token exists in storage for the
 * active account.
 *
 * A 30-second buffer is applied so callers can refresh slightly before actual
 * expiry rather than right at the boundary.
 */
async function isAccessTokenValid(): Promise<boolean> {
  const session = await get();
  if (session === null) return false;

  // Refresh 30 s before actual expiry so callers can obtain a fresh token
  // while the current one is still valid, avoiding edge-case 401s.
  const bufferMs = 30_000;
  return session.expiresAt - bufferMs > Date.now();
}

/**
 * Returns non-sensitive session metadata (DID and expiry) without exposing
 * token credentials. Safe to call from the popup context.
 *
 * Returns null if no session exists.
 */
async function getAuthStatus(): Promise<AuthStatus | null> {
  const session = await get();
  if (session === null) return null;

  return { did: session.did, expiresAt: session.expiresAt };
}

export const sessionStore = {
  set,
  get,
  getByDid,
  getActiveDid,
  setActiveDid,
  listDids,
  listAll,
  clear,
  clearForDid,
  isAccessTokenValid,
  getAuthStatus,
  migrateFromLegacy,
};
