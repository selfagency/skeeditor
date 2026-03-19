import { sendMessage } from '../shared/messages';
import type { AuthGetStatusResponse } from '../shared/messages';

export interface AuthStatus {
  authenticated: boolean;
  did?: string;
}

let cachedStatus: AuthStatus = { authenticated: false };

/**
 * Fetch current auth status from the background service worker and update the
 * local cache. Safe to call multiple times — errors are caught and treated as
 * unauthenticated so content-script logic can degrade gracefully.
 */
export async function fetchAuthStatus(): Promise<AuthStatus> {
  let response: AuthGetStatusResponse;

  try {
    response = await sendMessage({ type: 'AUTH_GET_STATUS' });
  } catch {
    cachedStatus = { authenticated: false };
    return cachedStatus;
  }

  if (response.authenticated) {
    cachedStatus = { authenticated: true, did: response.did };
  } else {
    cachedStatus = { authenticated: false };
  }

  return cachedStatus;
}

/**
 * Return the last cached auth status without performing a round-trip.
 * Defaults to `{ authenticated: false }` until `fetchAuthStatus` has resolved.
 */
export function getAuthStatus(): AuthStatus {
  return cachedStatus;
}
