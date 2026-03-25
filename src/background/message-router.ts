import type {
  GetRecordResult,
  PutRecordResult,
  PutRecordWithSwapResult,
  XrpcClientConfig,
} from '../shared/api/xrpc-client';
import { XrpcClient } from '../shared/api/xrpc-client';
import type { AuthorizationRequest } from '../shared/auth/auth-client';
import { buildAuthorizationRequest } from '../shared/auth/auth-client';
import { sessionStore } from '../shared/auth/session-store';
import { BSKY_OAUTH_AUTHORIZE_URL, BSKY_OAUTH_CLIENT_ID, BSKY_OAUTH_SCOPE, BSKY_PDS_URL } from '../shared/constants';
import type {
  PutRecordConflictResponse,
  PutRecordErrorResponse,
  PutRecordResponse,
  PutRecordSuccessResponse,
} from '../shared/messages';

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
}

interface StoreInterface {
  get: () => Promise<{ did: string; accessToken: string; expiresAt: number } | null>;
  clear: () => Promise<void>;
  isAccessTokenValid: () => Promise<boolean>;
}

export interface RouterDeps {
  store: StoreInterface;
  redirectUri: string;
  openTab: (url: string) => Promise<void>;
  buildAuthReq: (params: Parameters<typeof buildAuthorizationRequest>[0]) => Promise<AuthorizationRequest>;
  createXrpc: (config: XrpcClientConfig) => XrpcInterface;
  storeAuthState: (state: string, codeVerifier: string) => Promise<void>;
}

// ── Known message types ──────────────────────────────────────────────────────

const KNOWN_TYPES = new Set([
  'AUTH_SIGN_IN',
  'AUTH_SIGN_OUT',
  'AUTH_REAUTHORIZE',
  'AUTH_GET_STATUS',
  'GET_RECORD',
  'PUT_RECORD',
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
      const authReq = await deps.buildAuthReq({
        clientId: BSKY_OAUTH_CLIENT_ID,
        redirectUri: deps.redirectUri,
        scope: BSKY_OAUTH_SCOPE,
        authorizationEndpoint: BSKY_OAUTH_AUTHORIZE_URL,
      });
      await deps.storeAuthState(authReq.state, authReq.codeVerifier);
      await deps.openTab(authReq.url);
      return { ok: true };
    }

    case 'AUTH_SIGN_OUT': {
      await deps.store.clear();
      return { ok: true };
    }

    case 'AUTH_GET_STATUS': {
      const stored = await deps.store.get();
      const valid = await deps.store.isAccessTokenValid();
      if (stored !== null && valid) {
        return { authenticated: true, did: stored.did, expiresAt: stored.expiresAt };
      }
      return { authenticated: false };
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
        const client = deps.createXrpc({ service: BSKY_PDS_URL, did: stored.did, accessJwt: stored.accessToken });
        return await client.getRecord({
          repo: message['repo'],
          collection: message['collection'],
          rkey: message['rkey'],
        });
      } catch (err) {
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
        const client = deps.createXrpc({ service: BSKY_PDS_URL, did: stored.did, accessJwt: stored.accessToken });
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
            return { type: 'PUT_RECORD_SUCCESS', uri: result.uri, cid: result.cid } satisfies PutRecordSuccessResponse;
          }

          if (result.error.kind !== 'conflict') {
            return {
              type: 'PUT_RECORD_ERROR',
              message: result.error.message,
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
        return { type: 'PUT_RECORD_SUCCESS', uri: result.uri, cid: result.cid } satisfies PutRecordSuccessResponse;
      } catch (err) {
        return {
          type: 'PUT_RECORD_ERROR',
          message: err instanceof Error ? err.message : 'Failed to update record',
        } satisfies PutRecordErrorResponse;
      }
    }

    default:
      return { error: 'Unknown message type' };
  }
}

// ── Default production dependencies ──────────────────────────────────────────

export function createDefaultDeps(): RouterDeps {
  return {
    store: sessionStore,
    redirectUri: browser.runtime.getURL('callback.html'),
    openTab: async (url: string): Promise<void> => {
      await browser.tabs.create({ url });
    },
    buildAuthReq: buildAuthorizationRequest,
    createXrpc: (config: XrpcClientConfig) => new XrpcClient(config),
    storeAuthState: async (state: string, codeVerifier: string): Promise<void> => {
      await browser.storage.local.set({ pendingAuth: { state, codeVerifier } });
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
  const listener = (message: unknown): Promise<unknown> => handleMessage(message, deps);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser.runtime.onMessage.addListener(listener as any);
  return () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    browser.runtime.onMessage.removeListener(listener as any);
  };
}
