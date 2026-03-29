---
# skeeditor-akvi
title: 'feat: devnet-backed real E2E tests for Chrome and Firefox'
status: completed
type: task
priority: high
created_at: 2026-03-29T18:43:55Z
updated_at: 2026-03-29T19:09:23Z
---

Set up atproto-devnet (https://github.com/OpenMeet-Team/atproto-devnet) as a real AT Protocol test network for E2E testing the extension against a live local PDS — no XRPC mocking. Works locally and in CI.

## Scope
- Chrome + Firefox (Safari is manual-only, CI not feasible)
- Real PDS calls via localhost:3000
- Seeded accounts: alice.devnet.test / alice-devnet-pass, bob.devnet.test / bob-devnet-pass

## Todo
- [ ] Add devnet as git submodule
- [ ] Create devnet up/down shell scripts
- [ ] Add package.json dev scripts
- [ ] Create Playwright globalSetup for devnet
- [ ] Create devnet session fixture (real PDS auth)
- [ ] Create devnet records fixture (create/delete real posts)
- [ ] Create Chrome devnet extension fixture
- [ ] Create Firefox devnet extension fixture
- [ ] Create chrome-devnet.spec.ts (5 tests)
- [ ] Create firefox-devnet.spec.ts (5 tests)
- [ ] Update playwright.config.ts with devnet projects
- [ ] Update CI workflow with devnet E2E jobs
