---
# skeeditor-rx2q
title: Fix media upload and stale edit display issues
status: completed
type: fix
priority: high
created_at: 2026-03-30T05:25:28Z
updated_at: 2026-03-30T05:32:41Z
---

---
branch: fix/rx2q-media-upload-blob
---

## Problem

Three user-reported issues after editing a post:

### 1. Media upload fails — "Invalid UPLOAD_BLOB payload" (BUG — fixable)
`isUploadBlobPayload()` uses `instanceof Blob` / `instanceof File` to validate the UPLOAD_BLOB message payload. This check fails because `browser.runtime.sendMessage()` transfers `File`/`Blob` objects across extension contexts (content script → service worker), and the `Blob` constructor in each realm is different, causing `instanceof` to return `false`.

**Fix**: Serialize File/Blob to `{arrayBuffer: ArrayBuffer, mimeType: string, name?: string}` in the content script before sending, reconstruct as `Blob` in the service worker.

### 2. Edited text appears on feed but not on permalink page (EXPECTED DELAY)
The extension fetches edited text from Slingshot only when the "Edited" badge (`button[aria-label="Edited"]`) is already visible. This badge relies on the labeler propagating the edit label, which takes a few seconds. The extension already has the correct mechanisms (label push, MutationObserver re-application) — this is Bluesky infrastructure propagation delay.

### 3. Unedited text on the replies page (EXPECTED DELAY)
Same root cause as #2 — replies page only shows updated text after the label propagates.

## Todo

- [ ] Write failing test for UPLOAD_BLOB with ArrayBuffer payload
- [ ] Change `UploadBlobRequest` type: `data: ArrayBuffer`, add `mimeType: string`
- [ ] Update content-script.ts: convert File → ArrayBuffer before sendMessage
- [ ] Update message-router.ts: fix validation, reconstruct Blob from ArrayBuffer
- [ ] Add `@source "./entrypoints/**/*.html"` to global.css (white popup fix from PR #73)
- [ ] Run all tests
- [ ] Commit and push
