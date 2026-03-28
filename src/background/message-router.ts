import type { l } from '@atproto/lex';
import { browser } from 'wxt/browser';

import { createDpopProof, loadOrCreateDpopKeyPair } from '../shared/auth/dpop';

import { getHandleForDid, getPdsUrlForDid } from '../shared/api/resolve-did';
import type {
  GetRecordResult,
  PutRecordResult,
  PutRecordWithSwapResult,
  XrpcClientConfig,
} from '../shared/api/xrpc-client';
import { XrpcClient } from '../shared/api/xrpc-client';
import type { AuthorizationRequest, TokenResponse } from '../shared/auth/auth-client';
import { buildAuthorizationRequest, exchangeCodeForTokens, refreshAccessToken } from '../shared/auth/auth-client';
import type { StoredSession } from '../shared/auth/session-store';
import { sessionStore } from '../shared/auth/session-store';
import {
  BSKY_OAUTH_CLIENT_ID,
  BSKY_OAUTH_REDIRECT_URI,
  BSKY_OAUTH_SCOPE,
  getCurrentPdsUrl,
  getOAuthAuthorizeUrl,
  getOAuthTokenUrl,
  getSettings,
  isValidEditTimeLimit,
  LABELER_DID,
  LABELER_EMIT_URL,
  setCurrentPdsUrl,
  setGlobalPdsUrl,
  setSettings,
} from '../shared/constants';
import type {
  PutRecordConflictResponse,
  PutRecordErrorResponse,
  PutRecordResponse,
  PutRecordSuccessResponse,
} from '../shared/messages';

// ── DPoP key cache ────────────────────────────────────────────────────────────

// Cache key pairs per DID for the lifetime of the service worker.
// All accounts currently share a single underlying key from storage, but
// caching per-DID prepares for future per-account key support.
// The cache is reset when the SW is terminated.
const dpopKeyPairCache = new Map<string, CryptoKeyPair>();

async function getDpopKeyPair(did?: string): Promise<CryptoKeyPair> {
  const cacheKey = did ?? '__default__';
  const cached = dpopKeyPairCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const keyPair = await loadOrCreateDpopKeyPair();
  dpopKeyPairCache.set(cacheKey, keyPair);
  return keyPair;
}

/**
 * Check whether the user already subscribes to the skeeditor labeler.
 * If not, mark storage so the popup can show a consent prompt.
 * All errors are swallowed — this must never block sign-in.
 */
/**
 * Fire-and-forget: notify the labeler after a successful edit so it can
 * broadcast a signed `edited` label to all subscribed extension clients.
 * Errors are swallowed — the real-time update is best-effort only.
 */
function emitLabelTrigger(uri: string, cid: string, did: string, accessToken: string): void {
  void fetch(LABELER_EMIT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uri, cid, did }),
  }).catch(err => {
    console.warn('[skeeditor] labeler emit failed:', err);
  });
}

async function checkAndScheduleLabelerPrompt(pdsUrl: string, accessToken: string): Promise<void> {
  const prefsUrl = `${pdsUrl}/xrpc/app.bsky.actor.getPreferences`;

  const makeRequest = async (nonce?: string): Promise<Response> => {
    const keyPair = await getDpopKeyPair();
    const proof = await createDpopProof(keyPair, 'GET', prefsUrl, accessToken, nonce);
    return fetch(prefsUrl, {
      headers: { Authorization: `DPoP ${accessToken}`, DPoP: proof },
    });
  };

  try {
    let response = await makeRequest();
    if (response.status === 400 || response.status === 401) {
      const nonce = response.headers.get('DPoP-Nonce');
      if (nonce !== null) response = await makeRequest(nonce);
    }
    if (!response.ok) return;

    const body = (await response.json()) as {
      preferences?: Array<{ $type: string; labelers?: Array<{ did: string }> }>;
    };
    const prefs = body.preferences ?? [];
    const labelerPref = prefs.find(p => p['$type'] === 'app.bsky.actor.defs#labelersPref');
    const subscribed = labelerPref?.labelers?.some(l => l.did === LABELER_DID) ?? false;

    if (!subscribed) {
      await browser.storage.local.set({ pendingLabelerPrompt: true });
    }
  } catch {
    // silent fail — labeler subscription is optional
  }
}

/**
 * Fetch the account handle from the PDS using com.atproto.server.getSession.
 * Returns the handle string, or null if unavailable (non-fatal).
 *
 * IMPORTANT: This function resolves the DID to get the correct PDS URL.
 * OAuth tokens are scoped to a specific PDS and cannot be used with the
 * authorization server (entryway).
 */
async function fetchHandle(pdsUrl: string, accessToken: string, did: string): Promise<string | null> {
  // Resolve the actual PDS URL from the DID document.
  // OAuth tokens are scoped to the PDS, not the authorization server (entryway).
  const resolvedPdsUrl = await getPdsUrlForDid(did);
  const actualPdsUrl = resolvedPdsUrl ?? pdsUrl;

  if (actualPdsUrl) {
    const handleFromSession = await fetchHandleFromSession(actualPdsUrl, accessToken);
    if (handleFromSession !== null) {
      return handleFromSession;
    }
  }

  // Fallback: resolve handle from the DID document directly.
  return getHandleForDid(did);
}

/**
 * Fetch handle from com.atproto.server.getSession endpoint.
 */
async function fetchHandleFromSession(pdsUrl: string, accessToken: string): Promise<string | null> {
  const url = `${pdsUrl}/xrpc/com.atproto.server.getSession`;

  const makeRequest = async (nonce?: string): Promise<Response> => {
    const keyPair = await getDpopKeyPair();
    const dpopProof = await createDpopProof(keyPair, 'GET', url, accessToken, nonce);
    return fetch(url, {
      headers: {
        Authorization: `DPoP ${accessToken}`,
        DPoP: dpopProof,
      },
    });
  };

  try {
    let response = await makeRequest();

    // Server may require a nonce on the first attempt
    if (!response.ok) {
      const serverNonce = response.headers.get('DPoP-Nonce');
      if (serverNonce !== null) {
        response = await makeRequest(serverNonce);
      }
    }

    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, unknown>;
    const handle = data['handle'];
    return typeof handle === 'string' && handle.length > 0 ? handle : null;
  } catch {
    return null;
  }
}

// ── Dependency injection types ────────────────────────────────────────────────

interface XrpcInterface {
  getRecord: (params: { repo: string; collection: string; rkey: string }) => Promise<GetRecordResult>;
  putRecord: (params: {
    repo: string;
    collection: string;
    rkey: string;
    record: Record<string, unknown> & { $type: string };
    swapRecord?: string;
  }) => Promise<PutRecordResult>;
  putRecordWithSwap: (params: {
    repo: string;
    collection: string;
    rkey: string;
    record: Record<string, unknown> & { $type: string };
    swapRecord: string;
    validate?: boolean;
  }) => Promise<PutRecordWithSwapResult>;
  uploadBlob: (params: { data: Blob | File; repo: string }) => Promise<{ blobRef: l.BlobRef; mimeType: string }>;
}

interface StoreInterface {
  get: () => Promise<StoredSession | null>;
  getByDid: (did: string) => Promise<StoredSession | null>;
  set: (session: StoredSession) => Promise<void>;
  clear: () => Promise<void>;
  clearForDid: (did: string) => Promise<void>;
  isAccessTokenValid: () => Promise<boolean>;
  listDids: () => Promise<string[]>;
  listAll: () => Promise<{ accounts: { did: string; handle?: string; expiresAt: number }[]; activeDid: string | null }>;
  getActiveDid: () => Promise<string | null>;
  setActiveDid: (did: string) => Promise<void>;
}

export interface RouterDeps {
  store: StoreInterface;
  redirectUri: string;
  openTab: (url: string) => Promise<void>;
  buildAuthReq: (params: Parameters<typeof buildAuthorizationRequest>[0]) => Promise<AuthorizationRequest>;
  createXrpc: (config: XrpcClientConfig) => XrpcInterface;
  /** Store PKCE parameters and, optionally, the PDS URL chosen at sign-in time. */
  storeAuthState: (state: string, codeVerifier: string, pdsUrl?: string) => Promise<void>;
  getAuthState: () => Promise<{ state: string; codeVerifier: string; pdsUrl?: string } | null>;
  clearAuthState: () => Promise<void>;
  exchangeCode: (
    tokenEndpoint: string,
    code: string,
    codeVerifier: string,
    clientId: string,
    redirectUri: string,
  ) => Promise<TokenResponse>;
  refreshTokens: (tokenEndpoint: string, refreshToken: string, clientId: string) => Promise<TokenResponse>;
}

// ── Known message types ──────────────────────────────────────────────────────

const KNOWN_TYPES = new Set([
  'AUTH_SIGN_IN',
  'AUTH_SIGN_OUT',
  'AUTH_REAUTHORIZE',
  'AUTH_GET_STATUS',
  'AUTH_CALLBACK',
  'AUTH_LIST_ACCOUNTS',
  'AUTH_SWITCH_ACCOUNT',
  'AUTH_SIGN_OUT_ACCOUNT',
  'GET_SETTINGS',
  'SET_SETTINGS',
  'GET_RECORD',
  'PUT_RECORD',
  'UPLOAD_BLOB',
  'SET_PDS_URL',
  'GET_PDS_URL',
  'CHECK_LABELER_SUBSCRIPTION',
]);

type IncomingMessage = Record<string, unknown> & { type: string };

function isMessage(msg: unknown): msg is IncomingMessage {
  return (
    msg !== null &&
    typeof msg === 'object' &&
    'type' in msg &&
    typeof (msg as Record<string, unknown>)['type'] === 'string' &&
    KNOWN_TYPES.has((msg as Record<string, unknown>)['type'] as string)
  );
}

// ── Payload validators ────────────────────────────────────────────────────────

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isValidDid(value: unknown): value is string {
  return isNonEmptyString(value) && /^did:[a-z]+:.+$/u.test(value);
}

interface GetRecordPayload {
  repo: string;
  collection: string;
  rkey: string;
}

function isValidGetRecordPayload(msg: IncomingMessage): msg is IncomingMessage & GetRecordPayload {
  return isNonEmptyString(msg['repo']) && isNonEmptyString(msg['collection']) && isNonEmptyString(msg['rkey']);
}

interface PutRecordPayload {
  repo: string;
  collection: string;
  rkey: string;
  record: Record<string, unknown> & { $type: string };
  swapRecord?: string;
}

function isValidPutRecordPayload(msg: IncomingMessage): msg is IncomingMessage & PutRecordPayload {
  if (!isNonEmptyString(msg['repo']) || !isNonEmptyString(msg['collection']) || !isNonEmptyString(msg['rkey'])) {
    return false;
  }
  const record = msg['record'];
  if (
    record === null ||
    typeof record !== 'object' ||
    Array.isArray(record) ||
    Object.getPrototypeOf(record) !== Object.prototype
  ) {
    return false;
  }
  if (!isNonEmptyString((record as Record<string, unknown>)['$type'])) {
    return false;
  }
  if (msg['swapRecord'] !== undefined && !isNonEmptyString(msg['swapRecord'])) {
    return false;
  }
  return true;
}

function isUploadBlobPayload(message: unknown): message is { data: Blob | File; repo: string } {
  return (
    typeof message === 'object' &&
    message !== null &&
    'data' in message &&
    'repo' in message &&
    typeof message['repo'] === 'string' &&
    (message['data'] instanceof Blob || message['data'] instanceof File)
  );
}

function isValidSettingsPayload(
  msg: IncomingMessage,
): msg is IncomingMessage & { settings: { editTimeLimit: number | null } } {
  const settings = msg['settings'];
  if (settings === null || typeof settings !== 'object' || Array.isArray(settings)) {
    return false;
  }

  const editTimeLimit = (settings as Record<string, unknown>)['editTimeLimit'];
  return isValidEditTimeLimit(editTimeLimit);
}

// ── Handler ──────────────────────────────────────────────────────────────────

/**
 * Central dispatch function for all extension messages.
 *
 * Validates, authorizes, and routes each `MessageRequest` variant to the
 * appropriate module, then returns a typed response.
 *
 * Pass `deps` to inject mocks in unit tests; production code uses the
 * `createDefaultDeps()` helper below or wires `registerMessageRouter()`.
 */
export async function handleMessage(message: unknown, deps: RouterDeps): Promise<unknown> {
  if (!isMessage(message)) {
    return { error: 'Unknown message type' };
  }

  switch (message['type']) {
    case 'AUTH_SIGN_IN':
    case 'AUTH_REAUTHORIZE': {
      // Use PDS URL from message payload, or fall back to the active account's URL
      const pdsUrl =
        message['pdsUrl'] && typeof message['pdsUrl'] === 'string' ? message['pdsUrl'] : await getCurrentPdsUrl();

      const authReq = await deps.buildAuthReq({
        clientId: BSKY_OAUTH_CLIENT_ID,
        redirectUri: deps.redirectUri,
        scope: BSKY_OAUTH_SCOPE,
        authorizationEndpoint: getOAuthAuthorizeUrl(pdsUrl),
      });
      // Store PKCE state together with the chosen PDS URL so AUTH_CALLBACK
      // can associate the URL with the DID once it is known.
      await deps.storeAuthState(authReq.state, authReq.codeVerifier, pdsUrl);
      await deps.openTab(authReq.url);

      return { ok: true };
    }

    case 'AUTH_SIGN_OUT': {
      await deps.store.clear();
      return { ok: true };
    }

    case 'AUTH_CALLBACK': {
      const code = message['code'];
      const callbackState = message['state'];
      if (!isNonEmptyString(code) || !isNonEmptyString(callbackState)) {
        return { error: 'Invalid AUTH_CALLBACK payload' };
      }

      const pending = await deps.getAuthState();
      if (pending === null) {
        return { error: 'No pending auth state' };
      }

      // CSRF protection: verify the state matches what was stored before the redirect
      if (pending.state !== callbackState) {
        await deps.clearAuthState();
        return { error: 'State mismatch' };
      }

      try {
        // Retrieve the PDS URL that was stored when the sign-in was initiated;
        // fall back to getCurrentPdsUrl() for backward compatibility.
        const pdsUrl = pending.pdsUrl ?? (await getCurrentPdsUrl());
        const tokens = await deps.exchangeCode(
          getOAuthTokenUrl(pdsUrl),
          code,
          pending.codeVerifier,
          BSKY_OAUTH_CLIENT_ID,
          deps.redirectUri,
        );
        // Validate required token fields before persisting a session
        if (!isNonEmptyString(tokens.access_token)) {
          return { error: 'Invalid token response from authorization server: missing access token' };
        }
        if (!isNonEmptyString(tokens.sub) || !/^did:[a-z]+:.+$/u.test(tokens.sub)) {
          return { error: 'Invalid token response from authorization server: missing or invalid subject DID' };
        }
        if (!isNonEmptyString(tokens.refresh_token)) {
          return { error: 'Invalid token response from authorization server: missing refresh token' };
        }
        if (
          tokens.expires_in !== undefined &&
          (typeof tokens.expires_in !== 'number' ||
            !Number.isFinite(tokens.expires_in) ||
            tokens.expires_in <= 0 ||
            tokens.expires_in > 86_400)
        ) {
          return { error: 'Invalid token response from authorization server: invalid expiry' };
        }
        const session: StoredSession = {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: tokens.expires_in !== undefined ? Date.now() + tokens.expires_in * 1000 : Date.now() + 3_600_000,
          scope: tokens.scope ?? BSKY_OAUTH_SCOPE,
          did: tokens.sub,
        };

        // Resolve the user's actual PDS from their DID document.
        // `pdsUrl` here is the authorization server (entryway, e.g. bsky.social).
        // OAuth tokens are bound to the PDS, not the entryway, so XRPC calls must
        // go to the PDS host (e.g. *.bsky.network).
        const resolvedPdsUrl = await getPdsUrlForDid(session.did);
        const actualPdsUrl = resolvedPdsUrl ?? pdsUrl;

        // Persist the actual PDS URL for this DID now that we know who authenticated
        await setCurrentPdsUrl(session.did, actualPdsUrl);

        // Fetch and store the handle immediately after setting the session
        const userHandle = await fetchHandle(actualPdsUrl, session.accessToken, session.did);
        if (userHandle !== null) {
          session.handle = userHandle;
        }

        await deps.store.set(session);

        // Fire-and-forget: check labeler subscription after successful sign-in.
        // Silent fail — must never block the AUTH_CALLBACK response.
        void checkAndScheduleLabelerPrompt(actualPdsUrl, session.accessToken);

        return { ok: true };
      } catch (err) {
        console.error('[AUTH_CALLBACK] token exchange failed:', err);
        return { error: 'Token exchange failed' };
      } finally {
        await deps.clearAuthState();
      }
    }

    case 'AUTH_GET_STATUS': {
      let stored = await deps.store.get();
      let valid = await deps.store.isAccessTokenValid();

      // If we have a stored session but the access token is expired, attempt
      // a silent refresh using the stored refresh token before giving up.
      if (stored !== null && !valid) {
        try {
          const pdsUrl = await getCurrentPdsUrl(stored.did);
          const tokens = await deps.refreshTokens(getOAuthTokenUrl(pdsUrl), stored.refreshToken, BSKY_OAUTH_CLIENT_ID);
          if (isNonEmptyString(tokens.access_token) && isNonEmptyString(tokens.refresh_token)) {
            const refreshed: StoredSession = {
              ...stored,
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiresAt:
                tokens.expires_in !== undefined ? Date.now() + tokens.expires_in * 1000 : Date.now() + 3_600_000,
            };
            await deps.store.set(refreshed);
            stored = refreshed;
            valid = true;
          }
        } catch (err) {
          console.warn('[AUTH_GET_STATUS] silent token refresh failed:', err);
        }
      }

      if (stored !== null && valid) {
        // Lazily hydrate handle if it was missing (e.g. fetchHandle failed during AUTH_CALLBACK).
        // This heals existing sessions without requiring the user to sign out and back in.
        // Wrapped in try-catch: network errors must not reject the handler (Chrome converts
        // a rejected listener Promise to `undefined` on the sender side).
        if (!stored.handle) {
          try {
            const pdsUrl = await getCurrentPdsUrl(stored.did);
            const handle = await fetchHandle(pdsUrl, stored.accessToken, stored.did);
            if (handle !== null) {
              await deps.store.set({ ...stored, handle });
              return { authenticated: true, did: stored.did, handle, expiresAt: stored.expiresAt };
            }
          } catch (err) {
            console.warn('[AUTH_GET_STATUS] lazy handle hydration failed:', err);
          }
        }
        return { authenticated: true, did: stored.did, handle: stored.handle, expiresAt: stored.expiresAt };
      }
      return { authenticated: false };
    }

    case 'AUTH_LIST_ACCOUNTS': {
      const { accounts, activeDid } = await deps.store.listAll();
      return {
        accounts: accounts.map(a => ({ ...a, isActive: a.did === activeDid })),
      };
    }

    case 'AUTH_SWITCH_ACCOUNT': {
      const did = message['did'];
      if (!isValidDid(did)) {
        return { error: 'Invalid AUTH_SWITCH_ACCOUNT payload' };
      }
      const session = await deps.store.getByDid(did);
      if (session === null) {
        return { error: 'No session found for DID' };
      }
      await deps.store.setActiveDid(did);
      return { ok: true };
    }

    case 'AUTH_SIGN_OUT_ACCOUNT': {
      const did = message['did'];
      if (!isValidDid(did)) {
        return { error: 'Invalid AUTH_SIGN_OUT_ACCOUNT payload' };
      }
      await deps.store.clearForDid(did);
      return { ok: true };
    }

    case 'GET_SETTINGS': {
      try {
        return await getSettings();
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to get settings' };
      }
    }

    case 'SET_SETTINGS': {
      if (!isValidSettingsPayload(message)) {
        return { error: 'Invalid settings payload' };
      }

      try {
        await setSettings(message['settings']);
        return { ok: true };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to save settings' };
      }
    }

    case 'GET_RECORD': {
      if (!isValidGetRecordPayload(message)) {
        return { error: 'Invalid GET_RECORD payload' };
      }
      const stored = await deps.store.get();
      const valid = await deps.store.isAccessTokenValid();
      if (stored === null || !valid) {
        return { error: 'Not authenticated' };
      }
      try {
        const pdsUrl = await getCurrentPdsUrl(stored.did);
        const client = deps.createXrpc({ service: pdsUrl, did: stored.did, accessJwt: stored.accessToken });
        return await client.getRecord({
          repo: message['repo'],
          collection: message['collection'],
          rkey: message['rkey'],
        });
      } catch (err) {
        console.error('[skeeditor] GET_RECORD failed:', err);
        return { error: err instanceof Error ? err.message : 'Failed to fetch record' };
      }
    }

    case 'PUT_RECORD': {
      if (!isValidPutRecordPayload(message)) {
        return { type: 'PUT_RECORD_ERROR', message: 'Invalid PUT_RECORD payload' } satisfies PutRecordErrorResponse;
      }
      const stored = await deps.store.get();
      const valid = await deps.store.isAccessTokenValid();
      if (stored === null || !valid) {
        return { type: 'PUT_RECORD_ERROR', message: 'Not authenticated' } satisfies PutRecordErrorResponse;
      }
      try {
        const pdsUrl = await getCurrentPdsUrl(stored.did);
        const client = deps.createXrpc({ service: pdsUrl, did: stored.did, accessJwt: stored.accessToken });
        const record = message['record'];
        const params: Parameters<XrpcInterface['putRecord']>[0] = {
          repo: message['repo'],
          collection: message['collection'],
          rkey: message['rkey'],
          record,
        };
        if (typeof message['swapRecord'] === 'string') {
          const result = await client.putRecordWithSwap({
            repo: message['repo'],
            collection: message['collection'],
            rkey: message['rkey'],
            record,
            swapRecord: message['swapRecord'],
          });

          if (result.success) {
            emitLabelTrigger(result.uri, result.cid, stored.did, stored.accessToken);
            return { type: 'PUT_RECORD_SUCCESS', uri: result.uri, cid: result.cid } satisfies PutRecordSuccessResponse;
          }

          if (result.error.kind !== 'conflict') {
            return {
              type: 'PUT_RECORD_ERROR',
              message: 'Failed to update record',
            } satisfies PutRecordErrorResponse;
          }

          const conflictResponse: PutRecordConflictResponse = result.conflict
            ? {
                type: 'PUT_RECORD_CONFLICT',
                error: result.error,
                conflict: result.conflict,
              }
            : {
                type: 'PUT_RECORD_CONFLICT',
                error: result.error,
              };

          return conflictResponse satisfies PutRecordResponse;
        }

        const result = await client.putRecord(params);
        emitLabelTrigger(result.uri, result.cid, stored.did, stored.accessToken);
        return { type: 'PUT_RECORD_SUCCESS', uri: result.uri, cid: result.cid } satisfies PutRecordSuccessResponse;
      } catch (err) {
        // Check for authentication/scope errors that require re-authentication
        const errorMessage = err instanceof Error ? err.message : 'Failed to update record';
        const isAuthError =
          errorMessage.toLowerCase().includes('invalid token') ||
          errorMessage.toLowerCase().includes('bad token') ||
          errorMessage.toLowerCase().includes('scope') ||
          errorMessage.toLowerCase().includes('unauthorized') ||
          errorMessage.toLowerCase().includes('forbidden') ||
          (err instanceof Error && 'status' in err && (err.status === 401 || err.status === 403));

        if (isAuthError) {
          await deps.store.clear();
          return {
            type: 'PUT_RECORD_ERROR',
            message: 'Authentication required. Please sign in again.',
            requiresReauth: true,
          } satisfies PutRecordErrorResponse;
        }

        return {
          type: 'PUT_RECORD_ERROR',
          message: errorMessage,
        } satisfies PutRecordErrorResponse;
      }
    }

    case 'UPLOAD_BLOB': {
      if (!isUploadBlobPayload(message)) {
        return { error: 'Invalid UPLOAD_BLOB payload' };
      }

      const stored = await deps.store.get();
      const valid = await deps.store.isAccessTokenValid();
      if (stored === null || !valid) {
        return { error: 'Not authenticated' };
      }

      try {
        const pdsUrl = await getCurrentPdsUrl(stored.did);
        const client = deps.createXrpc({ service: pdsUrl, did: stored.did, accessJwt: stored.accessToken });
        const result = await client.uploadBlob({
          data: message.data,
          repo: message.repo,
        });
        return result;
      } catch (error) {
        console.error('Upload blob error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to upload blob' };
      }
    }

    case 'SET_PDS_URL': {
      if (typeof message['url'] !== 'string' || !message['url'].startsWith('https://')) {
        return { error: 'Invalid PDS URL. Must be a valid HTTPS URL.' };
      }

      try {
        const stored = await deps.store.get();
        if (stored !== null) {
          // Associate the URL with the authenticated account's DID
          await setCurrentPdsUrl(stored.did, message['url']);
        } else {
          // No active session — store as a global pre-auth fallback
          await setGlobalPdsUrl(message['url']);
        }
        return { ok: true };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to set PDS URL' };
      }
    }

    case 'GET_PDS_URL': {
      try {
        const url = await getCurrentPdsUrl();
        return { url };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to get PDS URL' };
      }
    }

    case 'CHECK_LABELER_SUBSCRIPTION': {
      try {
        const stored = await deps.store.get();
        const valid = await deps.store.isAccessTokenValid();
        if (stored === null || !valid) return { ok: true };
        const pdsUrl = await getCurrentPdsUrl(stored.did);
        await checkAndScheduleLabelerPrompt(pdsUrl, stored.accessToken);
      } catch {
        // silent fail
      }
      return { ok: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}

// ── Default production dependencies ──────────────────────────────────────────

export function createDefaultDeps(): RouterDeps {
  return {
    store: sessionStore,
    redirectUri: BSKY_OAUTH_REDIRECT_URI,
    openTab: async (url: string): Promise<void> => {
      await browser.tabs.create({ url });
    },
    buildAuthReq: buildAuthorizationRequest,
    createXrpc: (config: XrpcClientConfig) =>
      new XrpcClient({ ...config, dpopKeyPairLoader: () => getDpopKeyPair(config.did) }),
    storeAuthState: async (state: string, codeVerifier: string, pdsUrl?: string): Promise<void> => {
      // Prefer browser.storage.session (cleared automatically on browser restart/SW termination).
      // Fall back to browser.storage.local on Firefox where storage.session may be unavailable.
      // On startup the SW clears any stale local pendingAuth from a previous lifecycle (see entrypoints/background.ts).
      const storage = browser.storage.session ?? browser.storage.local;
      await storage.set({ pendingAuth: { state, codeVerifier, pdsUrl } });
    },
    getAuthState: async (): Promise<{ state: string; codeVerifier: string; pdsUrl?: string } | null> => {
      const storage = browser.storage.session ?? browser.storage.local;
      const result = await storage.get('pendingAuth');
      const raw: unknown = (result as Record<string, unknown>)['pendingAuth'];
      if (
        raw !== null &&
        typeof raw === 'object' &&
        'state' in raw &&
        typeof (raw as Record<string, unknown>)['state'] === 'string' &&
        'codeVerifier' in raw &&
        typeof (raw as Record<string, unknown>)['codeVerifier'] === 'string'
      ) {
        const obj = raw as Record<string, unknown>;
        const result: { state: string; codeVerifier: string; pdsUrl?: string } = {
          state: obj['state'] as string,
          codeVerifier: obj['codeVerifier'] as string,
        };
        if (typeof obj['pdsUrl'] === 'string') result.pdsUrl = obj['pdsUrl'];
        return result;
      }
      return null;
    },
    clearAuthState: async (): Promise<void> => {
      const storage = browser.storage.session ?? browser.storage.local;
      await storage.remove('pendingAuth');
    },
    exchangeCode: async (tokenEndpoint, code, codeVerifier, clientId, redirectUri) => {
      const dpopKeyPair = await getDpopKeyPair();
      return exchangeCodeForTokens(tokenEndpoint, code, codeVerifier, clientId, redirectUri, dpopKeyPair);
    },
    refreshTokens: async (tokenEndpoint, refreshToken, clientId) => {
      const dpopKeyPair = await getDpopKeyPair();
      return refreshAccessToken(tokenEndpoint, refreshToken, clientId, dpopKeyPair);
    },
  };
}

// ── Service-worker registration ───────────────────────────────────────────────

/**
 * Register the message router with `browser.runtime.onMessage`.
 *
 * Call this once during service-worker initialization. The returned cleanup
 * function removes the listener and is useful in tests.
 */
export function registerMessageRouter(deps: RouterDeps = createDefaultDeps()): () => void {
  // Use return-true + sendResponse pattern for maximum compatibility.
  // Returning a Promise from an onMessage listener only works natively in Chrome 146+
  // (with the ExtensionBrowserNamespaceAndPolyfillSupport flag, still a gradual rollout
  // as of early 2026). The webextension-polyfill becomes a noop once Chrome natively
  // defines `browser`, so it cannot bridge the gap for Chrome 120–145. The
  // sendResponse + return-true pattern works on ALL Chrome versions (and Firefox/Safari).
  // Reference: https://groups.google.com/a/chromium.org/g/chromium-extensions/c/4txWvDW55hU
  const listener = (message: unknown, _sender: unknown, sendResponse: (res: unknown) => void): true => {
    handleMessage(message, deps)
      .catch((err: unknown) => {
        console.error('[background] unhandled error in message handler:', err);
        return { error: err instanceof Error ? err.message : String(err) };
      })
      .then(sendResponse);
    return true; // keep the message channel open for the async response
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser.runtime.onMessage.addListener(listener as any);

  // Port keepalive: as long as a content script holds an open 'keepalive' port,
  // Chrome will not terminate the service worker. Content scripts reconnect if
  // the SW is killed and restarted.
  const keepalivePorts = new Set<ReturnType<typeof browser.runtime.connect>>();
  const connectListener = (port: ReturnType<typeof browser.runtime.connect>): void => {
    if (port.name !== 'keepalive') return;
    keepalivePorts.add(port);
    // Signal to the content script that the SW is fully initialized and ready to
    // handle messages. The content script awaits this before sending AUTH_GET_STATUS
    // etc., eliminating the race between cold-start initialization and sendMessage.
    port.postMessage({ type: 'SW_READY' });
    port.onDisconnect.addListener(() => {
      keepalivePorts.delete(port);
    });
  };
  browser.runtime.onConnect.addListener(connectListener);

  // Intercept the OAuth callback by watching for tab navigations to the registered redirect URI.
  // This is required because the redirect target is a web-hosted page (not a bundled extension page),
  // so `window.opener.postMessage` is not available from the service worker context.
  //
  // The tabListener below does its own URL check, so no filter is passed to addListener.
  // webextension-polyfill throws "This event does not support filters" on all browsers when
  // a filter argument is provided, so we rely on manual filtering inside the callback instead.
  const callbackUrl = new URL(BSKY_OAUTH_REDIRECT_URI);

  // Track tabs already being handled to prevent double token exchange.
  // tabs.onUpdated can fire multiple times for the same navigation (once when
  // changeInfo.url is set, and again on status changes with the same tab.url).
  const handledTabs = new Set<number>();

  const tabListener = (tabId: number, changeInfo: { status?: string; url?: string }): void => {
    // Only act when the URL itself changes — ignore status-only updates.
    const urlString = changeInfo.url;
    if (!urlString) return;

    // Dedup: ignore if we already started handling this tab's callback.
    if (handledTabs.has(tabId)) return;

    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      return;
    }

    if (url.origin !== callbackUrl.origin || url.pathname !== callbackUrl.pathname) return;

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) return;

    handledTabs.add(tabId);
    void handleMessage({ type: 'AUTH_CALLBACK', code, state }, deps).then(() => {
      handledTabs.delete(tabId);
      void browser.tabs.remove(tabId);
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser.tabs.onUpdated.addListener(tabListener as any);

  return () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    browser.runtime.onMessage.removeListener(listener as any);
    browser.runtime.onConnect.removeListener(connectListener);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    browser.tabs.onUpdated.removeListener(tabListener as any);
  };
}
