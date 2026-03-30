# XRPC Client

`XrpcClient` (`src/shared/api/xrpc-client.ts`) wraps the `@atproto/lex` `Client` to provide a typed interface for the two XRPC operations used by Skeeditor: fetching and writing `app.bsky.feed.post` records.

All XRPC calls are made from the background service worker. Content scripts and the popup communicate with the background via [typed messages](./messages) — they never call `XrpcClient` directly.

---

## Configuration

```ts
import { XrpcClient } from "@src/shared/api/xrpc-client";

const client = new XrpcClient({
  service: "https://bsky.social", // PDS base URL
  did: "did:plc:alice", // Authenticated user's DID (optional for unauth reads)
  accessJwt: "<token>", // Access token from SessionStore
});
```

`XrpcClientConfig`:

```ts
interface XrpcClientConfig {
  service: string; // PDS URL, e.g. 'https://bsky.social'
  did?: string; // Authenticated DID for write operations
  accessJwt?: string; // OAuth access token; required for putRecord
}
```

> **DID validation:** If `did` is provided, it must match `/^did:[a-z]+:.+$/u`. The constructor throws `XrpcClientError('Invalid DID format')` if this check fails.

---

## `getRecord`

Fetches a single AT Protocol record.

```ts
const result = await client.getRecord({
  repo: "did:plc:alice",
  collection: "app.bsky.feed.post",
  rkey: "3jxyz",
});

console.log(result.cid); // CID string — use as swapRecord for the subsequent put
console.log(result.value.text); // Record fields
```

Types:

```ts
interface GetRecordParams {
  repo: string;
  collection: string;
  rkey: string;
}

interface GetRecordResult {
  value: Record<string, unknown>;
  cid: string;
}
```

Throws `XrpcClientError` on network or PDS errors.

---

## `putRecordWithSwap`

Writes a record with an **optimistic concurrency check**. The PDS compares `swapRecord` (the CID you last read) against the current record. If they differ, the write is rejected with HTTP 409.

```ts
const result = await client.putRecordWithSwap({
  repo: 'did:plc:alice',
  collection: 'app.bsky.feed.post',
  rkey: '3jxyz',
  record: {
    $type: 'app.bsky.feed.post',
    text: 'edited text',
    facets: [...],
    createdAt: '2024-01-01T00:00:00.000Z', // preserve the original
  },
  swapRecord: result.cid,  // CID from getRecord
  validate: true,          // default; asks PDS to validate against Lexicon schema
});

if (result.success) {
  console.log('Written. New CID:', result.cid);
} else {
  switch (result.error.kind) {
    case 'conflict':
      // result.conflict?.currentCid and currentValue are available
      break;
    case 'auth':
      // Re-authenticate
      break;
    case 'validation':
      // Fix the record before retrying
      break;
    case 'network':
      // Retry with backoff
      break;
  }
}
```

Types:

```ts
type PutRecordWithSwapErrorKind =
  | "auth"
  | "conflict"
  | "network"
  | "validation";

interface PutRecordWithSwapError {
  kind: PutRecordWithSwapErrorKind;
  message: string;
  status?: number;
}

interface PutRecordConflictDetails {
  currentCid: string;
  currentValue: Record<string, unknown>;
}

type PutRecordWithSwapResult =
  | { success: true; uri: string; cid: string }
  | {
      success: false;
      error: PutRecordWithSwapError;
      conflict?: PutRecordConflictDetails;
    };
```

---

## `buildThreeWayMergeAdvisory`

When a conflict occurs and you have all three versions of a record (original, current server, local edits), this utility classifies each top-level field:

```ts
import { buildThreeWayMergeAdvisory } from "@src/shared/api/xrpc-client";

const advisory = buildThreeWayMergeAdvisory(base, current, attempted);

advisory.hasConflicts; // boolean — true if any field changed in both server and local
advisory.clientChanges; // fields changed only locally
advisory.serverChanges; // fields changed only on server
advisory.sharedChanges; // fields changed identically in both
advisory.conflictingFields; // fields changed differently in both — require user decision
```

`PutRecordMergeAdvisory`:

```ts
interface PutRecordMergeAdvisory {
  hasConflicts: boolean;
  clientChanges: string[];
  serverChanges: string[];
  sharedChanges: string[];
  conflictingFields: string[];
}
```

---

## Error class: `XrpcClientError`

All XRPC errors thrown by `getRecord` are instances of `XrpcClientError`:

```ts
class XrpcClientError extends Error {
  public readonly status: number | undefined;
  public override readonly cause?: unknown;
}
```

The `status` field is the HTTP status code from the PDS response, if available. Always catch `XrpcClientError` specifically rather than catching all errors — it lets you distinguish XRPC failures from programming errors.
