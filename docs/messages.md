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

// Update a record with optimistic concurrency (all three response variants)
const result = await sendMessage({
  type: 'PUT_RECORD',
  repo: 'did:plc:alice',
  collection: 'app.bsky.feed.post',
  rkey: '3jxyz',
  record: { $type: 'app.bsky.feed.post', text: 'edited text' },
  swapRecord: response.cid, // fail if server state has diverged
});

switch (result.type) {
  case 'PUT_RECORD_SUCCESS':
    // Write succeeded — result.uri and result.cid reflect the updated record.
    console.log('Saved at', result.uri, '— new CID:', result.cid);
    break;

  case 'PUT_RECORD_CONFLICT':
    // The record was modified on the server since we last read it.
    // result.conflict (when present) contains the server's current value and CID
    // so the UI can offer a merge or retry flow.
    if (result.conflict) {
      const { currentCid, currentValue } = result.conflict;
      console.warn('Conflict — server CID:', currentCid, 'value:', currentValue);
      // Re-submit with swapRecord: currentCid after user resolves the conflict.
    } else {
      console.warn('Conflict detected but server details unavailable.');
    }
    break;

  case 'PUT_RECORD_ERROR':
    // Covers auth failures, validation errors, and unexpected XRPC errors.
    console.error('Save failed:', result.message);
    break;
}
```

## Message Catalogue

### Auth messages

| Request `type`          | Payload fields  | Response type                                                                    |
| ----------------------- | --------------- | -------------------------------------------------------------------------------- |
| `AUTH_SIGN_IN`          | `pdsUrl?`       | `{ ok: true }`                                                                   |
| `AUTH_SIGN_OUT`         | —               | `{ ok: true }`                                                                   |
| `AUTH_REAUTHORIZE`      | `pdsUrl?`       | `{ ok: true }`                                                                   |
| `AUTH_GET_STATUS`       | —               | `{ authenticated: false }` or `{ authenticated: true, did, handle?, expiresAt }` |
| `AUTH_CALLBACK`         | `code`, `state` | `{ ok: true }` or `{ error }`                                                    |
| `AUTH_LIST_ACCOUNTS`    | —               | `{ accounts: AuthListAccountsAccount[] }`                                        |
| `AUTH_SWITCH_ACCOUNT`   | `did`           | `{ ok: true }`                                                                   |
| `AUTH_SIGN_OUT_ACCOUNT` | `did`           | `{ ok: true }`                                                                   |

`AuthListAccountsAccount` is:

```typescript
interface AuthListAccountsAccount {
  did: string;
  handle?: string;
  expiresAt: number;
  isActive: boolean;
}
```

### Settings messages

| Request `type` | Payload fields | Response type                      |
| -------------- | -------------- | ---------------------------------- |
| `GET_SETTINGS` | —              | `ExtensionSettings` or `{ error }` |
| `SET_SETTINGS` | `settings`     | `{ ok: true }` or `{ error }`      |

`ExtensionSettings` is defined in `src/shared/constants.ts`. Currently: `{ editTimeLimit: number | null }`.

### Record messages

| Request `type`  | Payload fields                                        | Response type                                                                  |
| --------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `CREATE_RECORD` | `repo`, `collection`, `record`, `rkey?`, `validate?`  | `CREATE_RECORD_SUCCESS` or `PUT_RECORD_ERROR` (see below)                      |
| `GET_RECORD`    | `repo`, `collection`, `rkey`                          | `{ value, cid }` or `{ error }`                                                |
| `PUT_RECORD`    | `repo`, `collection`, `rkey`, `record`, `swapRecord?` | `PUT_RECORD_SUCCESS`, `PUT_RECORD_CONFLICT`, or `PUT_RECORD_ERROR` (see below) |

### Blob message

| Request `type` | Payload fields | Response type                          |
| -------------- | -------------- | -------------------------------------- |
| `UPLOAD_BLOB`  | `data`, `repo` | `{ blobRef, mimeType }` or `{ error }` |

### PDS URL messages

| Request `type` | Payload fields | Response type                 |
| -------------- | -------------- | ----------------------------- |
| `GET_PDS_URL`  | —              | `{ url }` or `{ error }`      |
| `SET_PDS_URL`  | `url`          | `{ ok: true }` or `{ error }` |

### Labeler messages

| Request `type`               | Payload fields | Response type                 |
| ---------------------------- | -------------- | ----------------------------- |
| `CHECK_LABELER_SUBSCRIPTION` | —              | `{ ok: true }` or `{ error }` |

### PUT_RECORD / CREATE_RECORD response shapes

```typescript
// PUT_RECORD success — write accepted by the PDS
{ type: 'PUT_RECORD_SUCCESS'; uri: string; cid: string }

// PUT_RECORD conflict — swapRecord CID did not match current server CID (HTTP 409)
{ type: 'PUT_RECORD_CONFLICT'; error: PutRecordWithSwapError; conflict?: PutRecordConflictDetails }

// PUT_RECORD / CREATE_RECORD error — auth failure, validation failure, or unexpected XRPC error
// requiresReauth is set when the error is an auth/permission failure requiring re-authentication
{ type: 'PUT_RECORD_ERROR'; message: string; requiresReauth?: boolean }

// CREATE_RECORD success
{ type: 'CREATE_RECORD_SUCCESS'; uri: string; cid: string }
```

`PutRecordConflictDetails` is only present on a conflict response when the server returns the current record in the error body:

```typescript
interface PutRecordConflictDetails {
  currentCid: string;
  currentValue: Record<string, unknown>;
}
```

## Push notifications (background → content scripts)

The background service worker can also push messages to all `bsky.app` content scripts via `browser.tabs.sendMessage`. These are one-way notifications; no response is expected.

| Notification `type` | Payload fields | Description                                                                                                                                                              |
| ------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `LABEL_RECEIVED`    | `uri`          | An `edited` label was received from the labeler WebSocket. `uri` is the AT-URI of the edited post. Content scripts use this to fetch fresh post text and update the DOM. |

## Payload validation

The background router validates incoming message payloads before any XRPC or auth logic runs:

- `GET_RECORD`: `repo`, `collection`, and `rkey` must all be non-empty strings. Returns `{ error: 'Invalid GET_RECORD payload' }` otherwise.
- `PUT_RECORD`: same string checks plus `record` must be a non-null plain object with a non-empty `$type` string. Returns `{ type: 'PUT_RECORD_ERROR', message: 'Invalid PUT_RECORD payload' }` otherwise.

## Adding a new message type

1. Add a request interface and response type to `src/shared/messages.ts`.
2. Extend the `MessageRequest` union.
3. Add a branch to the `ResponseFor<T>` conditional type.
4. Add a payload validator (`isValidXyzPayload`) to `src/background/message-router.ts` and call it at the top of the new `case` branch.
5. Handle the new message type in the background message router switch.
6. Add unit tests for the happy path, the unauthenticated path, and all invalid payload shapes.
