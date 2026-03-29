---
# skeeditor-ww0d
title: 'Phase 2 web components: implement account-card custom element'
status: completed
type: feature
priority: high
branch: feat/ww0d-account-card-custom-element
pr: 64
created_at: 2026-03-29T15:22:12Z
updated_at: 2026-03-29T16:23:22Z
---

## Context
Implement all remaining Phase 2 work in a single branch: custom elements migration for account card/toast/edit modal plus popup/options/content integration.

## Todo
- [x] Add failing unit tests for `<account-card>` custom element events/attributes (RED)
- [x] Implement `src/shared/components/account-card.ts` with guarded registration (GREEN)
- [x] Run targeted unit tests for account-card
- [x] Implement `src/content/toast.ts` custom element and lifecycle cleanup
- [x] Migrate `src/popup/auth-popup.ts` to render and delegate `<account-card>` events
- [x] Migrate `src/options/options.ts` to render and delegate `<account-card>` events
- [x] Update `src/content/content-script.ts` to use `<skeeditor-toast>` instead of inline factory
- [x] Update `src/shadow-styles.css` Tailwind source scanning for shared components
- [x] Retire `src/shared/utils/account-ui.ts` and update dependent tests
- [x] Run focused unit tests (popup/options/content/edit-modal/account-card)
- [x] Run full test suite and summarize Phase 2 completion
- [x] Validate edit-modal runtime compatibility in Chrome E2E (kept wrapper implementation to avoid isolated-world `HTMLElement` constructor errors)
- [x] Add failing test for unsafe toast message HTML interpolation (RED)
- [x] Refactor toast render to avoid HTML interpolation and prefer Tailwind utility classes for inner markup
- [x] Run targeted toast/content tests and full test suite

## Summary of Changes
- Added new shared `<account-card>` component and migrated popup/options account action handling to composed custom events.
- Added new `<skeeditor-toast>` component and replaced inline toast factory usage in content script.
- Updated Tailwind shadow source scanning to include shared component sources.
- Removed legacy `src/shared/utils/account-ui.ts` helper after consumers migrated.
- Updated popup/options tests for custom-element event delegation and added dedicated toast unit tests.
- Hardened toast rendering against HTML injection by assigning message via `textContent` instead of interpolating into `innerHTML`.
- Migrated toast body styling from inline raw CSS to Tailwind utility classes (host positioning/animation remains inline for runtime animation control).
- Verified behavior with focused unit suites, Chrome E2E, and full test suite (`419 passed, 0 failed`).
