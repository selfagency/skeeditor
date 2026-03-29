---
# skeeditor-bjgg
title: Fix edited post detection and replacement across all Bluesky views
status: completed
type: bug
priority: high
created_at: 2026-03-28T23:22:05Z
updated_at: 2026-03-28T23:33:11Z
---

Edited post replacement is broken across all Bluesky views (feed, notifications, search, etc.), though it previously worked on profile pages. 

Root causes identified:
1. Bluesky removed `data-at-uri` from feed DOM; post detection falls back to anchor hrefs producing handle-based URIs
2. Label pushes arrive with DID-based URIs causing cache key mismatch
3. `normalizeCacheKey` only mapped current user's handle→DID, not other users'
4. `extractDidHint` regex only matched `by-did:plc:...` not `by-handle.bsky.social`

branch: fix/femg-debug-edited-content

## Todo
- [x] Analyze root causes of broken post replacement
- [x] Add handle↔DID registry to edited-post-cache module
- [x] Fix getCached/setCached for bidirectional lookups
- [x] Fix handleLabelPush with DID→handle resolution + rkey-based matching
- [x] Expand normalizeCacheKey to use global registry for all users
- [x] Write unit tests for registry and bidirectional cache
- [x] Run full test suite (47 unit tests passing)

## Summary of Changes
- Added handle↔DID registry (`registerIdentity`, `lookupDid`, `lookupHandle`) in `edited-post-cache.ts`
- `setCached` now stores under both handle and DID key forms when mapping is known
- `getCached` falls back to alternate key form on primary key miss
- `normalizeCacheKey` resolves handles for any registered user, not just current
- `setIdentity` auto-registers the pair in the global registry
- `handleLabelPush` resolves DID→handle via `getHandleForDid` before matching DOM and uses rkey-based matching as fallback
- 6 new unit tests for registry and bidirectional cache behavior
