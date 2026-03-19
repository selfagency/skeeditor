export const APP_NAME = 'skeeditor';
export const BSKY_APP_ORIGIN = 'https://bsky.app';
export const BSKY_PDS_URL = 'https://bsky.social';
export const APP_BSKY_FEED_POST_COLLECTION = 'app.bsky.feed.post';

// AT Protocol OAuth endpoints
export const BSKY_OAUTH_AUTHORIZE_URL = 'https://bsky.social/oauth/authorize';
export const BSKY_OAUTH_TOKEN_URL = 'https://bsky.social/oauth/token';
/** Minimal scope for reading and writing AT Protocol records */
export const BSKY_OAUTH_SCOPE = 'atproto transition:generic';
/**
 * Default OAuth client_id for skeeditor. Per the AT Protocol OAuth spec, the
 * client_id MUST be a URL pointing to a JSON client metadata document.
 *
 * This value can be overridden at build/runtime via the BSKY_OAUTH_CLIENT_ID
 * environment variable to support different client registrations per env.
 */
const DEFAULT_BSKY_OAUTH_CLIENT_ID = 'https://skeeditor.app/client-metadata.json';

// Allow overriding the client_id via environment variable while preserving the
// production value as a safe default.
const envClientId =
  typeof process !== 'undefined'
    ? (process.env as Record<string, string | undefined>)['BSKY_OAUTH_CLIENT_ID']
    : undefined;

export const BSKY_OAUTH_CLIENT_ID =
  envClientId !== undefined && envClientId.trim().length > 0 ? envClientId : DEFAULT_BSKY_OAUTH_CLIENT_ID;
