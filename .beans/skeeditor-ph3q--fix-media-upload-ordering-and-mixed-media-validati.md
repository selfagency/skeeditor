---
# skeeditor-ph3q
title: Fix media upload ordering and mixed-media validation
status: completed
type: bug
priority: high
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T20:16:41Z
parent: skeeditor-d3m1
branch: fix/ph3q-media-upload-ordering
---

Media uploads currently depend on selection order and can mis-map uploaded blobs to embeds. Enforce valid media combinations and ensure blob assignment always matches the embed placeholders.

## Todo
- [x] Add failing tests for image-only, video-only, and mixed-media cases
- [x] Reject unsupported mixed-media or over-limit selections in the UI
- [x] Preserve deterministic blob-to-embed ordering
- [x] Verify upload success and user-facing error handling
- [x] Run relevant unit and integration tests

## Summary of Changes
- Added failing tests in `test/unit/content/post-editor.test.ts` for image-only, video-only, mixed-media, over-limit image count, and multi-video selection cases.
- Added failing tests in `test/unit/content/edit-modal.test.ts` to verify UI rejection for mixed media, more than 4 images, and more than 1 video.
- Implemented shared media normalization/validation in `src/content/post-editor.ts` via `normalizeMediaFiles`:
  - reject mixed image+video selections,
  - enforce max 4 images,
  - enforce max 1 video,
  - preserve deterministic file ordering for embed placeholders.
- Updated `src/content/edit-modal.ts` to validate combined existing+new media selections with `normalizeMediaFiles` and surface user-facing errors instead of silently accepting invalid mixes.
- Verified with:
  - `test/unit/content/post-editor.test.ts`
  - `test/unit/content/edit-modal.test.ts`
  - `test/unit/content/content-script.test.ts`
  - `task typecheck`
