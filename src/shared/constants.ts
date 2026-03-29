import { browser } from 'wxt/browser';

export const APP_NAME = 'skeeditor';
export const BSKY_APP_ORIGIN = 'https://bsky.app';
export const DEFAULT_PDS_URL = 'https://bsky.social';
export const BSKY_PDS_URL = DEFAULT_PDS_URL;
export const APP_BSKY_FEED_POST_COLLECTION = 'app.bsky.feed.post';

export interface ExtensionSettings {
  editTimeLimit: number | null;
}

const DEFAULT_SETTINGS: ExtensionSettings = {
  editTimeLimit: null,
};

const getStorage = (): typeof browser.storage.local => {
  return browser.storage.local ?? browser.storage.sync;
};

export const EDIT_TIME_LIMIT_MIN = 0.5;
export const EDIT_TIME_LIMIT_MAX = 5;

export const isValidEditTimeLimit = (value: unknown): value is number | null => {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= EDIT_TIME_LIMIT_MIN &&
      value <= EDIT_TIME_LIMIT_MAX)
  );
};

const isExtensionSettings = (value: unknown): value is ExtensionSettings => {
  return (
    value !== null &&
    typeof value === 'object' &&
    'editTimeLimit' in value &&
    isValidEditTimeLimit((value as Record<string, unknown>)['editTimeLimit'])
  );
};

// Get the current PDS URL from storage or use default.
// When `did` is provided, returns the URL stored for that specific DID.
// When omitted, reads the active DID from storage and returns its URL,
// falling back to the legacy `pdsUrl` key and finally the default.
export async function getCurrentPdsUrl(did?: string): Promise<string> {
  const storage = getStorage();

  if (did !== undefined) {
    const result = await storage.get('pdsUrls');
    const stored = (result as Record<string, unknown>)['pdsUrls'];
    const pdsUrls: Record<string, string> =
      stored !== null && typeof stored === 'object' && !Array.isArray(stored) ? (stored as Record<string, string>) : {};
    const url = pdsUrls[did];
    return typeof url === 'string' && url.length > 0 ? url : DEFAULT_PDS_URL;
  }

  const result = await storage.get(['pdsUrls', 'pdsUrl', 'activeDid']);
  const activeDid = (result as Record<string, unknown>)['activeDid'];
  const storedPdsUrls = (result as Record<string, unknown>)['pdsUrls'];
  const pdsUrls: Record<string, string> =
    storedPdsUrls !== null && typeof storedPdsUrls === 'object' && !Array.isArray(storedPdsUrls)
      ? (storedPdsUrls as Record<string, string>)
      : {};

  if (typeof activeDid === 'string' && activeDid.length > 0 && pdsUrls[activeDid]) {
    return pdsUrls[activeDid];
  }

  // Fall back to legacy global pdsUrl key (pre-auth or pre-migration)
  const legacyUrl = (result as Record<string, unknown>)['pdsUrl'];
  return typeof legacyUrl === 'string' && legacyUrl.length > 0 ? legacyUrl : DEFAULT_PDS_URL;
}

// Store the PDS URL for a specific DID in the `pdsUrls` map.
export async function setCurrentPdsUrl(did: string, url: string): Promise<void> {
  const storage = getStorage();
  const result = await storage.get('pdsUrls');
  const stored = (result as Record<string, unknown>)['pdsUrls'];
  const pdsUrls: Record<string, string> =
    stored !== null && typeof stored === 'object' && !Array.isArray(stored) ? (stored as Record<string, string>) : {};
  pdsUrls[did] = url;
  await storage.set({ pdsUrls });
}

// Store a PDS URL globally (pre-auth, before a DID is known).
// Used during the OAuth sign-in flow when the DID is not yet available.
export async function setGlobalPdsUrl(url: string): Promise<void> {
  const storage = getStorage();
  await storage.set({ pdsUrl: url });
}

export async function getSettings(): Promise<ExtensionSettings> {
  const storage = getStorage();
  const result = await storage.get('settings');
  const raw = (result as { settings?: unknown }).settings;
  return isExtensionSettings(raw) ? raw : DEFAULT_SETTINGS;
}

export async function setSettings(settings: ExtensionSettings): Promise<void> {
  const storage = getStorage();
  await storage.set({ settings });
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
export const BSKY_OAUTH_CLIENT_ID = 'https://docs.skeeditor.link/oauth/client-metadata.json';
/** OAuth redirect URI - must match exactly what's registered in the client metadata */
export const BSKY_OAUTH_REDIRECT_URI = 'https://docs.skeeditor.link/callback.html';

/** DID of the skeeditor labeler account (@skeeditor.link) */
export const LABELER_DID = 'did:plc:m6h36r2hzbnozuhxj4obhkyb';

/** Endpoint to trigger a label broadcast after a successful edit */
export const LABELER_EMIT_URL = 'https://labeler.skeeditor.link/xrpc/tools.skeeditor.emitLabel';

/** WebSocket endpoint to receive real-time `edited` label pushes from the labeler */
export const LABELER_SUBSCRIBE_WS_URL = 'wss://labeler.skeeditor.link/xrpc/com.atproto.label.subscribeLabels?cursor=0';
