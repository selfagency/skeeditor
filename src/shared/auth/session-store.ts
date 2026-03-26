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
}

/** Non-sensitive session metadata safe to expose in popup context (no tokens) */
export interface AuthStatus {
  /** Authenticated user DID */
  did: string;
  /** Unix timestamp (ms) at which the access token expires */
  expiresAt: number;
}

const STORAGE_KEY = 'session';

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
 * Persist a session to `browser.storage.local`.
 *
 * Must be called only from the background service worker — never from content
 * scripts or the page context.
 */
async function set(session: StoredSession): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: session });
}

/**
 * Read the current session from `browser.storage.local`.
 *
 * Returns `null` if no session has been stored yet.
 */
async function get(): Promise<StoredSession | null> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const raw: unknown = (result as Record<string, unknown>)[STORAGE_KEY];

  if (raw === undefined || raw === null) return null;

  return isStoredSession(raw) ? raw : null;
}

/**
 * Remove the stored session from `browser.storage.local`.
 *
 * Call this on logout or when tokens are determined to be unrecoverable.
 */
async function clear(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEY);
}

/**
 * Returns `true` if a non-expired access token exists in storage.
 *
 * A 30-second buffer is applied so callers can refresh slightly before actual
 * expiry rather than right at the boundary.
 */
async function isAccessTokenValid(): Promise<boolean> {
  const session = await get();
  if (session === null) return false;

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

export const sessionStore = { set, get, clear, isAccessTokenValid, getAuthStatus };
