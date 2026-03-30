import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RouterDeps } from '@src/background/message-router';
import { createDefaultDeps, handleMessage } from '@src/background/message-router';
import * as constants from '@src/shared/constants';
import type {
  CreateRecordResult,
  GetRecordResult,
  PutRecordResult,
  PutRecordWithSwapResult,
} from '@src/shared/api/xrpc-client';
import type { AuthorizationRequest } from '@src/shared/auth/auth-client';
import type { StoredSession } from '@src/shared/auth/session-store';

vi.mock('@src/shared/auth/auth-client', () => ({
  buildAuthorizationRequest: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
}));

vi.mock('@src/shared/auth/dpop', () => ({
  createDpopProof: vi.fn().mockResolvedValue('test-dpop-proof'),
  loadOrCreateDpopKeyPair: vi.fn().mockResolvedValue({
    publicKey: {} as CryptoKey,
    privateKey: {} as CryptoKey,
  }),
}));

const makeSession = (overrides: Partial<StoredSession> = {}): StoredSession => ({
  accessToken: 'at-token',
  refreshToken: 'rt-token',
  expiresAt: Date.now() + 60_000,
  scope: 'atproto transition:generic',
  did: 'did:plc:testuser',
  ...overrides,
});

const makeAuthRequest = (): AuthorizationRequest => ({
  url: 'https://bsky.social/oauth/authorize?response_type=code&client_id=test',
  state: 'random-state',
  codeVerifier: 'random-verifier',
});

const makeStoreMock = (session: StoredSession | null = null) => ({
  get: vi.fn().mockResolvedValue(session),
  getByDid: vi.fn().mockResolvedValue(session),
  set: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
  clearForDid: vi.fn().mockResolvedValue(undefined),
  isAccessTokenValid: vi.fn().mockResolvedValue(session !== null),
  listDids: vi.fn().mockResolvedValue(session !== null ? [session.did] : []),
  listAll: vi.fn().mockResolvedValue({
    accounts: session !== null ? [{ did: session.did, handle: session.handle, expiresAt: session.expiresAt }] : [],
    activeDid: session?.did ?? null,
  }),
  getActiveDid: vi.fn().mockResolvedValue(session?.did ?? null),
  setActiveDid: vi.fn().mockResolvedValue(undefined),
});

const makeXrpcMock = () => ({
  getRecord: vi.fn<() => Promise<GetRecordResult>>().mockResolvedValue({
    value: { $type: 'app.bsky.feed.post', text: 'hello' },
    cid: 'bafyreiabc',
  }),
  createRecord: vi.fn<() => Promise<CreateRecordResult>>().mockResolvedValue({
    uri: 'at://did:plc:testuser/app.bsky.feed.post/new',
    cid: 'bafyreinewrecord',
  }),
  putRecord: vi.fn<() => Promise<PutRecordResult>>().mockResolvedValue({
    uri: 'at://did:plc:testuser/app.bsky.feed.post/abc',
    cid: 'bafyreinew',
  }),
  putRecordWithSwap: vi.fn<() => Promise<PutRecordWithSwapResult>>().mockResolvedValue({
    success: true,
    uri: 'at://did:plc:testuser/app.bsky.feed.post/abc',
    cid: 'bafyreinew',
  }),
  uploadBlob: vi.fn().mockResolvedValue({
    blobRef: { ref: { $link: 'bafyreiblob' }, mimeType: 'image/png', size: 123 } as unknown,
    mimeType: 'image/png',
  }),
});

const makeDeps = (overrides: Partial<RouterDeps> = {}): RouterDeps => ({
  store: makeStoreMock(),
  redirectUri: 'chrome-extension://abc/callback.html',
  openTab: vi.fn().mockResolvedValue(undefined),
  buildAuthReq: vi.fn().mockResolvedValue(makeAuthRequest()),
  createXrpc: vi.fn().mockReturnValue(makeXrpcMock()),
  storeAuthState: vi.fn().mockResolvedValue(undefined),
  getAuthState: vi.fn().mockResolvedValue(null),
  clearAuthState: vi.fn().mockResolvedValue(undefined),
  exchangeCode: vi.fn().mockResolvedValue({
    access_token: 'new-access-token',
    refresh_token: 'new-refresh-token',
    expires_in: 3600,
    scope: 'atproto transition:generic',
    sub: 'did:plc:testuser',
  }),
  refreshTokens: vi.fn().mockResolvedValue({
    access_token: 'refreshed-access-token',
    refresh_token: 'refreshed-refresh-token',
    expires_in: 3600,
    scope: 'atproto transition:generic',
    sub: 'did:plc:testuser',
  }),
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleMessage', () => {
  describe('unknown messages', () => {
    it('returns an error for unknown message type', async () => {
      const result = await handleMessage({ type: 'TOTALLY_UNKNOWN' }, makeDeps());
      expect(result).toEqual({ error: 'Unknown message type' });
    });

    it('returns an error for non-object messages', async () => {
      const result = await handleMessage(null, makeDeps());
      expect(result).toEqual({ error: 'Unknown message type' });
    });
  });

  describe('AUTH_SIGN_OUT', () => {
    it('clears the session and returns ok', async () => {
      const deps = makeDeps({ store: makeStoreMock(makeSession()) });

      const result = await handleMessage({ type: 'AUTH_SIGN_OUT' }, deps);

      expect(vi.mocked(deps.store.clear)).toHaveBeenCalledOnce();
      expect(result).toEqual({ ok: true });
    });
  });

  describe('AUTH_GET_STATUS', () => {
    it('returns authenticated status with DID and handle when valid session exists', async () => {
      const session = makeSession({ handle: 'alice.bsky.social' });
      const deps = makeDeps({ store: makeStoreMock(session) });

      const result = await handleMessage({ type: 'AUTH_GET_STATUS' }, deps);

      expect(result).toEqual({
        authenticated: true,
        did: session.did,
        handle: 'alice.bsky.social',
        expiresAt: session.expiresAt,
      });
    });

    it('lazily fetches and persists handle when session is missing handle', async () => {
      const session = makeSession();
      const store = makeStoreMock(session);
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        json: vi.fn().mockResolvedValue({ handle: 'alice.bsky.social' }),
      } as unknown as Response);
      const deps = makeDeps({ store });

      const result = await handleMessage({ type: 'AUTH_GET_STATUS' }, deps);

      expect(result).toEqual({
        authenticated: true,
        did: session.did,
        handle: 'alice.bsky.social',
        expiresAt: session.expiresAt,
      });
      expect(store.set).toHaveBeenCalledWith({ ...session, handle: 'alice.bsky.social' });
    });

    it('returns authenticated status without handle when lazy fetch fails', async () => {
      const session = makeSession();
      const store = makeStoreMock(session);
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
      } as unknown as Response);
      const deps = makeDeps({ store });

      const result = await handleMessage({ type: 'AUTH_GET_STATUS' }, deps);

      expect(result).toEqual({
        authenticated: true,
        did: session.did,
        handle: undefined,
        expiresAt: session.expiresAt,
      });
      expect(store.set).not.toHaveBeenCalled();
    });

    it('returns unauthenticated when no session is stored', async () => {
      const deps = makeDeps({ store: makeStoreMock(null) });

      const result = await handleMessage({ type: 'AUTH_GET_STATUS' }, deps);

      expect(result).toEqual({ authenticated: false });
    });
  });

  describe('AUTH_SIGN_IN', () => {
    it('builds an authorization request, stores PKCE state, and opens a tab', async () => {
      const authRequest = makeAuthRequest();
      const deps = makeDeps({
        buildAuthReq: vi.fn().mockResolvedValue(authRequest),
      });

      const result = await handleMessage({ type: 'AUTH_SIGN_IN' }, deps);

      expect(vi.mocked(deps.buildAuthReq)).toHaveBeenCalledOnce();
      expect(vi.mocked(deps.storeAuthState)).toHaveBeenCalledWith(
        authRequest.state,
        authRequest.codeVerifier,
        expect.any(String),
      );
      expect(vi.mocked(deps.openTab)).toHaveBeenCalledWith(authRequest.url);
      expect(result).toEqual({ ok: true });
    });
  });

  describe('settings', () => {
    it('returns stored settings for GET_SETTINGS', async () => {
      vi.spyOn(constants, 'getSettings').mockResolvedValue({ editTimeLimit: 5 });

      const result = await handleMessage({ type: 'GET_SETTINGS' }, makeDeps());

      expect(result).toEqual({ editTimeLimit: 5 });
    });

    it('persists settings for SET_SETTINGS', async () => {
      const setSettingsSpy = vi.spyOn(constants, 'setSettings').mockResolvedValue(undefined);

      const result = await handleMessage({ type: 'SET_SETTINGS', settings: { editTimeLimit: 0.5 } }, makeDeps());

      expect(setSettingsSpy).toHaveBeenCalledWith({ editTimeLimit: 0.5 });
      expect(result).toEqual({ ok: true });
    });

    it('rejects invalid settings payloads', async () => {
      const result = await handleMessage({ type: 'SET_SETTINGS', settings: { editTimeLimit: 10 } }, makeDeps());

      expect(result).toEqual({ error: 'Invalid settings payload' });
    });
  });

  describe('AUTH_CALLBACK', () => {
    it('rejects invalid payload missing code or state', async () => {
      const deps = makeDeps();

      const result1 = await handleMessage({ type: 'AUTH_CALLBACK', code: '', state: 'state' }, deps);
      const result2 = await handleMessage({ type: 'AUTH_CALLBACK', code: 'code', state: '' }, deps);
      const result3 = await handleMessage({ type: 'AUTH_CALLBACK', code: '' as never, state: '' as never }, deps);

      expect(result1).toEqual({ error: 'Invalid AUTH_CALLBACK payload' });
      expect(result2).toEqual({ error: 'Invalid AUTH_CALLBACK payload' });
      expect(result3).toEqual({ error: 'Invalid AUTH_CALLBACK payload' });
    });

    it('rejects when no pending auth state exists', async () => {
      const deps = makeDeps({
        getAuthState: vi.fn().mockResolvedValue(null),
      });

      const result = await handleMessage({ type: 'AUTH_CALLBACK', code: 'code', state: 'state' }, deps);

      expect(result).toEqual({ error: 'No pending auth state' });
      expect(vi.mocked(deps.getAuthState)).toHaveBeenCalledOnce();
    });

    it('rejects on state mismatch and clears pending state', async () => {
      const deps = makeDeps({
        getAuthState: vi.fn().mockResolvedValue({ state: 'stored-state', codeVerifier: 'verifier' }),
      });

      const result = await handleMessage({ type: 'AUTH_CALLBACK', code: 'code', state: 'different-state' }, deps);

      expect(result).toEqual({ error: 'State mismatch' });
      expect(vi.mocked(deps.clearAuthState)).toHaveBeenCalledOnce();
    });

    it('exchanges code for tokens and stores session on successful callback', async () => {
      const deps = makeDeps({
        getAuthState: vi.fn().mockResolvedValue({ state: 'matching-state', codeVerifier: 'verifier' }),
      });

      const result = await handleMessage({ type: 'AUTH_CALLBACK', code: 'auth-code', state: 'matching-state' }, deps);

      expect(vi.mocked(deps.exchangeCode)).toHaveBeenCalledWith(
        expect.any(String),
        'auth-code',
        'verifier',
        expect.any(String),
        'chrome-extension://abc/callback.html',
      );
      expect(vi.mocked(deps.store.set)).toHaveBeenCalledWith({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: expect.any(Number),
        scope: 'atproto transition:generic',
        did: 'did:plc:testuser',
        authServerUrl: expect.any(String),
      });
      expect(vi.mocked(deps.clearAuthState)).toHaveBeenCalledOnce();
      expect(result).toEqual({ ok: true });
    });

    it('returns an error when expires_in is not a positive number', async () => {
      const deps = makeDeps({
        getAuthState: vi.fn().mockResolvedValue({ state: 'matching-state', codeVerifier: 'verifier' }),
        exchangeCode: vi.fn().mockResolvedValue({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 'not-a-number',
          scope: 'atproto transition:generic',
          sub: 'did:plc:testuser',
        }),
      });

      const result = await handleMessage({ type: 'AUTH_CALLBACK', code: 'auth-code', state: 'matching-state' }, deps);

      expect(result).toEqual({
        error: 'Invalid token response from authorization server: invalid expiry',
      });
    });

    it('returns an error when expires_in is negative', async () => {
      const deps = makeDeps({
        getAuthState: vi.fn().mockResolvedValue({ state: 'matching-state', codeVerifier: 'verifier' }),
        exchangeCode: vi.fn().mockResolvedValue({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: -100,
          scope: 'atproto transition:generic',
          sub: 'did:plc:testuser',
        }),
      });

      const result = await handleMessage({ type: 'AUTH_CALLBACK', code: 'auth-code', state: 'matching-state' }, deps);

      expect(result).toEqual({
        error: 'Invalid token response from authorization server: invalid expiry',
      });
    });

    it('clears pending state even on token exchange failure', async () => {
      const deps = makeDeps({
        getAuthState: vi.fn().mockResolvedValue({ state: 'matching-state', codeVerifier: 'verifier' }),
        exchangeCode: vi.fn().mockRejectedValue(new Error('Server internal error: rate limit exceeded')),
      });

      const result = await handleMessage({ type: 'AUTH_CALLBACK', code: 'auth-code', state: 'matching-state' }, deps);

      expect(result).toEqual({ error: 'Token exchange failed' });
      expect(vi.mocked(deps.clearAuthState)).toHaveBeenCalledOnce();
    });
  });

  describe('AUTH_REAUTHORIZE', () => {
    it('opens a new authorization flow just like AUTH_SIGN_IN', async () => {
      const deps = makeDeps();

      const result = await handleMessage({ type: 'AUTH_REAUTHORIZE' }, deps);

      expect(vi.mocked(deps.buildAuthReq)).toHaveBeenCalledOnce();
      expect(vi.mocked(deps.openTab)).toHaveBeenCalledOnce();
      expect(result).toEqual({ ok: true });
    });
  });

  describe('GET_RECORD', () => {
    it('returns Not authenticated when no valid session exists', async () => {
      const deps = makeDeps({ store: makeStoreMock(null) });

      const result = await handleMessage(
        { type: 'GET_RECORD', repo: 'did:plc:alice', collection: 'app.bsky.feed.post', rkey: 'abc' },
        deps,
      );

      expect(result).toEqual({ error: 'Not authenticated' });
    });

    it('calls xrpcClient.getRecord with the correct params when authenticated', async () => {
      const session = makeSession();
      const xrpc = makeXrpcMock();
      const deps = makeDeps({
        store: makeStoreMock(session),
        createXrpc: vi.fn().mockReturnValue(xrpc),
      });

      const result = await handleMessage(
        { type: 'GET_RECORD', repo: 'did:plc:alice', collection: 'app.bsky.feed.post', rkey: 'abc' },
        deps,
      );

      expect(vi.mocked(xrpc.getRecord)).toHaveBeenCalledWith({
        repo: 'did:plc:alice',
        collection: 'app.bsky.feed.post',
        rkey: 'abc',
      });
      expect(result).toEqual({ value: { $type: 'app.bsky.feed.post', text: 'hello' }, cid: 'bafyreiabc' });
    });

    it('returns the underlying error message when getRecord throws', async () => {
      const session = makeSession();
      const xrpc = makeXrpcMock();
      xrpc.getRecord.mockRejectedValueOnce(new Error('XRPC network error'));
      const deps = makeDeps({ store: makeStoreMock(session), createXrpc: vi.fn().mockReturnValue(xrpc) });

      const result = await handleMessage(
        { type: 'GET_RECORD', repo: 'did:plc:alice', collection: 'app.bsky.feed.post', rkey: 'abc' },
        deps,
      );

      expect(result).toEqual({ error: 'XRPC network error' });
    });

    it('returns a fallback error message when getRecord throws a non-Error', async () => {
      const session = makeSession();
      const xrpc = makeXrpcMock();
      xrpc.getRecord.mockRejectedValueOnce('string-rejection');
      const deps = makeDeps({ store: makeStoreMock(session), createXrpc: vi.fn().mockReturnValue(xrpc) });

      const result = await handleMessage(
        { type: 'GET_RECORD', repo: 'did:plc:alice', collection: 'app.bsky.feed.post', rkey: 'abc' },
        deps,
      );

      expect(result).toEqual({ error: 'Failed to fetch record' });
    });
  });

  describe('PUT_RECORD', () => {
    it('returns Not authenticated when no valid session exists', async () => {
      const deps = makeDeps({ store: makeStoreMock(null) });

      const result = await handleMessage(
        {
          type: 'PUT_RECORD',
          repo: 'did:plc:alice',
          collection: 'app.bsky.feed.post',
          rkey: 'abc',
          record: { $type: 'app.bsky.feed.post', text: 'hello' },
        },
        deps,
      );

      expect(result).toEqual({ type: 'PUT_RECORD_ERROR', message: 'Not authenticated' });
    });

    it('calls xrpcClient.putRecordWithSwap with the correct params when authenticated', async () => {
      const session = makeSession();
      const xrpc = makeXrpcMock();
      const deps = makeDeps({
        store: makeStoreMock(session),
        createXrpc: vi.fn().mockReturnValue(xrpc),
      });
      const record = { $type: 'app.bsky.feed.post', text: 'edited' };

      const result = await handleMessage(
        {
          type: 'PUT_RECORD',
          repo: 'did:plc:alice',
          collection: 'app.bsky.feed.post',
          rkey: 'abc',
          record,
          swapRecord: 'bafyreiabc',
        },
        deps,
      );

      expect(vi.mocked(xrpc.putRecordWithSwap)).toHaveBeenCalledWith({
        repo: 'did:plc:alice',
        collection: 'app.bsky.feed.post',
        rkey: 'abc',
        record,
        swapRecord: 'bafyreiabc',
      });
      expect(result).toEqual({
        type: 'PUT_RECORD_SUCCESS',
        uri: 'at://did:plc:testuser/app.bsky.feed.post/abc',
        cid: 'bafyreinew',
      });
    });

    it('calls xrpcClient.putRecord (no swap) when swapRecord is absent', async () => {
      const session = makeSession();
      const xrpc = makeXrpcMock();
      const deps = makeDeps({
        store: makeStoreMock(session),
        createXrpc: vi.fn().mockReturnValue(xrpc),
      });
      const record = { $type: 'app.bsky.feed.post', text: 'no swap' };

      const result = await handleMessage(
        {
          type: 'PUT_RECORD',
          repo: 'did:plc:alice',
          collection: 'app.bsky.feed.post',
          rkey: 'abc',
          record,
        },
        deps,
      );

      expect(vi.mocked(xrpc.putRecord)).toHaveBeenCalledWith({
        repo: 'did:plc:alice',
        collection: 'app.bsky.feed.post',
        rkey: 'abc',
        record,
      });
      expect(vi.mocked(xrpc.putRecordWithSwap)).not.toHaveBeenCalled();
      expect(result).toEqual({
        type: 'PUT_RECORD_SUCCESS',
        uri: 'at://did:plc:testuser/app.bsky.feed.post/abc',
        cid: 'bafyreinew',
      });
    });

    it('returns a structured conflict result when xrpcClient reports a conflict', async () => {
      const session = makeSession();
      const xrpc = makeXrpcMock();
      vi.mocked(xrpc.putRecordWithSwap).mockResolvedValueOnce({
        success: false,
        error: {
          kind: 'conflict',
          message: 'stale write',
          status: 409,
        },
        conflict: {
          currentCid: 'bafyrelatest',
          currentValue: { $type: 'app.bsky.feed.post', text: 'latest' },
        },
      });
      const deps = makeDeps({
        store: makeStoreMock(session),
        createXrpc: vi.fn().mockReturnValue(xrpc),
      });

      const result = await handleMessage(
        {
          type: 'PUT_RECORD',
          repo: 'did:plc:alice',
          collection: 'app.bsky.feed.post',
          rkey: 'abc',
          record: { $type: 'app.bsky.feed.post', text: 'edited' },
          swapRecord: 'bafyreiabc',
        },
        deps,
      );

      expect(result).toEqual({
        type: 'PUT_RECORD_CONFLICT',
        error: {
          kind: 'conflict',
          message: 'stale write',
          status: 409,
        },
        conflict: {
          currentCid: 'bafyrelatest',
          currentValue: { $type: 'app.bsky.feed.post', text: 'latest' },
        },
      });
    });

    it('returns PUT_RECORD_CONFLICT without conflict field when no conflict details are available', async () => {
      const session = makeSession();
      const xrpc = makeXrpcMock();
      vi.mocked(xrpc.putRecordWithSwap).mockResolvedValueOnce({
        success: false,
        error: {
          kind: 'conflict',
          message: 'stale write',
          status: 409,
        },
      });
      const deps = makeDeps({
        store: makeStoreMock(session),
        createXrpc: vi.fn().mockReturnValue(xrpc),
      });

      const result = await handleMessage(
        {
          type: 'PUT_RECORD',
          repo: 'did:plc:alice',
          collection: 'app.bsky.feed.post',
          rkey: 'abc',
          record: { $type: 'app.bsky.feed.post', text: 'edited' },
          swapRecord: 'bafyreiabc',
        },
        deps,
      );

      expect(result).toEqual({
        type: 'PUT_RECORD_CONFLICT',
        error: { kind: 'conflict', message: 'stale write', status: 409 },
      });
      // 'conflict' key must be absent (exactOptionalPropertyTypes compliance)
      expect(result).not.toHaveProperty('conflict');
    });

    it('returns PUT_RECORD_ERROR for non-conflict swap failures (e.g. network error)', async () => {
      const session = makeSession();
      const xrpc = makeXrpcMock();
      vi.mocked(xrpc.putRecordWithSwap).mockResolvedValueOnce({
        success: false,
        error: {
          kind: 'network',
          message: 'network failure',
          status: 500,
        },
      });
      const deps = makeDeps({
        store: makeStoreMock(session),
        createXrpc: vi.fn().mockReturnValue(xrpc),
      });

      const result = await handleMessage(
        {
          type: 'PUT_RECORD',
          repo: 'did:plc:alice',
          collection: 'app.bsky.feed.post',
          rkey: 'abc',
          record: { $type: 'app.bsky.feed.post', text: 'edited' },
          swapRecord: 'bafyreiabc',
        },
        deps,
      );

      expect(result).toEqual({ type: 'PUT_RECORD_ERROR', message: 'Failed to update record' });
    });

    it('returns PUT_RECORD_ERROR for auth swap failures', async () => {
      const session = makeSession();
      const xrpc = makeXrpcMock();
      vi.mocked(xrpc.putRecordWithSwap).mockResolvedValueOnce({
        success: false,
        error: {
          kind: 'auth',
          message: 'Unauthorized',
          status: 401,
        },
      });
      const deps = makeDeps({
        store: makeStoreMock(session),
        createXrpc: vi.fn().mockReturnValue(xrpc),
      });

      const result = await handleMessage(
        {
          type: 'PUT_RECORD',
          repo: 'did:plc:alice',
          collection: 'app.bsky.feed.post',
          rkey: 'abc',
          record: { $type: 'app.bsky.feed.post', text: 'edited' },
          swapRecord: 'bafyreiabc',
        },
        deps,
      );

      expect(result).toEqual({ type: 'PUT_RECORD_ERROR', message: 'Failed to update record' });
    });

    it('returns a structured error when record field is missing', async () => {
      const deps = makeDeps({ store: makeStoreMock(makeSession()) });

      const result = await handleMessage(
        { type: 'PUT_RECORD', repo: 'did:plc:alice', collection: 'app.bsky.feed.post', rkey: 'abc' },
        deps,
      );

      expect(result).toEqual({ type: 'PUT_RECORD_ERROR', message: 'Invalid PUT_RECORD payload' });
    });

    it('returns a structured error when record lacks $type', async () => {
      const deps = makeDeps({ store: makeStoreMock(makeSession()) });

      const result = await handleMessage(
        {
          type: 'PUT_RECORD',
          repo: 'did:plc:alice',
          collection: 'app.bsky.feed.post',
          rkey: 'abc',
          record: { text: 'no type field' },
        },
        deps,
      );

      expect(result).toEqual({ type: 'PUT_RECORD_ERROR', message: 'Invalid PUT_RECORD payload' });
    });

    it('returns a structured error when record is a non-plain object (Map)', async () => {
      const deps = makeDeps({ store: makeStoreMock(makeSession()) });
      const map = new Map([['$type', 'app.bsky.feed.post']]);

      const result = await handleMessage(
        { type: 'PUT_RECORD', repo: 'did:plc:alice', collection: 'app.bsky.feed.post', rkey: 'abc', record: map },
        deps,
      );

      expect(result).toEqual({ type: 'PUT_RECORD_ERROR', message: 'Invalid PUT_RECORD payload' });
    });

    it('returns a structured error when record is a class instance', async () => {
      class PostRecord {
        $type = 'app.bsky.feed.post';
        text = 'hello';
      }
      const deps = makeDeps({ store: makeStoreMock(makeSession()) });

      const result = await handleMessage(
        {
          type: 'PUT_RECORD',
          repo: 'did:plc:alice',
          collection: 'app.bsky.feed.post',
          rkey: 'abc',
          record: new PostRecord(),
        },
        deps,
      );

      expect(result).toEqual({ type: 'PUT_RECORD_ERROR', message: 'Invalid PUT_RECORD payload' });
    });

    it('returns a structured error when repo is missing from PUT_RECORD', async () => {
      const deps = makeDeps({ store: makeStoreMock(makeSession()) });

      const result = await handleMessage(
        {
          type: 'PUT_RECORD',
          collection: 'app.bsky.feed.post',
          rkey: 'abc',
          record: { $type: 'app.bsky.feed.post', text: 'hello' },
        },
        deps,
      );

      expect(result).toEqual({ type: 'PUT_RECORD_ERROR', message: 'Invalid PUT_RECORD payload' });
    });

    it('returns a structured error when swapRecord is not a string', async () => {
      const deps = makeDeps({ store: makeStoreMock(makeSession()) });

      const result = await handleMessage(
        {
          type: 'PUT_RECORD',
          repo: 'did:plc:alice',
          collection: 'app.bsky.feed.post',
          rkey: 'abc',
          record: { $type: 'app.bsky.feed.post', text: 'hello' },
          swapRecord: 12345,
        },
        deps,
      );

      expect(result).toEqual({ type: 'PUT_RECORD_ERROR', message: 'Invalid PUT_RECORD payload' });
    });

    it('does not log DID, URI, or CID to console.log during a successful PUT_RECORD', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const session = makeSession();
      const xrpc = makeXrpcMock();
      const deps = makeDeps({
        store: makeStoreMock(session),
        createXrpc: vi.fn().mockReturnValue(xrpc),
      });

      await handleMessage(
        {
          type: 'PUT_RECORD',
          repo: 'did:plc:alice',
          collection: 'app.bsky.feed.post',
          rkey: 'abc',
          record: { $type: 'app.bsky.feed.post', text: 'hello' },
          swapRecord: 'bafyreiabc',
        },
        deps,
      );

      const sensitiveCall = consoleSpy.mock.calls.find(args =>
        args.some(a => typeof a === 'object' && a !== null && 'did' in a),
      );
      expect(sensitiveCall).toBeUndefined();
      consoleSpy.mockRestore();
    });
  });

  describe('CREATE_RECORD', () => {
    it('returns PUT_RECORD_ERROR when payload is invalid', async () => {
      const deps = makeDeps({ store: makeStoreMock(makeSession()) });

      const result = await handleMessage(
        {
          type: 'CREATE_RECORD',
          repo: 'did:plc:alice',
          collection: 'app.bsky.feed.post',
          // record missing
        },
        deps,
      );

      expect(result).toEqual({
        type: 'PUT_RECORD_ERROR',
        message: 'Invalid CREATE_RECORD payload',
      });
    });

    it('returns PUT_RECORD_ERROR with requiresReauth when unauthenticated', async () => {
      const deps = makeDeps({ store: makeStoreMock(null) });

      const result = await handleMessage(
        {
          type: 'CREATE_RECORD',
          repo: 'did:plc:alice',
          collection: 'app.bsky.feed.post',
          record: { $type: 'app.bsky.feed.post', text: 'hello' },
        },
        deps,
      );

      expect(result).toEqual({
        type: 'PUT_RECORD_ERROR',
        message: 'Not authenticated',
        requiresReauth: true,
      });
    });

    it('calls xrpc createRecord and returns CREATE_RECORD_SUCCESS when authenticated', async () => {
      const session = makeSession();
      const xrpc = makeXrpcMock();
      const deps = makeDeps({
        store: makeStoreMock(session),
        createXrpc: vi.fn().mockReturnValue(xrpc),
      });

      const result = await handleMessage(
        {
          type: 'CREATE_RECORD',
          repo: 'did:plc:alice',
          collection: 'app.bsky.feed.post',
          record: { $type: 'app.bsky.feed.post', text: 'hello new record' },
          rkey: 'abc',
          validate: true,
        },
        deps,
      );

      expect(vi.mocked(xrpc.createRecord)).toHaveBeenCalledWith({
        repo: 'did:plc:alice',
        collection: 'app.bsky.feed.post',
        record: { $type: 'app.bsky.feed.post', text: 'hello new record' },
        rkey: 'abc',
        validate: true,
      });

      expect(result).toEqual({
        type: 'CREATE_RECORD_SUCCESS',
        uri: 'at://did:plc:testuser/app.bsky.feed.post/new',
        cid: 'bafyreinewrecord',
      });
    });
  });

  describe('GET_RECORD payload validation', () => {
    it('returns an error when repo is missing', async () => {
      const deps = makeDeps({ store: makeStoreMock(makeSession()) });

      const result = await handleMessage({ type: 'GET_RECORD', collection: 'app.bsky.feed.post', rkey: 'abc' }, deps);

      expect(result).toEqual({ error: 'Invalid GET_RECORD payload' });
    });

    it('returns an error when collection is missing', async () => {
      const deps = makeDeps({ store: makeStoreMock(makeSession()) });

      const result = await handleMessage({ type: 'GET_RECORD', repo: 'did:plc:alice', rkey: 'abc' }, deps);

      expect(result).toEqual({ error: 'Invalid GET_RECORD payload' });
    });

    it('returns an error when rkey is missing', async () => {
      const deps = makeDeps({ store: makeStoreMock(makeSession()) });

      const result = await handleMessage(
        { type: 'GET_RECORD', repo: 'did:plc:alice', collection: 'app.bsky.feed.post' },
        deps,
      );

      expect(result).toEqual({ error: 'Invalid GET_RECORD payload' });
    });

    it('returns an error when a field is not a string', async () => {
      const deps = makeDeps({ store: makeStoreMock(makeSession()) });

      const result = await handleMessage(
        { type: 'GET_RECORD', repo: 42, collection: 'app.bsky.feed.post', rkey: 'abc' },
        deps,
      );

      expect(result).toEqual({ error: 'Invalid GET_RECORD payload' });
    });
  });
});

describe('createDefaultDeps', () => {
  describe('auth state storage', () => {
    it('should store PKCE state in browser.storage.session, not storage.local', async () => {
      const deps = createDefaultDeps();

      await deps.storeAuthState('test-state', 'test-verifier');

      expect(globalThis.browser.storage.session.set).toHaveBeenCalledWith({
        pendingAuth: { state: 'test-state', codeVerifier: 'test-verifier' },
      });
      expect(globalThis.browser.storage.local.set).not.toHaveBeenCalled();
    });

    it('should read PKCE state from browser.storage.session', async () => {
      const deps = createDefaultDeps();
      vi.mocked(globalThis.browser.storage.session.get).mockResolvedValueOnce({
        pendingAuth: { state: 'stored-state', codeVerifier: 'stored-verifier' },
      });

      const result = await deps.getAuthState();

      expect(globalThis.browser.storage.session.get).toHaveBeenCalledWith('pendingAuth');
      expect(result).toEqual({ state: 'stored-state', codeVerifier: 'stored-verifier' });
    });

    it('should clear PKCE state from browser.storage.session', async () => {
      const deps = createDefaultDeps();

      await deps.clearAuthState();

      expect(globalThis.browser.storage.session.remove).toHaveBeenCalledWith('pendingAuth');
      expect(globalThis.browser.storage.local.remove).not.toHaveBeenCalled();
    });
  });

  describe('AUTH_LIST_ACCOUNTS', () => {
    it('returns empty accounts array when no sessions exist', async () => {
      const store = makeStoreMock(null);
      const deps = makeDeps({ store });

      const result = await handleMessage({ type: 'AUTH_LIST_ACCOUNTS' }, deps);

      expect(result).toEqual({ accounts: [] });
    });

    it('returns all accounts with isActive flag for active DID', async () => {
      const session1 = makeSession({ did: 'did:plc:user1', handle: 'alice.bsky.social' });
      const session2 = makeSession({ did: 'did:plc:user2' });
      const store = {
        ...makeStoreMock(),
        listAll: vi.fn().mockResolvedValue({
          accounts: [
            { did: session1.did, handle: session1.handle, expiresAt: session1.expiresAt },
            { did: session2.did, handle: session2.handle, expiresAt: session2.expiresAt },
          ],
          activeDid: 'did:plc:user1',
        }),
      };
      const deps = makeDeps({ store });

      const result = await handleMessage({ type: 'AUTH_LIST_ACCOUNTS' }, deps);

      expect(result).toEqual({
        accounts: [
          { did: 'did:plc:user1', handle: 'alice.bsky.social', expiresAt: session1.expiresAt, isActive: true },
          { did: 'did:plc:user2', handle: undefined, expiresAt: session2.expiresAt, isActive: false },
        ],
      });
    });

    it('marks no account as active when activeDid is null', async () => {
      const session = makeSession({ did: 'did:plc:user1' });
      const store = {
        ...makeStoreMock(),
        listAll: vi.fn().mockResolvedValue({
          accounts: [{ did: session.did, handle: session.handle, expiresAt: session.expiresAt }],
          activeDid: null,
        }),
      };
      const deps = makeDeps({ store });

      const result = await handleMessage({ type: 'AUTH_LIST_ACCOUNTS' }, deps);

      expect(result).toEqual({
        accounts: [{ did: 'did:plc:user1', handle: undefined, expiresAt: session.expiresAt, isActive: false }],
      });
    });
  });

  describe('AUTH_SWITCH_ACCOUNT', () => {
    it('calls setActiveDid with the given DID and returns ok', async () => {
      const session = makeSession({ did: 'did:plc:user2' });
      const store = { ...makeStoreMock(session), getByDid: vi.fn().mockResolvedValue(session) };
      const deps = makeDeps({ store });

      const result = await handleMessage({ type: 'AUTH_SWITCH_ACCOUNT', did: 'did:plc:user2' }, deps);

      expect(vi.mocked(store.setActiveDid)).toHaveBeenCalledWith('did:plc:user2');
      expect(result).toEqual({ ok: true });
    });

    it('returns error for missing DID', async () => {
      const deps = makeDeps();

      const result = await handleMessage({ type: 'AUTH_SWITCH_ACCOUNT' }, deps);

      expect(result).toEqual({ error: 'Invalid AUTH_SWITCH_ACCOUNT payload' });
    });

    it('returns error for empty DID string', async () => {
      const deps = makeDeps();

      const result = await handleMessage({ type: 'AUTH_SWITCH_ACCOUNT', did: '' }, deps);

      expect(result).toEqual({ error: 'Invalid AUTH_SWITCH_ACCOUNT payload' });
    });

    it('returns error for malformed DID', async () => {
      const deps = makeDeps();

      const result = await handleMessage({ type: 'AUTH_SWITCH_ACCOUNT', did: 'not-a-did' }, deps);

      expect(result).toEqual({ error: 'Invalid AUTH_SWITCH_ACCOUNT payload' });
    });

    it('returns error when no session exists for the given DID', async () => {
      const store = { ...makeStoreMock(), getByDid: vi.fn().mockResolvedValue(null) };
      const deps = makeDeps({ store });

      const result = await handleMessage({ type: 'AUTH_SWITCH_ACCOUNT', did: 'did:plc:nonexistent' }, deps);

      expect(vi.mocked(store.setActiveDid)).not.toHaveBeenCalled();
      expect(result).toEqual({ error: 'No session found for DID' });
    });
  });

  describe('AUTH_SIGN_OUT_ACCOUNT', () => {
    it('calls clearForDid with the given DID and returns ok', async () => {
      const store = makeStoreMock(makeSession());
      const deps = makeDeps({ store });

      const result = await handleMessage({ type: 'AUTH_SIGN_OUT_ACCOUNT', did: 'did:plc:testuser' }, deps);

      expect(vi.mocked(store.clearForDid)).toHaveBeenCalledWith('did:plc:testuser');
      expect(result).toEqual({ ok: true });
    });

    it('returns error for missing DID', async () => {
      const deps = makeDeps();

      const result = await handleMessage({ type: 'AUTH_SIGN_OUT_ACCOUNT' }, deps);

      expect(result).toEqual({ error: 'Invalid AUTH_SIGN_OUT_ACCOUNT payload' });
    });

    it('returns error for empty DID string', async () => {
      const deps = makeDeps();

      const result = await handleMessage({ type: 'AUTH_SIGN_OUT_ACCOUNT', did: '' }, deps);

      expect(result).toEqual({ error: 'Invalid AUTH_SIGN_OUT_ACCOUNT payload' });
    });

    it('returns error for malformed DID', async () => {
      const deps = makeDeps();

      const result = await handleMessage({ type: 'AUTH_SIGN_OUT_ACCOUNT', did: 'notadid' }, deps);

      expect(result).toEqual({ error: 'Invalid AUTH_SIGN_OUT_ACCOUNT payload' });
    });
  });

  describe('UPLOAD_BLOB', () => {
    it('should accept ArrayBuffer data and reconstruct Blob for upload', async () => {
      const session = makeSession();
      const deps = makeDeps({ store: makeStoreMock(session) });

      const arrayBuffer = new ArrayBuffer(16);

      const result = await handleMessage(
        {
          type: 'UPLOAD_BLOB',
          data: arrayBuffer,
          mimeType: 'image/png',
          repo: 'did:plc:testuser',
        },
        deps,
      );

      expect(result).toHaveProperty('blobRef');
      expect(result).toHaveProperty('mimeType', 'image/png');

      const xrpc = vi.mocked(deps.createXrpc).mock.results[0]!.value;
      expect(xrpc.uploadBlob).toHaveBeenCalledOnce();
      const uploadArgs = xrpc.uploadBlob.mock.calls[0]![0];
      expect(uploadArgs.data).toBeInstanceOf(Blob);
    });

    it('should reject payload without data', async () => {
      const session = makeSession();
      const deps = makeDeps({ store: makeStoreMock(session) });

      const result = await handleMessage(
        { type: 'UPLOAD_BLOB', mimeType: 'image/png', repo: 'did:plc:testuser' },
        deps,
      );

      expect(result).toEqual({ error: 'Invalid UPLOAD_BLOB payload' });
    });

    it('should reject payload without mimeType', async () => {
      const session = makeSession();
      const deps = makeDeps({ store: makeStoreMock(session) });

      const result = await handleMessage(
        { type: 'UPLOAD_BLOB', data: new ArrayBuffer(8), repo: 'did:plc:testuser' },
        deps,
      );

      expect(result).toEqual({ error: 'Invalid UPLOAD_BLOB payload' });
    });

    it('should return error when not authenticated', async () => {
      const deps = makeDeps({ store: makeStoreMock(null) });

      const result = await handleMessage(
        {
          type: 'UPLOAD_BLOB',
          data: new ArrayBuffer(8),
          mimeType: 'image/png',
          repo: 'did:plc:testuser',
        },
        deps,
      );

      expect(result).toEqual({ error: 'Not authenticated' });
    });
  });
});
