---
# skeeditor-akvi
title: 'feat: devnet-backed real E2E tests for Chrome and Firefox'
status: completed
type: task
priority: high
created_at: 2026-03-29T18:43:55Z
updated_at: 2026-03-29T19:59:15Z
---

Set up atproto-devnet (https://github.com/OpenMeet-Team/atproto-devnet) as a real AT Protocol test network for E2E testing the extension against a live local PDS — no XRPC mocking. Works locally and in CI.

## Scope
- Chrome + Firefox (Safari is manual-only, CI not feasible)
- Real PDS calls via localhost:3000
- Seeded accounts: alice.devnet.test / alice-devnet-pass, bob.devnet.test / bob-devnet-pass

## Todo
- [x] Add devnet as git submodule
- [x] Create devnet up/down shell scripts
- [x] Add package.json dev scripts
- [x] Create Playwright globalSetup for devnet
- [x] Create devnet session fixture (real PDS auth)
- [x] Create devnet records fixture (create/delete real posts)
- [x] Create Chrome devnet extension fixture
- [x] Create Firefox devnet extension fixture
- [x] Create chrome-devnet.spec.ts (5 tests)
- [x] Create firefox-devnet.spec.ts (5 tests)
- [x] Update playwright.config.ts with devnet projects
- [x] Update CI workflow with devnet E2E jobs
- [x] Fix: InvalidSwap (HTTP 400 on devnet) correctly mapped to conflict error
- [x] Fix: DPoP scheme disabled for legacy bearer sessions (dpopEnabled field)
- [x] Fix: devnetPost fixture decoupled from devnetSession (unauthenticated test)

## Summary of Changes

Built full devnet E2E infrastructure and fixed 3 test failures discovered during first run:

1. **Fix A** (`src/shared/api/xrpc-client.ts`): Devnet PDS returns HTTP 400 (not 409) for `InvalidSwap` conflicts. Added check on `error.cause.error` code to map 400+InvalidSwap → `conflict`.

2. **Fix B** (`test/e2e/fixtures/chromium-devnet-extension.ts`, `firefox-devnet-extension.ts`): `devnetPost` fixture was depending on `devnetSession`, causing auth to always be injected even in the unauthenticated test. Decoupled `devnetPost` to create its own raw PDS session independently.

3. **Fix C** (multiple files): Extension always used DPoP scheme for XRPC calls, but devnet fixtures injected plain Bearer sessions. Devnet PDS validates DPoP proofs for writes → 401. Added `dpopEnabled?: boolean` to `StoredSession` and `XrpcClientConfig`; `createDefaultDeps.createXrpc` now skips DPoP when `config.dpopEnabled === false`; devnet fixtures inject `dpopEnabled: false`.

All 5 chromium-devnet tests pass: 5 passed (8.3s).
