# Privacy & Security

## What data Skeeditor stores

Skeeditor stores exactly one thing in your browser's extension storage (`browser.storage.local`):

- **Your OAuth session token** — a short-lived access token plus a refresh token, both issued by Bluesky's authorization server (`bsky.social`). These are standard OAuth 2.0 credentials.

Extension storage is isolated per-extension and per-browser-profile. It is not accessible by web pages, other extensions, or any server.

::: info No plaintext passwords
Skeeditor never asks for, receives, or stores your Bluesky password. The OAuth flow runs entirely between your browser and the Bluesky authorization server.
:::

---

## What data Skeeditor never collects

- **No analytics.** There are no tracking scripts, no telemetry endpoints, no crash reporters. The extension makes zero outbound network requests to any analytics provider.
- **No third-party services.** The extension only contacts Bluesky servers and, optionally, the Skeeditor labeler (see below).
- **No browsing history.** Skeeditor only activates on `bsky.app`. It does not read your history, open tabs list, or any other site's data.
- **No clipboard access.** The editor pre-fills from the on-page post text. The extension never programmatically reads or writes your clipboard.
- **No records kept.** We do not log, store, or retain any information about your posts, edits, or authentication — not even during the OAuth flow through our callback page.

---

## Network connections

When you use Skeeditor, your browser makes requests to:

| Endpoint                                              | Purpose                                               |
| ----------------------------------------------------- | ----------------------------------------------------- |
| `https://bsky.social/oauth/authorize`                 | Initial OAuth authorization redirect                  |
| `https://bsky.social/oauth/token`                     | Exchange authorization code for tokens; token refresh |
| `https://bsky.social/xrpc/com.atproto.repo.getRecord` | Fetch the current post record                         |
| `https://bsky.social/xrpc/com.atproto.repo.putRecord` | Write the edited post record back                     |
| `https://labeler.skeeditor.link`                      | Labeler service — applies "edited" labels to posts    |

All requests go to Bluesky's own servers or the Skeeditor labeler over HTTPS. No intermediate proxy, analytics endpoint, or third-party server is involved at any point. The labeler connection only occurs if you have subscribed to the Skeeditor labeler (`@skeeditor.link`) through your Bluesky moderation settings.

---

## Security model

### OAuth 2.0 + PKCE

Authentication uses the [OAuth 2.0 Authorization Code flow with PKCE](https://datatracker.ietf.org/doc/html/rfc7636). A fresh `code_verifier`/`code_challenge` pair is generated locally for every sign-in, preventing authorization code interception attacks.

### Token storage

Access and refresh tokens are stored in `browser.storage.local`. This storage is sandboxed to the extension and is not accessible from content scripts (scripts injected into bsky.app pages) or from the page itself.

The background service worker handles all token usage and refresh. Content scripts communicate with the background only via typed runtime messages — they never touch tokens directly.

### CID-based optimistic locking

When saving an edited post, Skeeditor uses the record's CID (content identifier) as an optimistic concurrency check. If the record changed between when the editor was opened and when Save is clicked, the write is rejected — not silently overwritten.

---

## Open source

Skeeditor is fully open source under the MIT licence. You can read every line of code at [github.com/selfagency/skeeditor](https://github.com/selfagency/skeeditor) and verify these claims yourself.
