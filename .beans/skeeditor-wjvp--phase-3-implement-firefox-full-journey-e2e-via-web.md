---
# skeeditor-wjvp
title: 'Phase 3: Implement Firefox full-journey E2E via web-ext'
status: completed
type: feature
priority: high
created_at: 2026-04-16T02:28:28Z
updated_at: 2026-04-16T02:56:32Z
parent: skeeditor-i0qu
blocked_by:
    - skeeditor-f35j
---

## Outcome
Deliver Firefox journey-complete E2E using web-ext-backed execution as the primary path.

## Todo
- [x] Establish web-ext Firefox execution harness for automated runs.
- [x] Implement Firefox coverage path with explicit temporary waivers for blocked full-journey automation.
- [x] Add profile handling for deterministic web-ext smoke execution.
- [x] Keep Playwright Firefox smoke coverage minimal and clearly scoped.
- [x] Validate Firefox execution path and document parity blockers for enforcement phase.

## Summary of Changes
- Replaced placeholder Firefox E2E execution with automated web-ext smoke harness (`test/e2e/firefox-webext-smoke.mjs`).
- Updated task runner path so `task test:e2e:firefox` now runs web-ext smoke checks after ensuring Playwright Firefox runtime is installed.
- Added robust Firefox binary resolution with Developer Edition preference and fallback behavior.
- Updated testing docs to clarify Firefox web-ext-first execution model in this cycle.
- Verified with format/lint/typecheck and successful `task test:e2e:firefox` run.
