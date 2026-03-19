import { deriveCodeChallenge, generateCodeVerifier, generateState } from './pkce';
import type { AuthorizationRequest, CallbackParams, OAuthClientParams, TokenResponse } from './types';

export type { AuthorizationRequest, CallbackParams, OAuthClientParams, TokenResponse };

export class AuthClientError extends Error {
  public readonly kind: string;
  public readonly status: number | undefined;

  public constructor(message: string, kind: string, status?: number) {
    super(message);
    this.name = 'AuthClientError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * Build a PKCE authorization request URL.
 *
 * Returns the full authorization URL to open in the browser along with the
 * `state` and `codeVerifier` that must be persisted (e.g. in session storage)
 * before the redirect so they can be verified in the callback.
 *
 * This must be called from the background service worker, not from a content
 * script, since content scripts must not store sensitive auth material.
 */
export async function buildAuthorizationRequest(params: OAuthClientParams): Promise<AuthorizationRequest> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await deriveCodeChallenge(codeVerifier);
  const state = generateState();

  const searchParams = new URLSearchParams({
    response_type: 'code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: params.scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return {
    url: `${params.authorizationEndpoint}?${searchParams.toString()}`,
    state,
    codeVerifier,
  };
}

/**
 * Exchange an authorization code for tokens at the token endpoint.
 *
 * This must be called from the background service worker. Content scripts must
 * send a message to the background and never call this directly, to prevent
 * exposing auth credentials to the page context.
 */
export async function exchangeCodeForTokens(
  tokenEndpoint: string,
  code: string,
  codeVerifier: string,
  clientId: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    client_id: clientId,
    redirect_uri: redirectUri,
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => ({}));
    const errorDescription =
      errorBody !== null &&
      typeof errorBody === 'object' &&
      'error_description' in errorBody &&
      typeof (errorBody as Record<string, unknown>)['error_description'] === 'string'
        ? (errorBody as Record<string, string>)['error_description']
        : undefined;
    throw new AuthClientError(
      errorDescription ?? `Token request failed with HTTP ${response.status}`,
      'token_request_failed',
      response.status,
    );
  }

  return response.json() as Promise<TokenResponse>;
}

/**
 * Parse the callback URL received after an OAuth authorization redirect.
 *
 * Returns `{ code, state }` on success or `{ error, errorDescription }` on failure.
 * Always verify that the returned `state` matches the value stored before the redirect.
 */
export function parseCallbackParams(url: string): CallbackParams {
  const parsed = new URL(url);
  const error = parsed.searchParams.get('error');

  if (error !== null) {
    const errorDescription = parsed.searchParams.get('error_description');
    return errorDescription !== null ? { error, errorDescription } : { error };
  }

  const code = parsed.searchParams.get('code');
  const state = parsed.searchParams.get('state');

  if (code === null || state === null) {
    return { error: 'missing_params', errorDescription: 'Callback URL is missing required code or state parameters.' };
  }

  return { code, state };
}
