# Labeler Services

skeeditor operates its own AT Protocol labeler service that applies an **"edited"** label to posts the user has edited through the extension. This lets other users see at a glance that a post has been modified.

---

## Overview

After a user edits a post, skeeditor writes the updated record to their PDS and simultaneously has the labeler service apply an `edited` label to that AT-URI. Users who have subscribed to the skeeditor labeler will see a badge on edited posts in the Bluesky app.

---

## Labeler account

| Property | Value |
| --- | --- |
| Handle | `@skeeditor.link` |
| DID | `did:plc:m6h36r2hzbnozuhxj4obhkyb` |
| Deployed at | `https://labeler.skeeditor.link` |

The DID is exported from `src/shared/constants.ts` as `LABELER_DID`.

---

## Cloudflare Worker (`packages/labeler/`)

The labeler service runs as a [Cloudflare Worker](https://workers.cloudflare.com/), deployed via [Wrangler](https://developers.cloudflare.com/workers/wrangler/). The source lives in `packages/labeler/src/`.

### Key files

| File | Purpose |
| --- | --- |
| `src/index.ts` | Worker entry point — handles incoming HTTP requests |
| `src/auth.ts` | DID authentication and request verification |
| `src/hub.ts` | `BroadcastHub` Durable Object — tracks active subscriptions |
| `src/label.ts` | Label creation and signing |
| `src/did-document.ts` | DID document resolution |
| `src/types.ts` | Shared TypeScript types |

### Bindings (wrangler.jsonc)

| Binding | Kind | Purpose |
| --- | --- | --- |
| `LABELS_KV` | KV Namespace | Stores signed label records |
| `BROADCAST_HUB` | Durable Object | Manages WebSocket listener fan-out |

### Environment variables

| Variable | Value |
| --- | --- |
| `LABELER_DID` | `did:plc:m6h36r2hzbnozuhxj4obhkyb` |
| `LABELER_HANDLE` | `skeeditor.link` |

---

## Labeler subscription flow

Subscribing to the labeler is optional. On first sign-in, the extension checks whether the user has already subscribed and shows a **consent dialog** in the popup if they have not.

```text
AUTH_CALLBACK completes successfully
  │
  ▼
Background: sends CHECK_LABELER_SUBSCRIPTION message to itself
  → calls checkAndScheduleLabelerPrompt()
  → fetches the user's labeler preferences from the PDS
  │
  ├── User already subscribed → no UI shown
  │
  └── User not subscribed → sets a flag in extension storage
        │
        ▼
      Popup next opens → sees flag → shows consent dialog
        │
        ├── User accepts → extension adds LABELER_DID to user's labeler preferences
        │
        └── User declines → flag cleared, user subscribed to nothing
```

The `CHECK_LABELER_SUBSCRIPTION` message is fire-and-forget from the perspective of the popup. A network error during the check is silently swallowed — it must never block or delay the sign-in flow.

---

## Label structure

Labels applied by the skeeditor labeler follow the AT Protocol label specification:

```ts
{
  src: "did:plc:m6h36r2hzbnozuhxj4obhkyb",  // labeler DID
  uri: "at://did:plc:alice/app.bsky.feed.post/3jxyz",  // labeled post
  cid: "<post-cid>",         // CID of the version being labeled
  val: "edited",             // label value
  cts: "2025-01-01T00:00:00.000Z",  // creation timestamp
}
```

---

## Deploying the labeler worker

```sh
cd packages/labeler

# Create KV namespaces (first time only)
wrangler kv namespace create LABELS_KV
wrangler kv namespace create LABELS_KV --preview
# → copy the returned IDs into wrangler.jsonc

# Deploy
wrangler deploy
```

The custom domain `labeler.skeeditor.link` is configured as a route in `wrangler.jsonc` and must be set up in the Cloudflare dashboard.

---

## Resources

- [AT Protocol label specification](https://atproto.com/specs/label)
- [Bluesky moderation documentation](https://docs.bsky.app/docs/advanced-guides/moderation)
- [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
