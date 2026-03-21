/**
 * AT Protocol app password authentication.
 *
 * App passwords are user-generated credentials that can be used instead of
 * account passwords. They're longer, can be revoked independently, and are
 * intended for "less trusted" clients.
 *
 * Per AT Protocol spec, app passwords are submitted to the PDS's login endpoint
 * and return JWT tokens (accessJwt, refreshJwt) similar to OAuth flows.
 *
 * ⚠️  SECURITY NOTE: App passwords are less secure than OAuth PKCE because:
 * - They are long-lived (no automatic expiry)
 * - No token refresh mechanism (must re-authenticate when expired)
 * - Stored directly in browser.storage.local without DPoP binding
 *
 * Prefer OAuth PKCE as the primary auth method for production use.
 */

/** App password authentication result (converts to StoredSession) */
export interface AppPasswordAuthResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  did: string;
}

/** Response from AT Protocol PDS login endpoint */
export interface LoginResponse {
  accessJwt: string;
  refreshJwt?: string;
  did: string;
  handle: string;
}

/** Error thrown when app password authentication fails */
export class AppPasswordAuthError extends Error {
  public readonly status: number | undefined;

  public constructor(message: string, status?: number) {
    super(message);
    this.name = 'AppPasswordAuthError';
    this.status = status;
  }
}

/**
 * Authenticate with an app password at the AT Protocol login endpoint.
 *
 * @param pdsUrl - The PDS base URL (e.g., https://bsky.social)
 * @param identifier - Username or DID (e.g., user.bsky.social or did:plc:...)
 * @param password - App password (not account password)
 * @returns Promise resolving to session data
 * @throws AppPasswordAuthError if authentication fails
 */
export async function authenticateWithAppPassword(
  pdsUrl: string,
  identifier: string,
  password: string,
): Promise<AppPasswordAuthResult> {
  const url = `${pdsUrl}/xrpc/com.atproto.server.createSession`;

  const body = JSON.stringify({
    identifier,
    password,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  });

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => ({}));
    const errorDescription =
      errorBody !== null &&
      typeof errorBody === 'object' &&
      'error' in errorBody &&
      typeof (errorBody as Record<string, unknown>)['error'] === 'string'
        ? (errorBody as Record<string, string>)['error']
        : undefined;

    throw new AppPasswordAuthError(errorDescription ?? `Login failed with HTTP ${response.status}`, response.status);
  }

  const data = (await response.json()) as LoginResponse;

  // Convert to StoredSession format (app passwords don't have expires_in, so we set a default)
  // Per Bluesky PDS, app password sessions typically last 30 days
  const appPasswordTokenExpiryDays = 30;
  const expiresAt = Date.now() + appPasswordTokenExpiryDays * 24 * 60 * 60 * 1000;

  return {
    accessToken: data.accessJwt,
    refreshToken: data.refreshJwt ? data.refreshJwt : undefined,
    expiresAt,
    did: data.did,
  } satisfies AppPasswordAuthResult;
}

/**
 * Verify that an app password looks valid before attempting authentication.
 *
 * App passwords are typically 8-128 character alphanumeric strings with
 * special characters. This is a basic validation, not a security measure.
 */
export function validateAppPassword(password: string): boolean {
  if (password.length < 8 || password.length > 128) {
    return false;
  }

  // Must contain at least one letter and one number
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  return hasLetter && hasNumber;
}

/**
 * Format an app password for safe display (show first 4 and last 4 chars).
 */
export function maskAppPassword(password: string): string {
  if (password.length <= 8) {
    return '•'.repeat(password.length);
  }

  return password.slice(0, 4) + '•'.repeat(password.length - 8) + password.slice(-4);
}
