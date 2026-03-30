---
# skeeditor-us9f
title: Align privacy, FAQ, installation, and auth docs with real network behavior
status: in-progress
type: task
priority: critical
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T14:04:21Z
parent: skeeditor-d3m1
branch: docs/us9f-network-auth-doc-alignment
---

User-facing docs currently understate third-party network calls, requested permissions, and auth behavior. Update docs so privacy, permissions, and network claims match the actual implementation.

## Todo
- [x] Audit `README.md`, privacy, FAQ, installation, and auth docs
- [x] Document Slingshot, labeler, and real permission usage accurately
- [x] Correct any stale client_id / domain references
- [x] Rebuild or refresh generated docs if applicable
- [x] Verify docs build and links remain healthy

## Summary of Changes
- Updated `README.md` security bullet to match real labeler token-forwarding behavior.
- Updated `docs/auth.md` client_id reference to `https://docs.skeeditor.link/oauth/client-metadata.json` and corrected permission notes.
- Updated `docs/guide/privacy.md` with accurate endpoint coverage (Bluesky, Slingshot, labeler HTTP/WS, PLC, API fallback, docs host) and explicit labeler token-forwarding semantics.
- Updated `docs/guide/faq.md` to accurately explain non-Bluesky network calls and labeler/Slingshot usage.
- Updated `docs/guide/installation.md` permissions section to reflect current manifest/runtime permissions and host permissions.
- Rebuilt docs via `task docs:build` successfully.
