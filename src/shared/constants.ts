import browser from 'webextension-polyfill';

export const APP_NAME = 'skeeditor';
export const BSKY_APP_ORIGIN = 'https://bsky.app';
export const DEFAULT_PDS_URL = 'https://bsky.social';
export const BSKY_PDS_URL = DEFAULT_PDS_URL;
export const APP_BSKY_FEED_POST_COLLECTION = 'app.bsky.feed.post';

// Get the current PDS URL from storage or use default
export async function getCurrentPdsUrl(): Promise<string> {
  const storage = browser.storage.local ?? browser.storage.sync;
  const result = await storage.get('pdsUrl');
  return (result as { pdsUrl?: string }).pdsUrl ?? DEFAULT_PDS_URL;
}

// Set the current PDS URL
export async function setCurrentPdsUrl(url: string): Promise<void> {
  const storage = browser.storage.local ?? browser.storage.sync;
  await storage.set({ pdsUrl: url });
}

// AT Protocol OAuth endpoints (will be resolved dynamically based on current PDS URL)
export function getOAuthAuthorizeUrl(pdsUrl: string = DEFAULT_PDS_URL): string {
  return `${pdsUrl}/oauth/authorize`;
}

export function getOAuthTokenUrl(pdsUrl: string = DEFAULT_PDS_URL): string {
  return `${pdsUrl}/oauth/token`;
}
/** Minimal scope for reading and writing AT Protocol records */
export const BSKY_OAUTH_SCOPE = 'atproto transition:generic';
/**
 * OAuth client_id for skeeditor. Per the AT Protocol OAuth spec, the client_id
 * MUST be a URL pointing to a JSON client metadata document.
 */
export const BSKY_OAUTH_CLIENT_ID = 'https://skeeditor.self.agency/oauth/client-metadata.json';
/** OAuth redirect URI - must match exactly what's registered in the client metadata */
export const BSKY_OAUTH_REDIRECT_URI = 'https://skeeditor.self.agency/callback.html';
