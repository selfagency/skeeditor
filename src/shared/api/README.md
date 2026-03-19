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

## `xrpc-client.ts`

Use the XRPC client wrapper for authenticated record reads/writes against the PDS.

### Core APIs

- `new XrpcClient({ service, did?, accessJwt? })`
- `client.getRecord({ repo, collection, rkey })`
- `client.putRecord({ repo, collection, rkey, record, swapRecord?, validate? })`
- `client.putRecordWithSwap({ repo, collection, rkey, record, swapRecord, validate? })`

### `putRecordWithSwap` result shapes

- Success: `{ success: true, uri, cid }`
- Conflict: `{ success: false, error: { kind: 'conflict', ... }, conflict: { currentCid, currentValue } }`
- Validation/auth/network failures: `{ success: false, error: { kind: 'validation' | 'auth' | 'network', ... } }`

### Read-after-write guidance

- Use `putRecordWithSwap` in UI edit flows where optimistic concurrency matters.
- On conflict, inspect `conflict.currentCid` / `conflict.currentValue` and prompt the user to compare against the latest server state before retrying.
- After a successful write, treat the returned `{ uri, cid }` as the authoritative write result for follow-up UI state; only issue a fresh `getRecord` when the caller needs the latest normalized server value for re-rendering or merge decisions.
