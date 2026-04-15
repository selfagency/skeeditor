import { browser } from 'wxt/browser';

export const APP_NAME = 'skeeditor';
export const BSKY_APP_ORIGIN = 'https://bsky.app';
export const DEFAULT_PDS_URL = 'https://bsky.social';
export const BSKY_PDS_URL = DEFAULT_PDS_URL;
export const APP_BSKY_FEED_POST_COLLECTION = 'app.bsky.feed.post';

export interface ExtensionSettings {
  editTimeLimit: number | null;
  saveStrategy: 'edit' | 'recreate';
}

const DEFAULT_SETTINGS: ExtensionSettings = {
  editTimeLimit: null,
  saveStrategy: 'recreate',
};

export const EDIT_TIME_LIMIT_OPTIONS = [0.5, 1, 3, 5, 15, 30] as const;

const getStorage = (): typeof browser.storage.local => {
  if (!browser.storage.local) {
    throw new Error('browser.storage.local is unavailable');
  }
  return browser.storage.local;
};

export const EDIT_TIME_LIMIT_MIN = 0.5;
export const EDIT_TIME_LIMIT_MAX = 30;

export const isValidEditTimeLimit = (value: unknown): value is number | null => {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isFinite(value) &&
      EDIT_TIME_LIMIT_OPTIONS.includes(value as (typeof EDIT_TIME_LIMIT_OPTIONS)[number]))
  );
};

export const isValidSaveStrategy = (value: unknown): value is ExtensionSettings['saveStrategy'] => {
  return value === 'edit' || value === 'recreate';
};

const isValidLegacyPostDateStrategy = (value: unknown): value is 'preserve' | 'update' => {
  return value === 'preserve' || value === 'update';
};

const normalizeExtensionSettings = (value: unknown): ExtensionSettings => {
  if (value === null || typeof value !== 'object') {
    return DEFAULT_SETTINGS;
  }

  const raw = value as Record<string, unknown>;
  const editTimeLimit = isValidEditTimeLimit(raw['editTimeLimit'])
    ? raw['editTimeLimit']
    : DEFAULT_SETTINGS.editTimeLimit;
  const saveStrategy = isValidSaveStrategy(raw['saveStrategy'])
    ? raw['saveStrategy']
    : isValidLegacyPostDateStrategy(raw['postDateStrategy'])
      ? raw['postDateStrategy'] === 'update'
        ? 'recreate'
        : 'edit'
      : DEFAULT_SETTINGS.saveStrategy;

  return {
    editTimeLimit,
    saveStrategy,
  };
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
  return normalizeExtensionSettings(raw);
}

export async function setSettings(settings: ExtensionSettings): Promise<void> {
  const storage = getStorage();
  await storage.set({ settings: normalizeExtensionSettings(settings) });
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

/** Base WebSocket endpoint to receive real-time `edited` label pushes from the labeler */
export const LABELER_SUBSCRIBE_WS_BASE_URL = 'wss://labeler.skeeditor.link/xrpc/com.atproto.label.subscribeLabels';

/** storage.local key for the last label sequence processed by the background WebSocket */
export const LABELER_CURSOR_STORAGE_KEY = 'labelerCursor';

/** storage.local key for persisted labeler websocket reconnect backoff (ms) */
export const LABELER_BACKOFF_STORAGE_KEY = 'labelerBackoffMs';

export function buildLabelerSubscribeWsUrl(cursor: number | null): string {
  if (cursor === null || !Number.isFinite(cursor) || cursor < 0) {
    return LABELER_SUBSCRIBE_WS_BASE_URL;
  }

  const url = new URL(LABELER_SUBSCRIBE_WS_BASE_URL);
  url.searchParams.set('cursor', String(cursor));
  return url.toString();
}
