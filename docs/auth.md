# Authentication

Skeeditor authenticates with the AT Protocol PDS via OAuth 2.0 with PKCE (Proof Key for Code Exchange). All auth flow logic lives in the background service worker; content scripts and the popup never handle tokens directly.

---

## Overview

1. User clicks "Sign in" in the popup.
2. Popup sends an `AUTH_SIGN_IN` message to the background service worker via `browser.runtime.sendMessage` (and uses `AUTH_SIGN_OUT` / `AUTH_REAUTHORIZE` for sign-out and reauthorization flows).
3. Background builds a PKCE authorization request (`buildAuthorizationRequest`) and opens the authorization URL in a new tab.
4. The PDS redirects the user to the extension-packaged `callback.html` page.
5. `callback.html` reads the `code` and `state` URL parameters and posts them to the background via `browser.runtime.sendMessage`.
6. Background verifies the `state`, calls `exchangeCodeForTokens`, and stores the resulting tokens in `browser.storage.local`.
7. Background notifies the popup of the successful login via `browser.runtime.sendMessage` and updates its auth state.

---

## Client Registration

AT Protocol OAuth requires the client to be identified by a **client ID that is a valid HTTPS URL** pointing to a client metadata document. This document must be publicly accessible.

**Create a `client-metadata.json` at a stable HTTPS URL** (e.g. `https://skeeditor.example.com/client-metadata.json`) with the following structure:

```json
{
  "client_id": "https://skeeditor.example.com/client-metadata.json",
  "client_name": "Skeeditor",
  "client_uri": "https://skeeditor.example.com",
  "redirect_uris": [
    "https://skeeditor.example.com/callback"
  ],
  "response_types": ["code"],
  "grant_types": ["authorization_code", "refresh_token"],
  "token_endpoint_auth_method": "none",
  "scope": "atproto transition:generic",
  "dpop_bound_access_tokens": true
}
```

> **Note for development:** During development you may host the metadata document locally (e.g. with `npx serve`) and use its URL as the `client_id`. Never embed the client ID as a secret — it is a public identifier.

---

## Required Scopes

| Scope | Purpose |
| --- | --- |
| `atproto` | Identifies this as an AT Protocol client |
| `transition:generic` | Grants read/write access to records the user owns (minimum viable scope) |

Use `atproto transition:generic` as the default scope. Narrower scopes may be supported in future ATProto PDS releases.

---

## Redirect URI Strategy

Browser extensions cannot use `localhost` or arbitrary HTTP redirect URIs. Instead, the callback must be an **extension-packaged page** served from the extension's own origin.

The redirect URI is resolved at runtime using the browser API:

```typescript
// Evaluated in the background service worker
const redirectUri = browser.runtime.getURL('callback.html');
// Chrome:  chrome-extension://<extension-id>/callback.html
// Firefox: moz-extension://<extension-id>/callback.html
```

This URL must be included in `redirect_uris` in the client metadata document (see above). Because the extension ID differs between browsers and development/production builds, the metadata document may need to be updated when rebuilding for each store.

### Manifest Changes Required

Add `callback.html` to the extension build output and list it under `web_accessible_resources` if needed:

```json
// manifests/base.json
{
  "web_accessible_resources": [
    {
      "resources": ["callback.html"],
      "matches": ["https://bsky.social/*"]
    }
  ]
}
```

Ensure the build pipeline includes `callback.html` (and its companion script) in the output directory for each browser target.

---

## Authorization Endpoints

| Endpoint | URL |
| --- | --- |
| Discover (metadata) | `https://bsky.social/.well-known/oauth-authorization-server` |
| Authorization | `https://bsky.social/oauth/authorize` |
| Token | `https://bsky.social/oauth/token` |

These URLs are also exported from `src/shared/constants.ts` as `BSKY_OAUTH_AUTHORIZE_URL` and `BSKY_OAUTH_TOKEN_URL`.

---

## PKCE Flow

All PKCE utilities are in `src/shared/auth/pkce.ts`.

```typescript
import { generateCodeVerifier, deriveCodeChallenge, generateState } from '@src/shared/auth/pkce';

// Before redirect
const codeVerifier = generateCodeVerifier(); // store this
const codeChallenge = await deriveCodeChallenge(codeVerifier);
const state = generateState(); // store this for CSRF check

// Build auth URL — use buildAuthorizationRequest() from auth-client.ts instead
```

Prefer the higher-level `buildAuthorizationRequest()` from `auth-client.ts` which combines all steps.

---

## Security Notes

- **Never expose tokens to content scripts.** Content scripts run in the page context and can be observed by the page. Send messages to the background instead.
- **Always verify the `state` value** returned in the callback matches what was generated before the redirect. Mismatches indicate a CSRF attempt.
- **Store tokens in `browser.storage.local`**, not `sessionStorage` or `localStorage` (these are accessible to content scripts and the page).
- **No client secret.** AT Protocol browser extension clients use `token_endpoint_auth_method: "none"`. PKCE replaces the client secret for public clients.
- **DPoP.** The AT Protocol PDS requires DPoP-bound access tokens (`dpop_bound_access_tokens: true` in client metadata). DPoP key generation and proof headers are a separate concern handled in a follow-up bean.
- **Do not commit client IDs** that resolve to real production deployments into development branches. Use `.env.example` to communicate required variables.

---

## Follow-up Beans

| Bean | Scope |
| --- | --- |
| `skeeditor-4pqr` | Persist access/refresh tokens in `browser.storage.local` |
| `skeeditor-qnbm` | Automatic silent token refresh before expiry |
| `skeeditor-sykd` | Popup login/logout UI wired to the auth flow |
| `skeeditor-vrnp` | Auth-status routing (show editor vs. login gate) |
| `skeeditor-oflm` | App-password fallback for non-OAuth PDS instances |
