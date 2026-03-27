import type { EmitPayload } from './types.ts';

/**
 * Validates the Authorization header on /emit requests.
 *
 * Checks that:
 * 1. The header is a valid Bearer token (ATProto access JWT).
 * 2. The JWT `sub` claim matches the `did` field in the emit payload.
 *
 * We do NOT cryptographically verify the JWT signature here — the JWT is a
 * bearer credential issued by the PDS, and we trust it as a DID consistency
 * check only. Full DID-doc-based verification is a Phase 2 concern.
 */
export function validateEmitAuth(
  authHeader: string | null,
  payload: EmitPayload,
): { valid: true } | { valid: false; reason: string } {
  if (authHeader === null) {
    return { valid: false, reason: 'Missing Authorization header' };
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer' || !parts[1]) {
    return { valid: false, reason: 'Authorization header must be: Bearer <token>' };
  }

  const token = parts[1];

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

  return { valid: true };
}
