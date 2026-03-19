/**
 * Encode a byte array as a base64url string (no padding, URL-safe alphabet).
 */
function base64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generate a cryptographically random PKCE code verifier.
 *
 * Produces a base64url-encoded string of 32 random bytes (43 characters),
 * satisfying RFC 7636 §4.1 constraints.
 */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

/**
 * Derive the PKCE code challenge from a code verifier using SHA-256 (S256 method).
 *
 * Returns `BASE64URL(SHA256(ASCII(code_verifier)))` as defined in RFC 7636 §4.2.
 */
export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(new Uint8Array(hashBuffer));
}

/**
 * Generate a cryptographically random state value for CSRF protection.
 *
 * Returns a base64url-encoded string of 16 random bytes.
 */
export function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}
