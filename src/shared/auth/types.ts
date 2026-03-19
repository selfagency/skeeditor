export interface OAuthClientParams {
  /** HTTPS URL of the client metadata document (used as client_id per AT Protocol OAuth spec) */
  clientId: string;
  /** Extension-packaged callback page URL (e.g. from browser.runtime.getURL('callback.html')) */
  redirectUri: string;
  /** OAuth scope string (e.g. 'atproto transition:generic') */
  scope: string;
  /** Authorization server's authorize endpoint URL */
  authorizationEndpoint: string;
}

export interface AuthorizationRequest {
  /** Full authorization URL to open in the browser */
  url: string;
  /** Random state value for CSRF protection; must be stored and verified in the callback */
  state: string;
  /** PKCE code verifier; must be stored and sent in the token exchange */
  codeVerifier: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  /** DID of the authenticated user, returned by AT Protocol PDS */
  sub?: string;
}

export interface CallbackSuccess {
  code: string;
  state: string;
}

export interface CallbackError {
  error: string;
  errorDescription?: string;
}

export type CallbackParams = CallbackSuccess | CallbackError;
