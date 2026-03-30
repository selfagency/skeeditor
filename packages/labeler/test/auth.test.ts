import { describe, expect, it } from 'vitest';

import { validateEmitAuth } from '../src/auth.ts';
import type { EmitPayload } from '../src/types.ts';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal structurally-valid JWT with the given payload claims. */
function makeJwt(claims: Record<string, unknown>): string {
  const toB64Url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const header = toB64Url({ alg: 'ES256K', typ: 'JWT' });
  const body = toB64Url(claims);
  return `${header}.${body}.fakesig`;
}

const DID_PLC = 'did:plc:abc123exampleuser';
const DID_WEB = 'did:web:user.example.com';
const PDS_URL = 'https://bsky.social';
const AT_URI = `at://${DID_PLC}/app.bsky.feed.post/rkey1`;
const AT_URI_WEB = `at://${DID_WEB}/app.bsky.feed.post/rkey1`;

const VALID_PAYLOAD: EmitPayload = {
  uri: AT_URI,
  cid: 'bafyreiexamplecid',
  did: DID_PLC,
};

/** DID document stub for did:plc, with #atproto_pds service. */
const PLC_DID_DOC = {
  id: DID_PLC,
  service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS_URL }],
};

/** DID document stub for did:web. */
const WEB_DID_DOC = {
  id: DID_WEB,
  service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS_URL }],
};

/** Session response returned by the PDS for a valid token. */
const SESSION_OK = { did: DID_PLC, handle: 'user.bsky.social', email: 'user@example.com' };

/**
 * Build a mock fetch function that intercepts:
 *   - plc.directory    → DID document resolution for did:plc
 *   - did:web domain   → DID document resolution for did:web
 *   - PDS getSession   → controlled by `sessionStatus`
 */
function makeFetch({
  sessionStatus = 200,
  didDoc = PLC_DID_DOC as unknown,
}: {
  sessionStatus?: number;
  didDoc?: unknown;
} = {}): typeof fetch {
  return async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (url.startsWith('https://plc.directory/')) {
      return new Response(JSON.stringify(didDoc), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.endsWith('/.well-known/did.json')) {
      return new Response(JSON.stringify(didDoc), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.endsWith('/xrpc/com.atproto.server.getSession')) {
      const body = sessionStatus === 200 ? SESSION_OK : { error: 'InvalidToken', message: 'Token is invalid' };
      return new Response(JSON.stringify(body), {
        status: sessionStatus,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('validateEmitAuth', () => {
  // ── Valid token ─────────────────────────────────────────────────────────

  it('accepts a valid token whose signature is confirmed by the PDS (did:plc)', async () => {
    const jwt = makeJwt({ sub: DID_PLC, iat: 1_000_000, exp: 9_999_999 });
    const result = await validateEmitAuth(`Bearer ${jwt}`, VALID_PAYLOAD, makeFetch({ sessionStatus: 200 }));
    expect(result).toEqual({ valid: true });
  });

  it('accepts a valid token for a did:web subject', async () => {
    const jwt = makeJwt({ sub: DID_WEB, iat: 1_000_000, exp: 9_999_999 });
    const payload: EmitPayload = { uri: AT_URI_WEB, cid: 'bafyreiexamplecid', did: DID_WEB };
    const result = await validateEmitAuth(
      `Bearer ${jwt}`,
      payload,
      makeFetch({ sessionStatus: 200, didDoc: WEB_DID_DOC }),
    );
    expect(result).toEqual({ valid: true });
  });

  // ── Invalid signature (rejected by issuer) ──────────────────────────────

  it('rejects a token whose signature is rejected by the PDS', async () => {
    const jwt = makeJwt({ sub: DID_PLC, iat: 1_000_000, exp: 9_999_999 });
    const result = await validateEmitAuth(`Bearer ${jwt}`, VALID_PAYLOAD, makeFetch({ sessionStatus: 401 }));
    expect(result).toEqual({ valid: false, reason: 'Token rejected by issuer' });
  });

  it('rejects a forged token (PDS returns 400)', async () => {
    const jwt = makeJwt({ sub: DID_PLC });
    const result = await validateEmitAuth(`Bearer ${jwt}`, VALID_PAYLOAD, makeFetch({ sessionStatus: 400 }));
    expect(result).toEqual({ valid: false, reason: 'Token rejected by issuer' });
  });

  // ── DID mismatch ────────────────────────────────────────────────────────

  it('rejects when JWT sub does not match payload did', async () => {
    const otherDid = 'did:plc:zzzdifferentdid';
    const jwt = makeJwt({ sub: otherDid });
    const result = await validateEmitAuth(`Bearer ${jwt}`, VALID_PAYLOAD, makeFetch());
    expect(result).toEqual({ valid: false, reason: 'JWT sub does not match payload did' });
  });

  // ── Ownership mismatch ──────────────────────────────────────────────────

  it('rejects when AT URI repo does not match the authenticated DID', async () => {
    const jwt = makeJwt({ sub: DID_PLC });
    const payload: EmitPayload = {
      uri: 'at://did:plc:zzzdifferentdid/app.bsky.feed.post/rkey1',
      cid: 'bafyreiexamplecid',
      did: DID_PLC,
    };
    const result = await validateEmitAuth(`Bearer ${jwt}`, payload, makeFetch());
    expect(result).toEqual({ valid: false, reason: 'Authenticated DID does not own the AT URI repo' });
  });

  it('rejects when payload did matches JWT sub but AT URI repo is a different DID', async () => {
    const attackerDid = 'did:plc:attackerdid0000000000';
    const jwt = makeJwt({ sub: attackerDid });
    const payload: EmitPayload = {
      uri: `at://${DID_PLC}/app.bsky.feed.post/rkey1`,
      cid: 'bafyreiexamplecid',
      did: attackerDid,
    };
    const result = await validateEmitAuth(`Bearer ${jwt}`, payload, makeFetch());
    expect(result).toEqual({ valid: false, reason: 'Authenticated DID does not own the AT URI repo' });
  });

  // ── Malformed JWT ───────────────────────────────────────────────────────

  it('rejects when Authorization header is missing', async () => {
    const result = await validateEmitAuth(null, VALID_PAYLOAD, makeFetch());
    expect(result).toEqual({ valid: false, reason: 'Missing Authorization header' });
  });

  it('rejects when Authorization header is not Bearer scheme', async () => {
    const result = await validateEmitAuth('Basic dXNlcjpwYXNz', VALID_PAYLOAD, makeFetch());
    expect(result).toEqual({ valid: false, reason: 'Authorization header must be: Bearer <token>' });
  });

  it('rejects a JWT with only two segments', async () => {
    const result = await validateEmitAuth('Bearer header.payload', VALID_PAYLOAD, makeFetch());
    expect(result).toEqual({ valid: false, reason: 'Malformed JWT' });
  });

  it('rejects a JWT whose payload segment is not valid base64url JSON', async () => {
    const result = await validateEmitAuth('Bearer head.!!!notbase64!!!.sig', VALID_PAYLOAD, makeFetch());
    expect(result).toEqual({ valid: false, reason: 'Failed to decode JWT payload' });
  });

  it('rejects a JWT whose decoded payload has no sub claim', async () => {
    const jwt = makeJwt({ iat: 1_000_000 }); // no sub
    const result = await validateEmitAuth(`Bearer ${jwt}`, VALID_PAYLOAD, makeFetch());
    expect(result).toEqual({ valid: false, reason: 'JWT missing sub claim' });
  });

  // ── PDS resolution failure ──────────────────────────────────────────────

  it('rejects when the DID document cannot be fetched', async () => {
    const jwt = makeJwt({ sub: DID_PLC });
    const fetchFn: typeof fetch = async () => new Response('Not found', { status: 404 });
    const result = await validateEmitAuth(`Bearer ${jwt}`, VALID_PAYLOAD, fetchFn);
    expect(result).toEqual({ valid: false, reason: 'Could not resolve PDS endpoint for DID' });
  });

  it('rejects when the DID document has no #atproto_pds service', async () => {
    const jwt = makeJwt({ sub: DID_PLC });
    const noServiceDoc = { id: DID_PLC, service: [] };
    const result = await validateEmitAuth(`Bearer ${jwt}`, VALID_PAYLOAD, makeFetch({ didDoc: noServiceDoc }));
    expect(result).toEqual({ valid: false, reason: 'Could not resolve PDS endpoint for DID' });
  });

  it('rejects when the DID method is unsupported', async () => {
    const keyDid = 'did:key:z6Mkexamplekey';
    const jwt = makeJwt({ sub: keyDid });
    const payload: EmitPayload = { uri: `at://${keyDid}/app.bsky.feed.post/rkey1`, cid: 'cid', did: keyDid };
    const result = await validateEmitAuth(`Bearer ${jwt}`, payload, makeFetch());
    expect(result).toEqual({ valid: false, reason: 'Could not resolve PDS endpoint for DID' });
  });
});
