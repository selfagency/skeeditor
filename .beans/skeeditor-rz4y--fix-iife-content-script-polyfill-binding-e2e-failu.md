---
# skeeditor-rz4y
title: Fix IIFE content-script polyfill binding (E2E failures)
status: completed
type: fix
priority: critical
created_at: 2026-03-26T01:09:42Z
updated_at: 2026-03-26T01:18:00Z
id: skeeditor-rz4y
---
The IIFE build for the content script has a broken webextension-polyfill binding. The `intro` line in `scripts/build.ts` creates `var browser = typeof browser !== "undefined" ? browser : {}` which initializes to `{}` inside the IIFE scope (due to var hoisting). The bundled polyfill's CJS wrapper return value is discarded, so `browser.runtime.sendMessage(...)` throws TypeError. This causes all authenticated E2E tests to fail — the content script falls through to its error handler, sets `data-skeeditor-initialized`, but never injects edit buttons.

Fix: Remove the `intro` from the IIFE Rollup config, keep the `globals` mapping, mark `webextension-polyfill` as an external dependency, and load the polyfill separately via the extension manifest so the `browser` global comes from the polyfill script instead of the intro shim.
