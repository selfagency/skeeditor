# putRecord conflict handling

Use `XrpcClient.putRecordWithSwap()` for edit flows that need optimistic concurrency.

## Recommended UI flow

1. Load the original record and keep both its `cid` and full record value.
2. Submit edits with `swapRecord` set to the original `cid`.
3. If the result is successful, trust the returned `{ uri, cid }` as the authoritative write result.
4. If the result contains `error.kind === 'conflict'`, current UI should:
   - show the user that the post changed on the server
   - display a warning that instructs reloading and retrying from the latest state
   - avoid silent overwrite or automatic retry

## Three-way merge advisory

When the caller has all three records available:

- base/original record
- current/latest server record
- attempted/local edited record

use `buildThreeWayMergeAdvisory(base, current, attempted)` to classify fields into:

- `clientChanges`
- `serverChanges`
- `sharedChanges`
- `conflictingFields`

### Optional future behavior

- If `hasConflicts === false`, a future UI may auto-merge the records and retry.
- If `hasConflicts === true`, a future UI may present conflicting fields and ask the user to resolve them explicitly.
- Never discard server-side changes without explicit user confirmation.

## Error handling recommendations

- `validation`: show a fix-the-input message and do not retry automatically.
- `auth`: prompt the user to re-authenticate.
- `network`: allow retry with backoff and preserve the draft locally.
- `conflict`: show warning-only guidance to reload and retry manually.
