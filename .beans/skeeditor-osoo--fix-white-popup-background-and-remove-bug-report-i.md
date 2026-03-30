---
# skeeditor-osoo
title: Fix white popup background and remove bug report icon
status: completed
type: fix
priority: high
created_at: 2026-03-30T05:07:59Z
updated_at: 2026-03-30T05:09:51Z
---

---
branch: fix/osoo-white-popup-bg
pr: 73
---

## Problem

After merging PR #72, the popup appears white because Tailwind v4's `@tailwindcss/vite` plugin doesn't scan HTML entry files (`src/entrypoints/**/*.html`). Classes like `bg-gray-950`, `min-w-80`, `mb-4`, `font-bold`, `text-xl` used only in HTML were missing from the built CSS.

Additionally, the bug report SVG icon looks indistinguishable and should be removed.

## Todo

- [x] Remove SVG icon from "Report a bug" link in auth-popup.ts
- [x] Add `@source "./entrypoints/**/*.html"` to global.css so Tailwind v4 scans HTML files
- [x] Rebuild and verify all popup body classes appear in built CSS
- [x] Run auth-popup unit tests (21/21 pass)
- [x] Create branch, commit, push
- [x] Open PR (#73)

## Summary of Changes

- `src/global.css`: Added `@source "./entrypoints/**/*.html"` directive so Tailwind v4 includes classes from HTML entry files
- `src/popup/auth-popup.ts`: Removed SVG bug icon from "Report a bug" link, keeping text-only link
