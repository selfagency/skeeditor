# Message Protocol

Typed message protocol for communication between the extension's content scripts, popup, and background service worker.

## Overview

All cross-context communication goes through `browser.runtime.sendMessage`. The `sendMessage` helper in `src/shared/messages.ts` provides compile-time type safety: the TypeScript return type is automatically narrowed to the response expected for the given request variant.

## Usage

### In the popup or a Web Component

```typescript
import { sendMessage } from '../shared/messages';

// Check auth status
const status = await sendMessage({ type: 'AUTH_GET_STATUS' });
if (status.authenticated) {
  console.log('Signed in as', status.did);
}

// Trigger sign-in
await sendMessage({ type: 'AUTH_SIGN_IN' });

// Sign out
await sendMessage({ type: 'AUTH_SIGN_OUT' });
```

### In a content script

```typescript
import { sendMessage } from '../shared/messages';

// Fetch a record
const response = await sendMessage({
  type: 'GET_RECORD',
  repo: 'did:plc:alice',
  collection: 'app.bsky.feed.post',
  rkey: '3jxyz',
});
if ('error' in response) {
  console.error('Fetch failed:', response.error);
} else {
  console.log('Record CID:', response.cid);
}

// Update a record with optimistic concurrency
const result = await sendMessage({
  type: 'PUT_RECORD',
  repo: 'did:plc:alice',
  collection: 'app.bsky.feed.post',
  rkey: '3jxyz',
  record: { $type: 'app.bsky.feed.post', text: 'edited text' },
  swapRecord: response.cid, // fail if server state has diverged
});
if ('error' in result) {
  console.error('Update failed:', result.error);
}
```

## Message Catalogue

| Request `type` | Payload fields | Response type |
| --- | --- | --- |
| `AUTH_SIGN_IN` | — | `{ ok: true }` |
| `AUTH_SIGN_OUT` | — | `{ ok: true }` |
| `AUTH_REAUTHORIZE` | — | `{ ok: true }` |
| `AUTH_GET_STATUS` | — | `{ authenticated: false }` or `{ authenticated: true, did, expiresAt }` |
| `GET_RECORD` | `repo`, `collection`, `rkey` | `{ value, cid }` or `{ error }` |
| `PUT_RECORD` | `repo`, `collection`, `rkey`, `record`, `swapRecord?` | `{ uri, cid }` or `{ error }` |

## Adding a new message type

1. Add a request interface and response type to `src/shared/messages.ts`.
2. Extend the `MessageRequest` union.
3. Add a branch to the `ResponseFor<T>` conditional type.
4. Handle the new message type in the background message router (`src/background/message-router.ts` — see `skeeditor-noiw`).
5. Add unit tests for the new branch.
