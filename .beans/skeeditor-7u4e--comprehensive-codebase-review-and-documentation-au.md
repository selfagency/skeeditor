---
# skeeditor-7u4e
title: Comprehensive codebase review and documentation audit
status: completed
type: task
priority: high
created_at: 2026-03-26T01:37:00Z
updated_at: 2026-03-26T02:05:01Z
---

## Overview
Full codebase review covering code quality, security, documentation consistency, and feature completeness.

## Todo
- [x] Review all source files for code quality, security, and correctness
- [x] Review all test files for coverage and quality
- [x] Review all documentation for consistency and completeness
- [x] Identify and fix any issues found
- [x] Ensure documentation covers all implemented features
- [x] Verify build and tests pass (292 tests, 0 errors, tsc clean)
- [x] Commit, push, and open PR

## Summary of Changes

### Code Fixes (4 files)
- **src/content/edit-modal.ts**: Removed duplicate addEventListener calls in open() (click + keydown listeners were added twice)
- **src/content/content-script.ts**: Removed redundant second scanTimer cleanup in cleanupContentScript()
- **manifests/chrome/manifest.json**: Updated minimum_chrome_version from 88 to 120
- **manifests/firefox/manifest.json**: Updated strict_min_version from 121.0 to 125.0 (required for Intl.Segmenter)

### Documentation Fixes (15+ files)
- docs/auth.md: Rewrote stale legacy auth doc as redirect to docs/dev/auth.md
- docs/messages.md + docs/dev/messages.md: Added AUTH_CALLBACK message type
- docs/dev/build.md: Fixed gecko ID, build script description, manifest merge description, Safari build instructions, Firefox version
- docs/dev/testing.md: Fixed XrpcClient config key, Firefox version
- docs/platform.md + docs/dev/platform.md: Fixed Safari min version, polyfill strategy, Firefox version
- docs/dev/facets.md: Added recalculateFacets documentation
- docs/dev/xrpc.md: Added DID validation note
- docs/dev/project-structure.md: Added app-password.ts, improved facet-offsets.ts description
- docs/dev/contributing.md: Fixed linter reference to oxlint
- docs/dev/getting-started.md: Fixed dev script names, added Chrome-only build note
- README.md, docs/guide/introduction.md, docs/guide/faq.md: Updated Firefox minimum version
