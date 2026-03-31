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

- DPoP private keys are stored as JWK in extension storage due to MV3 service-worker lifecycle constraints.
- PKCE `state` is validated on callback to prevent CSRF.
- Pending auth state prefers `browser.storage.session`; fallback local entries are TTL-cleaned on startup.
- Access/refresh tokens remain background-only and are never exposed to content scripts.
- Until browsers expose a service-worker-safe non-extractable key storage API (for example, via the [Storage Access API](https://privacycg.github.io/storage-access/)), this trade-off remains the accepted MV3 approach.
