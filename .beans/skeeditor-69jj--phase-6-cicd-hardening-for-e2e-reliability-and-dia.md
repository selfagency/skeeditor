---
# skeeditor-69jj
title: 'Phase 6: CI/CD hardening for E2E reliability and diagnostics'
status: completed
type: task
priority: high
created_at: 2026-04-16T02:28:28Z
updated_at: 2026-04-16T04:35:00Z
parent: skeeditor-i0qu
blocked_by:
    - skeeditor-tf6g
    - skeeditor-2co4
---

## Outcome
Make E2E a robust merge gate with actionable diagnostics and controlled runtime.

## Todo
- [x] Ensure Chrome and Firefox E2E are required PR checks.
- [x] Upload traces, screenshots, videos, and relevant logs on failures.
- [x] Tune retries/fail-fast to reduce noise without hiding defects.
- [x] Add scheduled full-matrix run separate from PR gating.
- [x] Verify artifact retention and discoverability for triage.

## Summary of Changes

- Added weekly scheduled CI trigger (Monday 04:00 UTC) to `ci.yml`.
- Added `task test:parity` step to the quality job in CI.
- Added `e2e-firefox-webext` CI job running `task test:e2e:firefox` after quality and build gates.
- Added Playwright failure artifact upload (traces + report, 14-day retention) to `e2e-chromium` job.
- Playwright retries were already configured (`process.env.CI ? 2 : 0`) — confirmed and documented.
