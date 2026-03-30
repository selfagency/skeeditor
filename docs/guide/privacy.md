# Privacy & Security

## What data Skeeditor stores

Skeeditor stores some data in your browser's extension storage (`browser.storage.local`) to keep you signed in and remember your preferences. Specifically:

- **OAuth sessions and account state.** For each account you sign in with, Skeeditor stores the OAuth access and refresh tokens issued by Bluesky's authorization server (`bsky.social`), plus the minimal metadata needed for multi-account support (such as the list of sessions and which account is currently active).
- **Per-account service configuration.** For each DID, Skeeditor stores the URL of the personal data server (PDS) you use.
- **Editor settings.** Your local preferences (for example, the edit time limit) so the editor behaves the same way each time you use it.
- **Pending labeler consent.** A short-lived flag indicating whether Skeeditor should prompt you to opt in to the optional Skeeditor labeler.
- **DPoP key material.** Public/secret key pairs used to generate OAuth DPoP proofs, stored only in extension storage and used solely as required by the OAuth protocol.

Extension storage is isolated per-extension and per-browser-profile. It is not accessible by web pages, other extensions, or any server.

::: info No plaintext passwords
Skeeditor never asks for, receives, or stores your Bluesky password. The OAuth flow runs entirely between your browser and the Bluesky authorization server.
:::

---

## What data Skeeditor never collects

- **No analytics.** There are no tracking scripts, no telemetry endpoints, no crash reporters. The extension makes zero outbound network requests to any analytics provider.
- **No analytics or ad-tech services.** The extension does not call telemetry, tracking, or ad endpoints. It only calls Bluesky infrastructure plus clearly documented extension services (Skeeditor labeler and Slingshot read acceleration).
- **No browsing history.** Skeeditor only activates on `bsky.app`. It does not read your history, open tabs list, or any other site's data.
- **No clipboard access.** The editor pre-fills from the on-page post text. The extension never programmatically reads or writes your clipboard.
- **No records kept.** We do not log, store, or retain any information about your posts, edits, or authentication — not even during the OAuth flow through our callback page.

---

## Network connections

When you use Skeeditor, your browser makes requests to:

- Your Bluesky auth server (typically `bsky.social`) `/oauth/authorize` for initial OAuth authorization
- Your Bluesky auth server `/oauth/token` for token exchange and refresh
- Your PDS (typically `bsky.social` or `*.bsky.network`) `/xrpc/com.atproto.repo.getRecord` and `/xrpc/com.atproto.repo.putRecord` for record reads/writes
- `https://slingshot.microcosm.blue/xrpc/com.atproto.repo.getRecord` for edited-post read acceleration
- `https://labeler.skeeditor.link/xrpc/tools.skeeditor.emitLabel` for label emits after successful edits
- `wss://labeler.skeeditor.link/xrpc/com.atproto.label.subscribeLabels` for real-time edited-label subscription updates
- `https://plc.directory/<did>` for `did:plc` document resolution in DID helper flows
- `https://public.api.bsky.app/...` and `https://api.bsky.app/...` for fallback DID→handle lookups
- `https://docs.skeeditor.link/oauth/client-metadata.json` for OAuth client metadata
- `https://docs.skeeditor.link/callback.html` for the hosted OAuth callback page

When labeler integration is active, Skeeditor sends the OAuth **access token** in an `Authorization: Bearer` header to the labeler emit endpoint so the labeler can validate the token with the user's PDS before accepting an emit. Skeeditor does **not** send refresh tokens to the labeler.

All requests go over HTTPS/WSS to the hosts above. There are no analytics endpoints, hidden relay proxies, or advertising SDK calls.

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
