import type { EmitPayload } from './types.ts';

/**
 * Resolves a DID to its PDS (Personal Data Server) endpoint URL by fetching
 * the DID document and locating the `#atproto_pds` service entry.
 *
 * Supports:
 * - `did:plc`  → https://plc.directory/{did}
 * - `did:web`  → https://{domain}/.well-known/did.json
 */
async function resolvePdsEndpoint(did: string, fetchFn: typeof fetch): Promise<string | null> {
  let didDocUrl: string;

  if (did.startsWith('did:plc:')) {
    didDocUrl = `https://plc.directory/${did}`;
  } else if (did.startsWith('did:web:')) {
    const domain = did.slice('did:web:'.length);
    didDocUrl = `https://${domain}/.well-known/did.json`;
  } else {
    return null;
  }

  let didDoc: unknown;
  try {
    const resp = await fetchFn(didDocUrl);
    if (!resp.ok) return null;
    didDoc = await resp.json();
  } catch {
    return null;
  }

  if (typeof didDoc !== 'object' || didDoc === null) return null;

  const services = (didDoc as Record<string, unknown>)['service'];
  if (!Array.isArray(services)) return null;

  for (const svc of services) {
    if (
      typeof svc === 'object' &&
      svc !== null &&
      (svc as Record<string, unknown>)['id'] === '#atproto_pds' &&
      typeof (svc as Record<string, unknown>)['serviceEndpoint'] === 'string'
    ) {
      return (svc as Record<string, unknown>)['serviceEndpoint'] as string;
    }
  }

  return null;
}

/**
 * Validates the Authorization header on /emit requests.
 *
 * Checks that:
 * 1. The header is a valid Bearer token (ATProto access JWT).
 * 2. The JWT `sub` claim matches the `did` field in the emit payload.
 * 3. The authenticated DID owns the AT URI repo.
 * 4. The token is cryptographically valid — verified by calling
 *    `com.atproto.server.getSession` against the subject's PDS. A forged or
 *    tampered token will be rejected by the PDS with a 4xx response.
 */
export async function validateEmitAuth(
  authHeader: string | null,
  payload: EmitPayload,
  fetchFn: typeof fetch = fetch,
  dpopHeader: string | null = null,
): Promise<{ valid: true } | { valid: false; reason: string }> {
  if (authHeader === null) {
    return { valid: false, reason: 'Missing Authorization header' };
  }

  const parts = authHeader.split(' ');
  const scheme = parts[0]?.toLowerCase();
  if (parts.length !== 2 || (scheme !== 'bearer' && scheme !== 'dpop') || !parts[1]) {
    return { valid: false, reason: 'Authorization header must be: Bearer <token> or DPoP <token>' };
  }

  const token = parts[1];

  if (scheme === 'dpop' && (typeof dpopHeader !== 'string' || dpopHeader.length === 0)) {
    return { valid: false, reason: 'Missing DPoP header for DPoP Authorization' };
  }

  // JWT structure: base64url(header).base64url(payload).signature
  const segments = token.split('.');
  if (segments.length !== 3) {
    return { valid: false, reason: 'Malformed JWT' };
  }

  let jwtPayload: Record<string, unknown>;
  try {
    const raw = segments[1];
    if (!raw) return { valid: false, reason: 'Malformed JWT payload segment' };
    // base64url → base64 → decode
    const padded = raw
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(raw.length / 4) * 4, '=');
    jwtPayload = JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return { valid: false, reason: 'Failed to decode JWT payload' };
  }

  const sub = jwtPayload['sub'];
  if (typeof sub !== 'string') {
    return { valid: false, reason: 'JWT missing sub claim' };
  }

  // The AT URI repo segment must match the authenticating DID
  const atUri = payload.uri;
  const uriMatch = /^at:\/\/([^/]+)\//.exec(atUri);
  const repoDid = uriMatch?.[1];

  if (!repoDid) {
    return { valid: false, reason: 'Invalid AT URI in emit payload' };
  }

  if (sub !== payload.did) {
    return { valid: false, reason: 'JWT sub does not match payload did' };
  }

  if (sub !== repoDid) {
    return { valid: false, reason: 'Authenticated DID does not own the AT URI repo' };
  }

  // Cryptographic verification: resolve the subject DID to its PDS endpoint
  // and call com.atproto.server.getSession. The PDS will reject any token
  // whose signature does not verify against its own signing key.
  const pdsEndpoint = await resolvePdsEndpoint(sub, fetchFn);
  if (pdsEndpoint === null) {
    return { valid: false, reason: 'Could not resolve PDS endpoint for DID' };
  }

  try {
    const headers: Record<string, string> = { Authorization: authHeader };
    if (scheme === 'dpop' && typeof dpopHeader === 'string' && dpopHeader.length > 0) {
      headers['DPoP'] = dpopHeader;
    }

    const sessionResp = await fetchFn(`${pdsEndpoint}/xrpc/com.atproto.server.getSession`, {
      headers,
    });

    if (!sessionResp.ok) {
      return { valid: false, reason: 'Token rejected by issuer' };
    }

    const sessionBody = (await sessionResp.json()) as { did?: unknown };
    if (typeof sessionBody.did !== 'string' || sessionBody.did !== sub) {
      return { valid: false, reason: 'Session subject does not match JWT sub' };
    }
  } catch {
    return { valid: false, reason: 'Failed to verify token with PDS' };
  }

  return { valid: true };
}
