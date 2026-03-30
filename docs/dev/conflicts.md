# Conflict Handling

When you edit a post, Skeeditor fetches the current record and holds its CID. When you click Save, it writes the new record using `putRecordWithSwap` — which instructs the PDS to reject the write if the record has changed since you fetched it.

This prevents silent data loss when a post is edited from two places simultaneously (e.g. two browser sessions, or another app).

---

## How conflicts are detected

Skeeditor passes `swapRecord: <original-cid>` in the `PUT_RECORD` message. The PDS returns HTTP 409 if the record's current CID no longer matches. `XrpcClient.putRecordWithSwap` maps this to:

```ts
{ success: false, error: { kind: 'conflict', ... }, conflict?: { currentCid, currentValue } }
```

The background router returns this to the content script as:

```ts
{ type: 'PUT_RECORD_CONFLICT', error: ..., conflict?: { currentCid, currentValue } }
```

The content script currently displays a conflict warning message in the edit modal and does not auto-retry.

---

## Recommended UI flow

1. Fetch the original record; store both its `cid` and full `value`.
2. Open the edit modal pre-filled with the original text.
3. User edits; click Save.
4. Submit with `swapRecord` set to the original `cid`.
5. On success: close modal, update the post DOM.
6. On `PUT_RECORD_CONFLICT`, follow this behavior.

- Show the user that the post changed on the server.
- Keep the modal open and show a warning instructing the user to reload the post/page and retry the edit from the latest server state.
- Do not silently overwrite server-side changes.

---

## Optional future enhancement: three-way merge advisory

When all three versions are available, `buildThreeWayMergeAdvisory` classifies each top-level field:

```ts
import { buildThreeWayMergeAdvisory } from '@src/shared/api/xrpc-client';

const advisory = buildThreeWayMergeAdvisory(
  originalRecord, // what we had when the editor opened
  currentServerRecord, // result.conflict.currentValue
  localEditedRecord, // what the user typed
);

if (!advisory.hasConflicts) {
  // Safe to auto-merge: apply client changes on top of the server record and retry
  const merged = { ...currentServerRecord, ...buildLocalChanges(advisory) };
  await retryPutRecord(merged, result.conflict.currentCid);
} else {
  // Genuinely conflicting fields — show them to the user
  showConflictUI(advisory.conflictingFields, currentServerRecord, localEditedRecord);
}
```

`PutRecordMergeAdvisory`:

```ts
interface PutRecordMergeAdvisory {
  hasConflicts: boolean;
  clientChanges: string[]; // fields changed only locally
  serverChanges: string[]; // fields changed only on the server
  sharedChanges: string[]; // fields changed identically in both
  conflictingFields: string[]; // fields changed differently in both
}
```

**Never discard server-side changes without explicit user confirmation.**

---

## Error handling by kind

- `conflict`: Show warning, require reload + explicit retry from latest state.
- `validation`: Show a fix-the-input message; do not retry automatically.
- `auth`: Prompt the user to re-authenticate via the popup.
- `network`: Allow retry with backoff and preserve the draft locally.

---

## Example: current conflict UI behavior

```ts
import { sendMessage } from '@src/shared/messages';

const result = await sendMessage({
  type: 'PUT_RECORD',
  repo,
  collection,
  rkey,
  record: editedRecord,
  swapRecord: originalCid,
});

if (result.type === 'PUT_RECORD_CONFLICT') {
  showError('This post changed while you were editing. Please reload and try again.');
  return;
}
```
