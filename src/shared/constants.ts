export const APP_NAME = 'skeeditor';
export const BSKY_APP_ORIGIN = 'https://bsky.app';
export const BSKY_PDS_URL = 'https://bsky.social';
export const APP_BSKY_FEED_POST_COLLECTION = 'app.bsky.feed.post';

// AT Protocol OAuth endpoints
export const BSKY_OAUTH_AUTHORIZE_URL = `${BSKY_PDS_URL}/oauth/authorize`;
export const BSKY_OAUTH_TOKEN_URL = `${BSKY_PDS_URL}/oauth/token`;
/** Minimal scope for reading and writing AT Protocol records */
export const BSKY_OAUTH_SCOPE = 'atproto transition:generic';
/**
 * OAuth client_id for skeeditor. Per the AT Protocol OAuth spec, the client_id
 * MUST be a URL pointing to a JSON client metadata document.
 */
export const BSKY_OAUTH_CLIENT_ID = 'https://skeeditor.app/client-metadata.json';
