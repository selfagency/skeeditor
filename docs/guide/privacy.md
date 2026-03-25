# Privacy & Security

## What data skeeditor stores

skeeditor stores exactly one thing in your browser's extension storage (`browser.storage.local`):

- **Your OAuth session token** — a short-lived access token plus a refresh token, both issued by Bluesky's authorization server (`bsky.social`). These are standard OAuth 2.0 credentials.

Extension storage is isolated per-extension and per-browser-profile. It is not accessible by web pages, other extensions, or any server.

::: info No plaintext passwords
skeeditor never asks for, receives, or stores your Bluesky password. The OAuth flow runs entirely between your browser and the Bluesky authorization server.
:::

---

## What data skeeditor never collects

- **No analytics.** There are no tracking scripts, no telemetry endpoints, no crash reporters. The extension makes zero outbound network requests to any analytics provider.
- **No third-party services.** The extension only contacts `bsky.social` (the Bluesky PDS) for authentication and record operations.
- **No browsing history.** skeeditor only activates on `bsky.app`. It does not read your history, open tabs list, or any other site's data.
- **No clipboard access.** The editor pre-fills from the on-page post text. The extension never programmatically reads or writes your clipboard.

---

## Network connections

When you use skeeditor, your browser makes requests to:

| Endpoint                                              | Purpose                                               |
| ----------------------------------------------------- | ----------------------------------------------------- |
| `https://bsky.social/oauth/authorize`                 | Initial OAuth authorization redirect                  |
| `https://bsky.social/oauth/token`                     | Exchange authorization code for tokens; token refresh |
| `https://bsky.social/xrpc/com.atproto.repo.getRecord` | Fetch the current post record                         |
| `https://bsky.social/xrpc/com.atproto.repo.putRecord` | Write the edited post record back                     |

All requests go to Bluesky's own servers over HTTPS. No intermediate proxy or skeeditor-operated server is involved at any point.

---

## Security model

### OAuth 2.0 + PKCE

Authentication uses the [OAuth 2.0 Authorization Code flow with PKCE](https://datatracker.ietf.org/doc/html/rfc7636). A fresh `code_verifier`/`code_challenge` pair is generated locally for every sign-in, preventing authorization code interception attacks.

### Token storage

Access and refresh tokens are stored in `browser.storage.local`. This storage is sandboxed to the extension and is not accessible from content scripts (scripts injected into bsky.app pages) or from the page itself.

The background service worker handles all token usage and refresh. Content scripts communicate with the background only via typed runtime messages — they never touch tokens directly.

### CID-based optimistic locking

When saving an edited post, skeeditor uses the record's CID (content identifier) as an optimistic concurrency check. If the record changed between when the editor was opened and when Save is clicked, the write is rejected — not silently overwritten.

---

## Open source

skeeditor is fully open source under the MIT licence. You can read every line of code at [github.com/selfagency/skeeditor](https://github.com/selfagency/skeeditor) and verify these claims yourself.
