---
# skeeditor-a61r
title: Show extension build version and commit in popup footer
status: completed
type: feature
priority: normal
branch: feat/a61r-popup-build-info
created_at: 2026-03-31T14:17:52Z
updated_at: 2026-03-31T14:17:52Z
---

## Todo

- [x] Inspect popup/footer location and existing build metadata
- [x] Add failing test covering popup build metadata footer
- [x] Inject extension version and commit SHA into the popup build
- [x] Render compact build info at the bottom of the popup
- [x] Verify tests and built output

## Summary of Changes

- Added a compact `#build-info` footer to the popup so the active extension build is visible in every popup state.
- Injected the package version and current Git short SHA into the popup bundle via WXT/Vite `define` values.
- Added a popup unit test covering the new footer and verified the built Chrome bundle contains the injected build metadata.
