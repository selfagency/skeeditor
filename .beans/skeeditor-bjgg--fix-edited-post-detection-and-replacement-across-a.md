---
# skeeditor-bjgg
title: Fix edited post detection and replacement across all Bluesky views
status: in-progress
type: bug
priority: high
created_at: 2026-03-28T23:22:05Z
updated_at: 2026-03-28T23:22:18Z
---

Edited post replacement is broken across all Bluesky views (feed, notifications, search, etc.), though it previously worked on profile pages. 

Root causes to investigate:
1. DID resolution: DOM elements have handle-based `data-testid` (e.g., `feedItem-by-handle.bsky.social`) not DID-based, causing cache key mismatches
2. Cache normalization only works for current user's handle→DID, not other users'
3. Label push URIs arrive as DID-based but DOM queries use handle-based URIs
4. Post containers may have changed (no `data-at-uri` attribute in feed items)

branch: fix/femg-debug-edited-content

## Todo
- [ ] Analyze root causes of broken post replacement
- [ ] Fix handle→DID resolution for cache key normalization
- [ ] Fix post detection to work with current Bluesky DOM structure
- [ ] Ensure edited label detection triggers fetch correctly
- [ ] Test across views (feed, profile, permalink, notifications, search)
