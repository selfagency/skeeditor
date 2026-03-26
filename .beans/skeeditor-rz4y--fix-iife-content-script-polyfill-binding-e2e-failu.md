---
# skeeditor-rz4y
title: Fix IIFE content-script polyfill binding (E2E failures)
status: in-progress
type: fix
priority: critical
created_at: 2026-03-26T01:09:42Z
updated_at: 2026-03-26T01:10:01Z
---

The IIFE build for the content script has a broken webextension-polyfill binding. The `intro` line in `scripts/build.ts` creates `var browser = typeof browser !== "undefined" ? browser : {}` which initializes to `{}` inside the IIFE scope (due to var hoisting). The bundled polyfill's CJS wrapper return value is discarded, so `browser.runtime.sendMessage(...)` throws TypeError. This causes all authenticated E2E tests to fail — the content script falls through to its error handler, sets `data-skeeditor-initialized`, but never injects edit buttons.

Fix: Remove the `intro` and `globals` from the IIFE Rollup config; ensure the polyfill module export is properly linked through Rollup's CJS interop.
