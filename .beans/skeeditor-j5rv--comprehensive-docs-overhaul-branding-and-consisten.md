---
# skeeditor-j5rv
title: Comprehensive docs overhaul, branding, and consistency fixes
status: completed
type: task
priority: high
branch: task/j5rv-docs-overhaul
pr: 71
created_at: 2026-03-30T03:30:18Z
updated_at: 2026-03-30T03:52:13Z
---

## Summary of Changes

### Branch: `task/j5rv-docs-overhaul`

Comprehensive documentation overhaul across 32 files (1160+ insertions, 280+ deletions):

**User-facing docs:**
- Rewrote introduction.md with warm, lighthearted tone
- Rewrote usage.md reflecting settings-based account management and Add Media button
- Rewrote faq.md with labeler mechanism explanation, accurate media editing info, privacy entries
- Updated privacy.md with labeler network connection disclosure
- Updated installation.md with Safari "coming soon"
- Updated homepage (index.md): labeler feature card, fixed markdown rendering, Safari coming soon

**Developer docs:**
- Converted 5 ASCII diagrams to Mermaid (architecture×3, auth×1, labeler-services×1)
- Installed vitepress-mermaid-renderer with dark/forest theme switching
- Fixed releasing.md Safari section: correct task name `build:safari:swift`
- Updated build.md Safari section with two-step build process
- Branding pass across all 13 dev doc files

**Config/manifest:**
- wxt.config.ts: manifest name/title → "Skeeditor"
- README.md: branding, Safari "coming soon"
- docs/.vitepress/config.ts: title, logo alt, sidebar text

**Media editing verification:**
- Adding new media: ✅ works end-to-end (UPLOAD_BLOB → real blobRefs → PUT_RECORD)
- Removing existing media: ❌ not implemented (filed as finding, docs corrected)
- No E2E tests for media exist — recommend adding in a separate issue
