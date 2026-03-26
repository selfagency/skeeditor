/**
 * Integration tests for the message router with real XrpcClient + MSW HTTP mocks.
 *
 * Unlike the unit tests (which mock `createXrpc` entirely), these tests wire a
 * real `XrpcClient` so the full path from message → router → HTTP is exercised.
 * MSW intercepts the outgoing XRPC requests and returns controlled responses.
 */
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { handleMessage, type RouterDeps } from '@src/background/message-router';
import { XrpcClient } from '@src/shared/api/xrpc-client';
import { BSKY_PDS_URL } from '@src/shared/constants';
import { server } from '../../mocks/server';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEST_DID = 'did:plc:integration-test';
const TEST_COLLECTION = 'app.bsky.feed.post';
const TEST_RKEY = '3kintegration';
const TEST_AT_URI = `at://${TEST_DID}/${TEST_COLLECTION}/${TEST_RKEY}`;
// Valid CIDs (base32 multihash format expected by @atproto/lex)
const TEST_CID = 'bafyreie5737gdxxxlu5vc6bqczpwjrkbz3iezahmcvtjpggsomvzsjj7gu';
const TEST_CID_NEW = 'bafyreihxzei3be2njobnpxrompe5w3dp5jrrpxhklvs7fxhkpqynxm7b5q';
const TEST_CID_CURRENT = 'bafyreid7xrpvejbafyxtzngm5swldww6fj3sgnmlb7xbnrj3rhf6ky5dhy';
const TEST_RECORD = {
  $type: 'app.bsky.feed.post',
  text: 'Integration test post',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const makeSession = () => ({
  did: TEST_DID,
  accessToken: 'integration-test-jwt',
  refreshToken: 'integration-test-refresh',
  expiresAt: Date.now() + 60_000,
  scope: 'atproto transition:generic',
});

/**
 * Build RouterDeps that uses a *real* XrpcClient for XRPC calls.
 * Only the session store and auth-flow side-effects are stubbed.
 */
const makeRealDeps = (session: ReturnType<typeof makeSession> | null = makeSession()): RouterDeps => ({
  store: {
    get: vi.fn().mockResolvedValue(session),
    set: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    isAccessTokenValid: vi.fn().mockResolvedValue(session !== null),
  },
  redirectUri: 'chrome-extension://test/callback.html',
  openTab: vi.fn().mockResolvedValue(undefined),
  buildAuthReq: vi.fn().mockResolvedValue({
    url: 'https://bsky.social/oauth/authorize',
    state: 'test-state',
    codeVerifier: 'test-verifier',
  }),
  createXrpc: config => new XrpcClient(config),
  storeAuthState: vi.fn().mockResolvedValue(undefined),
  getAuthState: vi.fn().mockResolvedValue(null),
  clearAuthState: vi.fn().mockResolvedValue(undefined),
  exchangeCode: vi.fn().mockResolvedValue({
    access_token: 'test-access-token',
    token_type: 'Bearer',
    refresh_token: 'test-refresh-token',
    sub: 'did:plc:testuser',
  }),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('message router integration: GET_RECORD', () => {
  it('returns the record value and CID when the PDS responds 200', async () => {
    server.use(
      http.get(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.getRecord`, () =>
        HttpResponse.json({ uri: TEST_AT_URI, cid: TEST_CID, value: TEST_RECORD }),
      ),
    );

    const result = await handleMessage(
      { type: 'GET_RECORD', repo: TEST_DID, collection: TEST_COLLECTION, rkey: TEST_RKEY },
      makeRealDeps(),
    );

    expect(result).toEqual({ cid: TEST_CID, value: TEST_RECORD });
  });

  it('returns an error object when the PDS returns 404', async () => {
    server.use(
      http.get(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.getRecord`, () =>
        HttpResponse.json({ error: 'RecordNotFound', message: 'Record not found' }, { status: 404 }),
      ),
    );

    const result = await handleMessage(
      { type: 'GET_RECORD', repo: TEST_DID, collection: TEST_COLLECTION, rkey: 'missing' },
      makeRealDeps(),
    );

    expect(result).toEqual({ error: 'Failed to fetch record' });
  });

  it('returns Not authenticated when no session exists', async () => {
    const result = await handleMessage(
      { type: 'GET_RECORD', repo: TEST_DID, collection: TEST_COLLECTION, rkey: TEST_RKEY },
      makeRealDeps(null),
    );

    expect(result).toEqual({ error: 'Not authenticated' });
  });
});

describe('message router integration: PUT_RECORD', () => {
  it('returns PUT_RECORD_SUCCESS when the PDS accepts the write', async () => {
    server.use(
      http.post(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.putRecord`, () =>
        HttpResponse.json({ uri: TEST_AT_URI, cid: TEST_CID_NEW }),
      ),
    );

    const result = await handleMessage(
      {
        type: 'PUT_RECORD',
        repo: TEST_DID,
        collection: TEST_COLLECTION,
        rkey: TEST_RKEY,
        record: { ...TEST_RECORD, text: 'Edited text' },
        swapRecord: TEST_CID,
      },
      makeRealDeps(),
    );

    expect(result).toEqual({ type: 'PUT_RECORD_SUCCESS', uri: TEST_AT_URI, cid: TEST_CID_NEW });
  });

  it('returns PUT_RECORD_CONFLICT with current record details on HTTP 409', async () => {
    const currentValue = { ...TEST_RECORD, text: 'Server version' };

    // First call: putRecord → 409 conflict
    // Second call: getRecord → current server state (XrpcClient fetches it internally)
    server.use(
      http.post(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.putRecord`, () =>
        HttpResponse.json({ error: 'InvalidSwap', message: 'CID mismatch' }, { status: 409 }),
      ),
      http.get(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.getRecord`, () =>
        HttpResponse.json({ uri: TEST_AT_URI, cid: TEST_CID_CURRENT, value: currentValue }),
      ),
    );

    const result = await handleMessage(
      {
        type: 'PUT_RECORD',
        repo: TEST_DID,
        collection: TEST_COLLECTION,
        rkey: TEST_RKEY,
        record: { ...TEST_RECORD, text: 'My edit' },
        swapRecord: 'bafyreistale000000000000000000000000000000000000000000000000',
      },
      makeRealDeps(),
    );

    expect(result).toMatchObject({
      type: 'PUT_RECORD_CONFLICT',
      error: expect.objectContaining({ kind: 'conflict' }),
      conflict: { currentCid: TEST_CID_CURRENT, currentValue },
    });
  });

  it('returns PUT_RECORD_CONFLICT without conflict details when getRecord also fails', async () => {
    server.use(
      http.post(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.putRecord`, () =>
        HttpResponse.json({ error: 'InvalidSwap', message: 'CID mismatch' }, { status: 409 }),
      ),
      http.get(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.getRecord`, () =>
        HttpResponse.json({ error: 'RecordNotFound', message: 'Not found' }, { status: 404 }),
      ),
    );

    const result = await handleMessage(
      {
        type: 'PUT_RECORD',
        repo: TEST_DID,
        collection: TEST_COLLECTION,
        rkey: TEST_RKEY,
        record: { ...TEST_RECORD, text: 'My edit' },
        swapRecord: 'bafyreistale000000000000000000000000000000000000000000000000',
      },
      makeRealDeps(),
    );

    expect(result).toMatchObject({
      type: 'PUT_RECORD_CONFLICT',
      error: expect.objectContaining({ kind: 'conflict' }),
    });
    // conflict details should be absent (getRecord failed)
    expect((result as { conflict?: unknown }).conflict).toBeUndefined();
  });

  it('returns PUT_RECORD_ERROR on server 500', async () => {
    server.use(
      http.post(`${BSKY_PDS_URL}/xrpc/com.atproto.repo.putRecord`, () =>
        HttpResponse.json({ error: 'InternalServerError', message: 'Server error' }, { status: 500 }),
      ),
    );

    const result = await handleMessage(
      {
        type: 'PUT_RECORD',
        repo: TEST_DID,
        collection: TEST_COLLECTION,
        rkey: TEST_RKEY,
        record: { ...TEST_RECORD, text: 'Edited' },
        swapRecord: TEST_CID,
      },
      makeRealDeps(),
    );

    expect(result).toMatchObject({ type: 'PUT_RECORD_ERROR', message: expect.any(String) });
  });

  it('returns PUT_RECORD_ERROR when not authenticated', async () => {
    const result = await handleMessage(
      {
        type: 'PUT_RECORD',
        repo: TEST_DID,
        collection: TEST_COLLECTION,
        rkey: TEST_RKEY,
        record: TEST_RECORD,
        swapRecord: TEST_CID,
      },
      makeRealDeps(null),
    );

    expect(result).toEqual({ type: 'PUT_RECORD_ERROR', message: 'Not authenticated' });
  });
});
