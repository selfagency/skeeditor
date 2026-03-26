# Authentication

> **Canonical documentation:** [Developer Auth Guide](./dev/auth.md)

skeeditor authenticates with the Bluesky PDS via **OAuth 2.0 with PKCE** (Proof Key for Code Exchange). All auth flow logic lives in the background service worker; content scripts and the popup never handle tokens directly.

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

App password sessions use the same `sessionStore` as OAuth sessions.
