import { AuthClientError } from './auth-client';
import type { TokenResponse } from './types';
import type { sessionStore as SessionStore, StoredSession } from './session-store';

export type { TokenResponse };

export interface TokenRefreshManagerConfig {
  tokenEndpoint: string;
  clientId: string;
}

/** Minimal session store interface required by the refresh manager — allows injection in tests */
export interface SessionStoreInterface {
  get: () => Promise<StoredSession | null>;
  set: (session: StoredSession) => Promise<void>;
  clear: () => Promise<void>;
  isAccessTokenValid: () => Promise<boolean>;
}

/** Injected refresh function type — matches the `refreshAccessToken` signature */
export type RefreshFn = (tokenEndpoint: string, refreshToken: string, clientId: string) => Promise<TokenResponse>;

/**
 * Call the token endpoint with `grant_type=refresh_token` to obtain new tokens.
 *
 * Throws `AuthClientError` if the server returns an HTTP error response.
 * Must be called from the background service worker only.
 */
export async function refreshAccessToken(
  tokenEndpoint: string,
  refreshToken: string,
  clientId: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
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
      errorDescription ?? `Token refresh failed with HTTP ${response.status}`,
      'refresh_failed',
      response.status,
    );
  }

  return response.json() as Promise<TokenResponse>;
}

/**
 * Manages token refresh lifecycle: de-duplicates in-flight refresh requests,
 * merges new token data with the existing session, and persists the result.
 *
 * Designed to run in the background service worker. Pass `refreshAccessToken`
 * and `sessionStore` as dependencies (or inject mocks in tests).
 */
export class TokenRefreshManager {
  private readonly config: TokenRefreshManagerConfig;
  private inflightRefresh: Promise<StoredSession> | null = null;

  constructor(config: TokenRefreshManagerConfig) {
    this.config = config;
  }

  /**
   * Refresh the access token for the given session, persist to storage, and
   * return the updated session.
   *
   * If a refresh is already in progress, the caller waits for the same promise
   * rather than issuing a duplicate network request.
   */
  async refreshAndStore(
    current: StoredSession,
    refresh: RefreshFn = refreshAccessToken,
    store: SessionStoreInterface = globalThis.__sessionStore as SessionStoreInterface,
  ): Promise<StoredSession> {
    if (this.inflightRefresh !== null) {
      return this.inflightRefresh;
    }

    this.inflightRefresh = this.doRefresh(current, refresh, store).finally(() => {
      this.inflightRefresh = null;
    });

    return this.inflightRefresh;
  }

  private async doRefresh(
    current: StoredSession,
    refresh: RefreshFn,
    store: SessionStoreInterface,
  ): Promise<StoredSession> {
    const tokens = await refresh(this.config.tokenEndpoint, current.refreshToken, this.config.clientId);

    const updated: StoredSession = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? current.refreshToken,
      expiresAt: tokens.expires_in !== undefined ? Date.now() + tokens.expires_in * 1000 : current.expiresAt,
      scope: tokens.scope ?? current.scope,
      did: tokens.sub ?? current.did,
    };

    await store.set(updated);
    return updated;
  }
}

// Allow background script to inject the real sessionStore at module init
declare global {
  var __sessionStore: typeof SessionStore | undefined;
}
