---
# skeeditor-ww0d
title: 'Phase 2 web components: implement account-card custom element'
status: in-progress
type: feature
priority: high
branch: feat/ww0d-account-card-custom-element
created_at: 2026-03-29T15:22:12Z
updated_at: 2026-03-29T15:22:12Z
---

## Context
Implement all remaining Phase 2 work in a single branch: custom elements migration for account card/toast/edit modal plus popup/options/content integration.

## Todo
- [x] Add failing unit tests for `<account-card>` custom element events/attributes (RED)
- [x] Implement `src/shared/components/account-card.ts` with guarded registration (GREEN)
- [x] Run targeted unit tests for account-card
- [ ] Implement `src/content/toast.ts` custom element and lifecycle cleanup
- [ ] Convert `src/content/edit-modal.ts` to a true `HTMLElement` custom element
- [ ] Migrate `src/popup/auth-popup.ts` to render and delegate `<account-card>` events
- [ ] Migrate `src/options/options.ts` to render and delegate `<account-card>` events
- [ ] Update `src/content/content-script.ts` to use `<skeeditor-toast>` instead of inline factory
- [ ] Update `src/shadow-styles.css` Tailwind source scanning for shared components
- [ ] Retire `src/shared/utils/account-ui.ts` and update dependent tests
- [ ] Run focused unit tests (popup/options/content/edit-modal/account-card)
- [ ] Run full test suite and summarize Phase 2 completion
