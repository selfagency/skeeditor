# Shared API helpers

## `at-uri.ts`

Use the AT URI helpers to normalize post references from raw AT URIs, Bluesky web URLs, or DOM elements already discovered by the content script.

### Examples

- `parseAtUri('at://did:plc:alice/app.bsky.feed.post/3kq2abc')`
- `parseBskyPostUrl('https://bsky.app/profile/alice.test/post/3kq2abc')`
- `parseAtUriFromElement(postElement)`

All helpers return a normalized object with:

- `uri`
- `repo`
- `collection`
- `rkey`

---

## `xrpc-client.ts`

A thin, testable wrapper around the `@atproto/lex` `Client` that provides typed helpers for the two XRPC operations the extension needs: **`getRecord`** and **`putRecord`**.

All errors are normalized to `XrpcClientError`, which carries an optional HTTP `status` code and preserves the original error as `cause`.

### Construction

```ts
import { XrpcClient } from '../shared/api/xrpc-client';

// Unauthenticated (read-only operations)
const client = new XrpcClient({ service: 'https://bsky.social' });

// Authenticated session (required for putRecord)
const client = new XrpcClient({
  service: 'https://bsky.social',
  did: session.did,
  accessJwt: session.accessJwt,
});
```

### `getRecord(params) → Promise<{ value, cid }>`

Fetches a single AT Protocol record from the PDS. Returns the record `value` and its current CID. Always capture the CID so you can pass it as `swapRecord` when writing back.

```ts
const { value, cid } = await client.getRecord({
  repo: 'did:plc:alice',
  collection: 'app.bsky.feed.post',
  rkey: '3kq2abc',
});
```

### `putRecord(params) → Promise<{ uri, cid }>`

Writes a record to the PDS. Pass `swapRecord` (the CID returned by the preceding `getRecord`) to enable optimistic concurrency — the server will reject the write with HTTP 409 if the record has changed since you read it.

```ts
const { uri, cid } = await client.putRecord({
  repo: 'did:plc:alice',
  collection: 'app.bsky.feed.post',
  rkey: '3kq2abc',
  record: { ...value, text: 'Edited text', $type: 'app.bsky.feed.post' },
  swapRecord: cid, // optimistic concurrency
});
```

### `XrpcClientError`

All thrown errors are instances of `XrpcClientError extends Error`:

| Property  | Type                  | Description                                            |
| --------- | --------------------- | ------------------------------------------------------ |
| `message` | `string`              | Human-readable description                             |
| `status`  | `number \| undefined` | HTTP status code when available (e.g. 404, 409)        |
| `cause`   | `unknown`             | Original `@atproto/lex` error, preserved for debugging |

```ts
import { XrpcClientError } from '../shared/api/xrpc-client';

try {
  await client.putRecord({ ... });
} catch (err) {
  if (err instanceof XrpcClientError) {
    if (err.status === 409) {
      // Conflict: another actor changed the record — re-fetch and retry
    }
  }
}
```

### Content-script → background → client call flow

**Never call `XrpcClient` directly from a content script.** Content scripts cannot safely hold long-lived authenticated sessions. Instead, send a message to the background service worker, which owns the session and the `XrpcClient` instance.

```
┌──────────────────────────────────────────────────────────────┐
│  Content script (bsky.app page)                              │
│                                                              │
│  1. User clicks "Edit post"                                  │
│  2. Content script extracts AT URI from the DOM element      │
│  3. Sends a message to the background:                       │
│     browser.runtime.sendMessage({                            │
│       type: 'GET_RECORD',                                    │
│       repo, collection, rkey                                 │
│     })                                                       │
└────────────────────────┬─────────────────────────────────────┘
                         │  browser.runtime.onMessage
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Background service worker                                   │
│                                                              │
│  4. Message router receives 'GET_RECORD'                     │
│  5. Calls xrpcClient.getRecord({ repo, collection, rkey })   │
│  6. Returns { value, cid } (or serialized XrpcClientError)   │
│     back to the content script via sendResponse              │
└──────────────────────────────────────────────────────────────┘
```

The same pattern applies to `PUT_RECORD`. The content script sends the updated record plus the `swapRecord` CID; the background calls `xrpcClient.putRecord(...)` and returns the result.
