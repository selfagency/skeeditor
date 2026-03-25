# Authentication

skeeditor authenticates with the Bluesky PDS (Personal Data Server) via OAuth 2.0 with PKCE (Proof Key for Code Exchange). All auth flow logic lives in the background service worker.

## Key principle

Content scripts and the popup **never handle tokens directly**. They send typed messages to the background worker, which manages all token access, refresh, and revocation.

---

## OAuth 2.0 + PKCE flow

```text
Popup: AUTH_SIGN_IN message
  │
  ▼
Background: buildAuthorizationRequest()
  → generates code_verifier + code_challenge (PKCE)
  → generates state (CSRF protection)
  → opens new tab to bsky.social/oauth/authorize
  │
  ▼
User authorizes on bsky.social
  │
  ▼
PDS redirects to chrome-extension://<id>/callback.html?code=…&state=…
  │
  ▼
callback.html: sends { code, state } to background via chrome.runtime.sendMessage
  │
  ▼
Background: verifies state, calls exchangeCodeForTokens()
  → POST bsky.social/oauth/token (code, code_verifier, redirect_uri)
  → receives { access_token, refresh_token, expires_in }
  │
  ▼
Background: SessionStore.write(tokens)  → browser.storage.local
  │
  ▼
Background: closes callback tab, notifies popup of success
```

---

## PKCE utilities (`src/shared/auth/pkce.ts`)

```ts
import { generateCodeVerifier, deriveCodeChallenge, generateState } from '@src/shared/auth/pkce';

const codeVerifier  = generateCodeVerifier();              // 43-128 char random string
const codeChallenge = await deriveCodeChallenge(codeVerifier); // SHA-256, base64url-encoded
const state         = generateState();                     // 32-char random string for CSRF check
```

Prefer the higher-level `buildAuthorizationRequest()` from `auth-client.ts` which combines all steps and stores the verifier/state for later retrieval.

---

## OAuth client registration

AT Protocol requires the client to be identified by a **client ID that is a valid HTTPS URL** pointing to a publicly accessible client metadata document. The metadata document specifies the redirect URIs, scopes, and other client parameters.

```json
{
  "client_id": "https://skeeditor.app/client-metadata.json",
  "client_name": "skeeditor",
  "client_uri": "https://skeeditor.app",
  "redirect_uris": [
    "chrome-extension://<extension-id>/callback.html",
    "moz-extension://<extension-id>/callback.html"
  ],
  "response_types": ["code"],
  "grant_types": ["authorization_code", "refresh_token"],
  "token_endpoint_auth_method": "none",
  "scope": "atproto transition:generic",
  "dpop_bound_access_tokens": true
}
```

The `client_id` is exported from `src/shared/constants.ts` as `BSKY_OAUTH_CLIENT_ID`.

::: warning Extension IDs differ per browser and build
The redirect URI must be listed in the metadata document. Because the extension ID differs between Chrome, Firefox, and development vs. production builds, you may need multiple redirect URIs, or use a stable extension ID via Chrome's `key` field and Firefox's `browser_specific_settings.gecko.id`.
:::

---

## Session store (`src/shared/auth/session-store.ts`)

`SessionStore` reads and writes tokens in `browser.storage.local` — sandboxed to the extension, inaccessible to page context.

```ts
import { SessionStore } from '@src/shared/auth/session-store';

const store = new SessionStore();

await store.write(tokens);        // Persist access + refresh tokens
const tokens = await store.read(); // null if not signed in
await store.clear();              // Delete tokens (sign-out)
```

---

## Token refresh (`src/shared/auth/token-refresh.ts`)

`TokenRefreshManager` proactively refreshes the access token before it expires:

- Deduplicates concurrent refresh requests (only one in-flight at a time).
- Retries on transient network errors.
- Calls `SessionStore.write()` with the new tokens after a successful refresh.
- Emits an `auth-session-invalidated` event on unrecoverable failures (e.g. refresh token revoked), which triggers a re-auth prompt in the popup.

---

## Required scopes

| Scope | Purpose |
| --- | --- |
| `atproto` | Identifies this as an AT Protocol client |
| `transition:generic` | Grants read/write access to records the user owns |

---

## OAuth endpoints

| Endpoint | URL |
| --- | --- |
| Discover | `https://bsky.social/.well-known/oauth-authorization-server` |
| Authorization | `https://bsky.social/oauth/authorize` |
| Token | `https://bsky.social/oauth/token` |

Exported from `src/shared/constants.ts` as `BSKY_OAUTH_AUTHORIZE_URL` and `BSKY_OAUTH_TOKEN_URL`.

---

## Security notes

- **Never expose tokens to content scripts.** Content scripts run in the page context and can be observed by bsky.app's JavaScript. All token access goes through background messages.
- **Always verify `state`** in the OAuth callback. A mismatch means a CSRF attempt.
- **No client secret.** Public browser extension clients use `token_endpoint_auth_method: "none"`. PKCE replaces the client secret.
- **DPoP.** The Bluesky PDS requires `dpop_bound_access_tokens: true`. DPoP key generation and proof headers are implemented in the auth client.
