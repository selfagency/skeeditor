# Implementation Plan — Skeeditor Labeler + Real-Time Propagation

## Problem

After a user saves an edit, the updated post text propagates to followers via the
ATProto firehose → AppView pipeline. This pipeline introduces latency of 30 seconds
to several minutes for other users using bsky.app to see the corrected text.

## Solution

A lightweight ATProto-conformant labeler service that:

1. **Receives an emit trigger** from the extension immediately after a successful
   `putRecord` write.
2. **Broadcasts an `edited` label** over `subscribeLabels` WebSocket to all
   connected extension clients.
3. **Extension clients** receive the label push, re-fetch the post record directly
   from the originating PDS (bypassing AppView), and update the DOM immediately.

This bypasses AppView propagation entirely for users who have the extension
installed. Users without the extension see the update when AppView catches up.

---

## Architecture Overview

```
[Editor's extension]
    PUT_RECORD → PDS ✓
    POST /emit → Labeler → Durable Object wakes
                               ↓
                     Broadcasts label frame to
                     all hibernate WebSocket clients
                               ↓
[Follower's extension SW]  ← WebSocket push
    Receives label { uri: "at://did/.../rkey" }
    Sends GET_RECORD to background
    Background fetches from originating PDS
    Returns updated { text, facets, ... }
    Content script calls updatePostText(element, text)
```

---

## Component 1 — Labeler Service (`packages/labeler`)

### Stack

- **Runtime**: Cloudflare Workers (V8 isolates, edge network)
- **Persistence**: Durable Objects with WebSocket Hibernation API
- **Storage**: Cloudflare KV for `queryLabels` history (optional)
- **Language**: TypeScript

### Why Cloudflare Workers + Durable Objects

Hibernating WebSocket connections consume **zero CPU** between messages.
At 1M concurrent idle connections, compute cost approaches zero — billing only
accrues when a label event is actually broadcast. This is the only practical
way to serve millions of persistent WebSocket connections cost-effectively.

Estimated cost at scale:
| Event | Cost |
| --------------------------------- | --------------- |
| Idle connections (hibernating) | $0.00 |
| DO wakeup per broadcast | $0.15 / million |
| Worker invocations (emit trigger) | $0.30 / million |
| KV reads (queryLabels) | $0.50 / million |
| **1M edits/day total** | **< $1/day** |

### Endpoints

| Method | Path                                      | Purpose                                            |
| ------ | ----------------------------------------- | -------------------------------------------------- |
| `GET`  | `/xrpc/com.atproto.label.subscribeLabels` | WS upgrade → hibernating DO connection             |
| `POST` | `/emit`                                   | Extension triggers label broadcast (authenticated) |
| `GET`  | `/xrpc/com.atproto.label.queryLabels`     | Backfill / history (optional, KV-backed)           |
| `GET`  | `/.well-known/did.json`                   | DID document for labeler identity                  |
| `GET`  | `/xrpc/app.bsky.labeler.getServices`      | Labeler service declaration                        |
| `GET`  | `/health`                                 | Health check                                       |

### Labeler DID

Uses `did:web` with the domain serving the Worker:

```json
{
  "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/secp256k1-2019/v1"],
  "id": "did:web:labeler.skeeditor.app",
  "verificationMethod": [
    {
      "id": "did:web:labeler.skeeditor.app#atproto_label",
      "type": "EcdsaSecp256k1VerificationKey2019",
      "controller": "did:web:labeler.skeeditor.app",
      "publicKeyMultibase": "<base58-encoded-secp256k1-public-key>"
    }
  ],
  "service": [
    {
      "id": "#atproto_labeler",
      "type": "AtprotoLabeler",
      "serviceEndpoint": "https://labeler.skeeditor.app"
    }
  ]
}
```

The signing private key is stored in a Cloudflare Worker secret (`LABELER_SIGNING_KEY`).

### Wire Protocol

Labels are emitted as JSON frames on the WebSocket for extension clients.
Proper DAG-CBOR framing (ATProto spec-compliant) is a Phase 2 concern for
AppView compatibility.

Frame format:

```jsonc
{
  "op": 1,
  "t": "#labels",
  "seq": 12345,
  "labels": [
    {
      "ver": 1,
      "src": "did:web:labeler.skeeditor.app",
      "uri": "at://did:plc:xxx/app.bsky.feed.post/rkey",
      "cid": "bafyrei...",
      "val": "edited",
      "cts": "2026-03-27T12:00:00.000Z",
    },
  ],
}
```

### Emit Authentication

The extension must prove it is acting on behalf of the DID that owns the post
being labeled.

**Implemented: Bearer JWT with cryptographic verification**

The extension sends the user's ATProto access JWT in `Authorization: Bearer <token>`.
The labeler worker:

1. Parses the JWT and decodes the `sub` claim (the authenticated DID).
2. Verifies `sub` matches the `did` field in the emit body.
3. Verifies `sub` matches the repo component of the `uri` AT URI.
4. Resolves the subject DID to its PDS endpoint:
   - `did:plc` → queries `https://plc.directory/{did}` for the DID document.
   - `did:web` → queries `https://{domain}/.well-known/did.json`.
     Locates the `#atproto_pds` service entry to find the PDS URL.
5. Calls `GET {pds}/xrpc/com.atproto.server.getSession` with the bearer token.
   The PDS cryptographically verifies the JWT signature. A forged or tampered
   token is rejected with a 4xx response, which the labeler treats as auth failure.
6. Verifies the returned session DID matches the JWT `sub` claim before accepting
   the emit request.

This means a token accepted by the labeler is guaranteed to have been issued and
signed by the subject's own PDS — forged or tampered tokens are rejected at step 5.

### Durable Object: `BroadcastHub`

Single global instance (`id = "global"`). All WebSocket clients connect to it.

```
WebSocket lifecycle (Cloudflare Hibernation API):
  - ws.accept() → connection stored; DO can sleep
  - webSocketMessage(ws, msg) → parse cursor/ping; DO wakes briefly
  - webSocketClose(ws) → remove connection; DO sleeps
  - broadcast(label) → DO wakes; iterates this.getWebSockets(); sends to each; sleeps
```

Attachment on each WS (accessible after hibernation wakes):

```typescript
ws.serializeAttachment({ cursor: number, connectedAt: string });
```

### KV Schema (queryLabels, optional)

Key: `label:<uri>:<seq>`
Value: serialized label JSON

Cursor-based pagination via KV list prefix scan.

---

## Component 2 — Extension Changes

### New Message Types

```typescript
// content-script → background
{ type: 'SUBSCRIBE_LABELS' }
{ type: 'UNSUBSCRIBE_LABELS' }

// background → content-script (broadcast)
{ type: 'LABEL_EVENT', labels: LabelFrame['labels'] }

// Existing, reused for re-fetch
{ type: 'GET_RECORD', repo, collection, rkey }
```

### 2a — Service Worker: Persistent WebSocket

File: `src/background/label-subscriber.ts` (new)

Lifecycle:

1. On SW `install` / `activate`: open WS to labeler `subscribeLabels`.
2. On label frame received: extract `uri`, parse AT URI → `{repo, collection, rkey}`,
   broadcast `LABEL_EVENT` to all extension tabs via `chrome.tabs.sendMessage`.
3. On WS close/error: exponential backoff reconnect (max 60s).
4. Keep-alive: send ping frame every 30s to prevent hibernation timeout.

```typescript
// src/background/label-subscriber.ts
export function startLabelSubscriber(labelerWsUrl: string): () => void {
  // returns cleanup fn
}
```

Called from `src/background/service-worker.ts` on startup.

### 2b — Content Script: Handle LABEL_EVENT

File: `src/content/content-script.ts`

On receiving `LABEL_EVENT`:

1. For each label in the frame, parse `uri` → `rkey`.
2. Find matching post element in DOM by rkey (already tracked by `findPosts`).
3. Send `GET_RECORD` message to background → get latest record from PDS.
4. Call `updatePostText(element, record.text)`.
5. Call `markPostAsEdited(element)` (idempotent — checks for existing badge).

### 2c — Settings: Labeler URL

Add `labelerUrl` to extension settings (default: `wss://labeler.skeeditor.app`).
Users can point to a self-hosted instance.

File: `src/shared/constants.ts` — add `LABELER_WS_URL` constant.

### 2d — Emit Trigger on Save

File: `src/background/message-router.ts`

After `PUT_RECORD_SUCCESS`, fire-and-forget POST to `/emit`:

```typescript
// Non-blocking — edit success does not depend on labeler availability
void emitLabelTrigger({
  uri: writeResponse.uri,
  cid: writeResponse.cid,
  did: stored.did,
  accessJwt: stored.accessToken,
});
```

Errors are logged but do not surface to the user. The real-time update is
a best-effort enhancement — the firehose still propagates the edit regardless.

---

## Implementation Phases

### Phase 1 — Labeler MVP (this plan)

- [ ] `packages/labeler` scaffolded with Wrangler + TypeScript
- [ ] `BroadcastHub` Durable Object with WebSocket hibernation
- [ ] `/xrpc/com.atproto.label.subscribeLabels` endpoint (JSON frames)
- [ ] `/emit` endpoint with Bearer JWT auth (Option A)
- [ ] `/.well-known/did.json` serving DID document
- [ ] `/health` endpoint
- [ ] Extension `label-subscriber.ts` — persistent WS in service worker
- [ ] Extension `LABEL_EVENT` handler in content script
- [ ] Extension emit trigger after `PUT_RECORD_SUCCESS`
- [ ] Settings: `labelerUrl` configurable

### Phase 2 — Hardening

- [ ] DAG-CBOR framing for spec-compliant `subscribeLabels` (AppView compatibility)
- [ ] Label signing with secp256k1 key (`#atproto_label`)
- [ ] DPoP emit authentication (Option B)
- [ ] `/xrpc/com.atproto.label.queryLabels` with KV backfill
- [ ] `/xrpc/app.bsky.labeler.getServices` declaration
- [ ] Rate limiting on `/emit` (per-DID, Cloudflare rate limiting rules)
- [ ] Cursor-based reconnect (extension sends `?cursor=<seq>` on reconnect)

### Phase 3 — AppView Integration

- [ ] Register labeler DID publicly
- [ ] Encourage users to subscribe via bsky.app profile → Moderation → Add Labeler
- [ ] AppView will hydrate `edited` labels into post views for all bsky.app users
- [ ] Negotiated `edited` label UI in bsky.app (requires Bluesky cooperation or community adoption)

---

## Security Considerations

- `/emit` must validate that the requesting DID matches the AT URI's repo DID —
  prevents one user from triggering label broadcasts for another user's posts.
- Rate limit `/emit` per DID — prevent label spam / DoS.
- WebSocket clients are unauthenticated (read-only label stream is public per ATProto spec).
- Labeler signing key must be stored as a Cloudflare secret, never in code.
- Labels carry no post content — only `uri` and `val: "edited"`. Privacy preserved.

---

## File Map

```
packages/labeler/
  package.json              # name: @skeeditor/labeler
  tsconfig.json
  wrangler.jsonc            # Cloudflare Workers config
  src/
    index.ts                # Worker fetch handler (routing)
    broadcast-hub.ts        # Durable Object
    types.ts                # Label, Frame, EmitPayload types
    auth.ts                 # Bearer JWT validation
    did-document.ts         # Serves /.well-known/did.json

src/ (extension, existing files modified)
  background/
    service-worker.ts       # Call startLabelSubscriber()
    label-subscriber.ts     # NEW: persistent WS + reconnect
    message-router.ts       # Add emitLabelTrigger() after PUT_RECORD_SUCCESS
  content/
    content-script.ts       # Add LABEL_EVENT handler
  shared/
    constants.ts            # Add LABELER_WS_URL
    messages.ts             # Add SUBSCRIBE_LABELS, LABEL_EVENT types
```
