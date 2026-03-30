# Authentication

> **Canonical documentation:** [Developer Auth Guide](./dev/auth.md)

Skeeditor authenticates with the Bluesky PDS via **OAuth 2.0 with PKCE** (Proof Key for Code Exchange). All auth flow logic lives in the background service worker; content scripts and the popup never handle tokens directly.

---

## Overview

1. User clicks "Sign in" in the popup.
2. Popup sends an `AUTH_SIGN_IN` message to the background service worker.
3. Background builds a PKCE authorization request (`buildAuthorizationRequest`) and opens the authorization URL in a new tab.
4. The PDS redirects the user to the extension's `callback.html` page.
5. `callback.html` reads the `code` and `state` URL parameters and posts an `AUTH_CALLBACK` message to the background.
6. Background verifies the `state`, calls `exchangeCodeForTokens`, validates the response (including DID format and expiry), and persists the session tokens in `browser.storage.local` via `sessionStore`.
7. Background returns the auth status to the popup.

---

## Key modules

| Module                             | Purpose                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `src/shared/auth/auth-client.ts`   | OAuth PKCE authorization: build auth URL, exchange code for tokens |
| `src/shared/auth/pkce.ts`          | PKCE code verifier/challenge generation, CSRF state                |
| `src/shared/auth/session-store.ts` | Persist/read/clear tokens in `browser.storage.local`               |
| `src/shared/auth/token-refresh.ts` | Token refresh with in-flight deduplication                         |
| `src/shared/auth/app-password.ts`  | App password authentication (fallback for non-OAuth PDS)           |
| `src/shared/auth/types.ts`         | OAuth type definitions                                             |
| `src/popup/auth-popup.ts`          | `<auth-popup>` Web Component for sign-in/sign-out UI               |
| `src/background/message-router.ts` | Routes auth messages, stores PKCE state, validates callbacks       |

---

## Client registration

The OAuth `client_id` is `https://skeeditor.app/client-metadata.json` (exported from `src/shared/constants.ts` as `BSKY_OAUTH_CLIENT_ID`).

See the [Developer Auth Guide](./dev/auth.md) for the full client metadata document, redirect URI strategy, and security notes.

---

## App password authentication

For PDS instances that do not support OAuth, `src/shared/auth/app-password.ts` provides:

- `authenticateWithAppPassword(identifier, password)` — calls `com.atproto.server.createSession`
- `validateAppPassword(password)` — validates length and character requirements
- `maskAppPassword(password)` — masks the middle of the password for display

---

## Threat Model

### DPoP key storage

DPoP private keys are generated via `crypto.subtle.generateKey` with `{ extractable: true }` so they can be serialised as a JWK and persisted in `browser.storage.local`. This is an unavoidable limitation of Manifest V3 service workers: non-extractable `CryptoKey` objects live in JavaScript memory and are lost when the service worker is terminated (typically within 30 s of inactivity). Re-generating a new key on every restart would invalidate all existing sessions.

**Risk:** Another browser extension that holds the `storage` permission could read the exported JWK. A compromised extension could therefore construct valid DPoP proofs for any request until the access token expires.

**Mitigations:**

- Access tokens are short-lived (typically 15 min); an attacker gains only a narrow window.
- The DPoP key is scoped to the extension's private storage namespace — other origins and web pages cannot access it.
- The extension requests only the minimum permissions needed (`storage`, `activeTab`).
- Until browsers expose a service-worker-safe non-extractable key storage API (e.g., via the [Storage Access API](https://privacycg.github.io/storage-access/) or dedicated extension key stores), this trade-off is the accepted practice in the MV3 ecosystem.

### PKCE state persistence

PKCE `state` and `codeVerifier` values are stored in `browser.storage.session` when available (Chrome MV3). Session storage is cleared automatically when the browser closes or the service worker is terminated, so a stale verifier cannot be replayed across restarts.

On Firefox, where `browser.storage.session` may be unavailable, the fallback is `browser.storage.local`. To prevent a stale verifier from surviving a browser restart, the service worker clears `pendingAuth` from local storage on every startup.

## Security Considerations

### DPoP Key Storage Risk

**Important Security Note:** The extension stores DPoP private keys as JWK in `browser.storage.local` due to Manifest V3 service worker limitations. This is a necessary trade-off for maintaining persistent authentication sessions.

**Risk Assessment:**

- **Attack Vector:** Malicious extensions with `storage` permission could potentially access the DPoP key
- **Impact Window:** Limited to the access token lifetime (typically 15 minutes)
- **Scope:** Extension-specific storage namespace prevents access from web pages or other origins

**Mitigation Strategies:**

- Short-lived access tokens (15 minutes) limit exposure window
- Minimal permission set reduces attack surface
- Future enhancement: Implement DPoP key rotation mechanism

**User Awareness:** Users should be cautious about installing untrusted extensions that request broad storage permissions, as they could potentially access sensitive authentication data.

### Token Refresh Security

The token refresh mechanism includes in-flight request deduplication to prevent race conditions and ensure consistent token state across concurrent refresh attempts.
