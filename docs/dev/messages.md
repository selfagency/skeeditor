# Message Protocol

All cross-context communication in skeeditor (content script ↔ background, popup ↔ background) goes through `browser.runtime.sendMessage`.

---

## Typed message system (`src/shared/messages.ts`)

The module exports:

- A `MessageRequest` discriminated union — all valid message shapes.
- A `ResponseFor<T>` conditional type — maps each request variant to its response type.
- A `sendMessage<T>(request: T): Promise<ResponseFor<T>>` helper that wraps `browser.runtime.sendMessage` with correct TypeScript inference.

TypeScript enforces the request/response contract at compile time. You cannot call `sendMessage` with a valid request type and receive the wrong response type.

---

## Usage

### Popup or Web Component

```ts
import { sendMessage } from "@src/shared/messages";

// Check auth status
const status = await sendMessage({ type: "AUTH_GET_STATUS" });
if (status.authenticated) {
  console.log("Signed in as", status.did);
}

// Trigger sign-in
await sendMessage({ type: "AUTH_SIGN_IN" });

// Sign out
await sendMessage({ type: "AUTH_SIGN_OUT" });
```

### Content script

```ts
import { sendMessage } from '@src/shared/messages';

// Fetch a post record
const response = await sendMessage({
  type: 'GET_RECORD',
  repo: 'did:plc:alice',
  collection: 'app.bsky.feed.post',
  rkey: '3jxyz',
});

if ('error' in response) {
  console.error('Fetch failed:', response.error);
} else {
  console.log('Got record, CID:', response.cid);
}

// Save edited record with optimistic concurrency
const result = await sendMessage({
  type: 'PUT_RECORD',
  repo: 'did:plc:alice',
  collection: 'app.bsky.feed.post',
  rkey: '3jxyz',
  record: { $type: 'app.bsky.feed.post', text: 'edited text', facets: [...] },
  swapRecord: response.cid,  // reject if record changed on server
});

switch (result.type) {
  case 'PUT_RECORD_SUCCESS':
    console.log('Saved at', result.uri, '— new CID:', result.cid);
    break;
  case 'PUT_RECORD_CONFLICT':
    // Offer the user a merge or retry UI
    break;
  case 'PUT_RECORD_ERROR':
    console.error('Save failed:', result.message);
    break;
}
```

---

## Message catalogue

| Request `type`               | Payload fields                                        | Response type                                                                    |
| ---------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| `AUTH_SIGN_IN`               | `pdsUrl?`                                             | `{ ok: true }`                                                                   |
| `AUTH_SIGN_OUT`              | —                                                     | `{ ok: true }`                                                                   |
| `AUTH_REAUTHORIZE`           | `pdsUrl?`                                             | `{ ok: true }`                                                                   |
| `AUTH_GET_STATUS`            | —                                                     | `{ authenticated: false }` or `{ authenticated: true, did, handle?, expiresAt }` |
| `AUTH_CALLBACK`              | `code`, `state`                                       | `{ ok: true }` or `{ error }`                                                    |
| `AUTH_LIST_ACCOUNTS`         | —                                                     | `{ accounts: AuthListAccountsAccount[] }`                                        |
| `AUTH_SWITCH_ACCOUNT`        | `did`                                                 | `{ ok: true }` or `{ error }`                                                    |
| `AUTH_SIGN_OUT_ACCOUNT`      | `did`                                                 | `{ ok: true }` or `{ error }`                                                    |
| `GET_SETTINGS`               | —                                                     | `ExtensionSettings` or `{ error }`                                               |
| `SET_SETTINGS`               | `settings: ExtensionSettings`                         | `{ ok: true }` or `{ error }`                                                    |
| `GET_RECORD`                 | `repo`, `collection`, `rkey`                          | `{ value, cid }` or `{ error }`                                                  |
| `CREATE_RECORD`              | `repo`, `collection`, `record`, `rkey?`, `validate?`  | See CREATE_RECORD responses below                                                |
| `PUT_RECORD`                 | `repo`, `collection`, `rkey`, `record`, `swapRecord?` | See PUT_RECORD responses below                                                   |
| `UPLOAD_BLOB`                | `data: Blob \| File`, `repo`                          | `{ blobRef, mimeType }` or `{ error }`                                           |
| `SET_PDS_URL`                | `url`                                                 | `{ ok: true }` or `{ error }`                                                    |
| `GET_PDS_URL`                | —                                                     | `{ url: string }` or `{ error }`                                                 |
| `CHECK_LABELER_SUBSCRIPTION` | —                                                     | `{ ok: true }` or `{ error }`                                                    |

### AUTH_LIST_ACCOUNTS response shape

```ts
interface AuthListAccountsAccount {
  did: string;
  handle?: string;      // may be absent if handle resolution failed
  expiresAt: number;    // Unix timestamp (ms) when the access token expires
  isActive: boolean;    // true for the currently active account
}
```

### ExtensionSettings shape

```ts
interface ExtensionSettings {
  editTimeLimit: number | null;  // minutes (0.5–5), or null to disable the time limit
}
```

### CREATE_RECORD response shapes

```ts
// Record created successfully
{ type: 'CREATE_RECORD_SUCCESS'; uri: string; cid: string }

// Auth failure, validation error, or unexpected XRPC error
{ type: 'PUT_RECORD_ERROR'; message: string; requiresReauth?: boolean }
```

`rkey` is optional; when omitted the PDS assigns a TID automatically. `validate` (default `true`) controls whether the PDS validates the record against the Lexicon schema.

### PUT_RECORD response shapes

```ts
// Write accepted by the PDS
{ type: 'PUT_RECORD_SUCCESS'; uri: string; cid: string }

// swapRecord CID did not match the current server CID (HTTP 409)
{ type: 'PUT_RECORD_CONFLICT'; error: PutRecordWithSwapError; conflict?: PutRecordConflictDetails }

// Auth failure, validation error, or unexpected XRPC error
{ type: 'PUT_RECORD_ERROR'; message: string }
```

`PutRecordConflictDetails` is populated when the PDS returns the current record in the 409 error body:

```ts
interface PutRecordConflictDetails {
  currentCid: string;
  currentValue: Record<string, unknown>;
}
```

---

## Payload validation

The background message router validates all incoming payloads before any XRPC or auth logic runs:

- `GET_RECORD`: `repo`, `collection`, and `rkey` must be non-empty strings.
- `CREATE_RECORD`: `repo` and `collection` must be non-empty strings; `record` must be a non-null object with a non-empty `$type` string.
- `PUT_RECORD`: same string checks as GET_RECORD, plus `record` must be a non-null object with a non-empty `$type` string.

Invalid payloads return an error response immediately without touching the network.

---

## Adding a new message type

1. Add a request interface (e.g. `MyNewRequest`) and response type to `src/shared/messages.ts`.
2. Extend the `MessageRequest` union to include `MyNewRequest`.
3. Add a branch to the `ResponseFor<T>` conditional type: `T extends MyNewRequest ? MyNewResponse : ...`.
4. Add a payload validator function in `src/background/message-router.ts` (`isValidMyNewPayload`).
5. Add a `case 'MY_NEW_TYPE':` branch in the message router switch that calls the validator and invokes the appropriate logic.
6. Write unit tests for: happy path, unauthenticated path, and all invalid payload shapes.
