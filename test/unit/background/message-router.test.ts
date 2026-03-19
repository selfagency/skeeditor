import { describe, it, expect, vi } from 'vitest';

import { handleMessage } from '@src/background/message-router';
import type { RouterDeps } from '@src/background/message-router';
import type { StoredSession } from '@src/shared/auth/session-store';
import type { AuthorizationRequest } from '@src/shared/auth/auth-client';
import type { GetRecordResult, PutRecordResult } from '@src/shared/api/xrpc-client';

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
});

const makeDeps = (overrides: Partial<RouterDeps> = {}): RouterDeps => ({
  store: makeStoreMock(),
  redirectUri: 'chrome-extension://abc/callback.html',
  openTab: vi.fn().mockResolvedValue(undefined),
  buildAuthReq: vi.fn().mockResolvedValue(makeAuthRequest()),
  createXrpc: vi.fn().mockReturnValue(makeXrpcMock()),
  storeAuthState: vi.fn().mockResolvedValue(undefined),
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

      expect(result).toEqual({ error: 'Not authenticated' });
    });

    it('calls xrpcClient.putRecord with the correct params when authenticated', async () => {
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

      expect(vi.mocked(xrpc.putRecord)).toHaveBeenCalledWith({
        repo: 'did:plc:alice',
        collection: 'app.bsky.feed.post',
        rkey: 'abc',
        record,
        swapRecord: 'bafyreiabc',
      });
      expect(result).toEqual({ uri: 'at://did:plc:testuser/app.bsky.feed.post/abc', cid: 'bafyreinew' });
    });
  });
});
