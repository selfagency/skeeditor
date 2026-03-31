# Authentication

> **Canonical documentation:** [Developer Auth Guide](./dev/auth.md)

Skeeditor authenticates with the Bluesky PDS via **OAuth 2.0 with PKCE** and DPoP. All auth logic runs in the background service worker; content scripts and popup code never access tokens directly.

---

## Overview

1. User clicks **Sign in** in the popup.
2. Popup sends `AUTH_SIGN_IN` to the background worker.
3. Background builds a PKCE authorization request and opens the authorization URL.
4. The PDS redirects to `callback.html` with `code` and `state`.
5. `callback.html` sends `AUTH_CALLBACK` to background.
6. Background verifies `state`, exchanges the code for tokens, validates response fields, and stores session data via `sessionStore` in `browser.storage.local`.
7. Popup queries status via `AUTH_GET_STATUS`.

---

## Key modules

| Module                             | Purpose                                                      |
| ---------------------------------- | ------------------------------------------------------------ |
| `src/shared/auth/auth-client.ts`   | OAuth PKCE + DPoP token exchange and refresh helpers         |
| `src/shared/auth/pkce.ts`          | PKCE code verifier/challenge generation and CSRF state       |
| `src/shared/auth/session-store.ts` | Persist/read/clear sessions in `browser.storage.local`       |
| `src/shared/auth/types.ts`         | Shared OAuth/auth type definitions                           |
| `src/popup/auth-popup.ts`          | `<auth-popup>` sign-in/sign-out and account-switching UI     |
| `src/background/message-router.ts` | Auth routing, callback validation, and session orchestration |

---

## Client registration

The OAuth `client_id` is `https://docs.skeeditor.link/oauth/client-metadata.json` (`BSKY_OAUTH_CLIENT_ID` in `src/shared/constants.ts`).

See the [Developer Auth Guide](./dev/auth.md) for full client metadata, redirect URI details, and endpoint behavior.

---

## Security notes

## Threat Model

### DPoP key storage

DPoP private keys are generated via `crypto.subtle.generateKey` with `{ extractable: true }` so they can be serialised as a JWK and persisted in `browser.storage.local`. This is an unavoidable limitation of Manifest V3 service workers: non-extractable `CryptoKey` objects live in JavaScript memory and are lost when the service worker is terminated (typically within 30 s of inactivity). Re-generating a new key on every restart would invalidate all existing sessions.

**Risk:** Another browser extension that holds the `storage` permission could read the exported JWK. A compromised extension could therefore construct valid DPoP proofs for any request until the access token expires.

**Mitigations:**

- Access tokens are short-lived (typically 15 min); an attacker gains only a narrow window.
- The DPoP key is scoped to the extension's private storage namespace — other origins and web pages cannot access it.
- The extension requests only the minimum runtime permissions needed (`storage`, `tabs`, `alarms`) plus scoped host permissions for `bsky.app`, `*.bsky.network`, `docs.skeeditor.link`, and `slingshot.microcosm.blue`.
- Until browsers expose a service-worker-safe non-extractable key storage API (e.g., via the [Storage Access API](https://privacycg.github.io/storage-access/) or dedicated extension key stores), this trade-off is the accepted practice in the MV3 ecosystem.

### PKCE state persistence

PKCE `state` and `codeVerifier` values are stored in `browser.storage.session` when available (Chrome MV3). The stored `pendingAuth` record includes a numeric `createdAt` timestamp. Session storage is cleared automatically when the browser closes or the service worker is terminated, so a stale verifier cannot be replayed across restarts.

On browsers where `browser.storage.session` is unavailable, the fallback is `browser.storage.local`. On startup, the service worker removes stale local `pendingAuth` records older than 5 minutes and also removes legacy records missing `createdAt`.

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

- DPoP private keys are stored as JWK in extension storage due to MV3 service-worker lifecycle constraints.
- PKCE `state` is validated on callback to prevent CSRF.
- Pending auth state prefers `browser.storage.session`; fallback local entries are TTL-cleaned on startup.
- Access/refresh tokens remain background-only and are never exposed to content scripts.
- Until browsers expose a service-worker-safe non-extractable key storage API (for example, via the [Storage Access API](https://privacycg.github.io/storage-access/)), this trade-off remains the accepted MV3 approach.
