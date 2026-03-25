import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { RouterDeps } from '@src/background/message-router';
import { createDefaultDeps, handleMessage } from '@src/background/message-router';
import type { GetRecordResult, PutRecordResult, PutRecordWithSwapResult } from '@src/shared/api/xrpc-client';
import type { AuthorizationRequest } from '@src/shared/auth/auth-client';
import type { StoredSession } from '@src/shared/auth/session-store';

vi.mock('@src/shared/auth/auth-client', () => ({
  buildAuthorizationRequest: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
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
  set: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
  isAccessTokenValid: vi.fn().mockResolvedValue(session !== null),
});

const makeXrpcMock = () => ({
  getRecord: vi.fn<() => Promise<GetRecordResult>>().mockResolvedValue({
    value: { $type: 'app.bsky.feed.post', text: 'hello' },
    cid: 'bafyreiabc',
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
  ...overrides,
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
    it('returns authenticated status with DID when valid session exists', async () => {
      const session = makeSession();
      const deps = makeDeps({ store: makeStoreMock(session) });

      const result = await handleMessage({ type: 'AUTH_GET_STATUS' }, deps);

      expect(result).toEqual({
        authenticated: true,
        did: session.did,
        expiresAt: session.expiresAt,
      });
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
      expect(vi.mocked(deps.storeAuthState)).toHaveBeenCalledWith(authRequest.state, authRequest.codeVerifier);
      expect(vi.mocked(deps.openTab)).toHaveBeenCalledWith(authRequest.url);
      expect(result).toEqual({ ok: true });
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
      });
      expect(vi.mocked(deps.clearAuthState)).toHaveBeenCalledOnce();
      expect(result).toEqual({ ok: true });
    });

    it('clears pending state even on token exchange failure', async () => {
      const deps = makeDeps({
        getAuthState: vi.fn().mockResolvedValue({ state: 'matching-state', codeVerifier: 'verifier' }),
        exchangeCode: vi.fn().mockRejectedValue(new Error('Token exchange failed')),
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

    it('returns an error object when getRecord throws', async () => {
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

      expect(result).toEqual({ type: 'PUT_RECORD_ERROR', message: 'network failure' });
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

      expect(result).toEqual({ type: 'PUT_RECORD_ERROR', message: 'Unauthorized' });
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
});
