# putRecord conflict handling

Use `XrpcClient.putRecordWithSwap()` for edit flows that need optimistic concurrency.

## Recommended UI flow

1. Load the original record and keep both its `cid` and full record value.
2. Submit edits with `swapRecord` set to the original `cid`.
3. If the result is successful, trust the returned `{ uri, cid }` as the authoritative write result.
4. If the result contains `error.kind === 'conflict'`, fetch-latest UI should:
   - show the user that the post changed on the server
   - inspect `conflict.currentCid` and `conflict.currentValue`
   - compare the original record, latest server record, and attempted local edit
   - retry only after the user confirms the merged content

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

### Recommended behavior

- If `hasConflicts === false`, the UI may auto-merge the records and retry.
- If `hasConflicts === true`, the UI should present the conflicting fields to the user and avoid silent overwrite.
- Never discard server-side changes without explicit user confirmation.

## Error handling recommendations

- `validation`: show a fix-the-input message and do not retry automatically.
- `auth`: prompt the user to re-authenticate.
- `network`: allow retry with backoff and preserve the draft locally.
- `conflict`: show compare/retry UI and require explicit user action.
