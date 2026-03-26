---
# skeeditor-lqej
title: Multi-account popup UI (Phase D)
status: in-progress
type: feature
priority: high
created_at: 2026-03-26T20:09:05Z
updated_at: 2026-03-26T20:10:34Z
---

Update `auth-popup` Web Component to expose the multi-account storage added in Phase C (skeeditor-w0mg).

## What
Phase C added DID-keyed session storage (`sessions` map + `activeDid`). The popup still only shows the single active account. Phase D surfaces the full account list so users can:
1. See all signed-in accounts with their handles/DIDs
2. Switch the active account (sends `AUTH_SWITCH_ACCOUNT`)
3. Sign out of a single account (sends `AUTH_SIGN_OUT_ACCOUNT` with did)
4. Add another account (new `AUTH_ADD_ACCOUNT` flow, keeps existing session)
5. Sign out of all accounts (existing `AUTH_SIGN_OUT`)

## Scope

### Messages (src/shared/messages.ts)
- Add `AUTH_SWITCH_ACCOUNT { did }` — switches active DID, notifies content scripts
- Add `AUTH_SIGN_OUT_ACCOUNT { did }` — clears session for one DID, falls back to next
- Add `AUTH_ADD_ACCOUNT { pdsUrl }` — initiates OAuth for a second account without clearing existing session
- Add `AUTH_LIST_ACCOUNTS` → `{ accounts: { did: string; expiresAt: number }[] }`

### Message router (src/background/message-router.ts)
- Handle `AUTH_SWITCH_ACCOUNT`: calls `sessionStore.setActiveDid(did)`, notifies tabs
- Handle `AUTH_SIGN_OUT_ACCOUNT`: calls `sessionStore.clearForDid(did)`
- Handle `AUTH_ADD_ACCOUNT`: same as `AUTH_SIGN_IN` but does not clear existing sessions
- Handle `AUTH_LIST_ACCOUNTS`: calls `sessionStore.listDids()`, returns status per DID

### Popup (src/popup/auth-popup.ts)
- `PopupState` gains `multi-account` state rendered when `listDids().length > 1`
- Account list renders each DID with: active indicator, handle (if available), switch button, per-account sign-out button
- Unauthenticated state gains "Add account" button
- Authenticated state gains "Add another account" button (does not sign out first)

### Content script notification
- After `AUTH_SWITCH_ACCOUNT`, background broadcasts `SESSION_CHANGED` so `post-badges` and `post-detector` re-evaluate ownership

## Todo

- [ ] Add AUTH_SWITCH_ACCOUNT, AUTH_SIGN_OUT_ACCOUNT, AUTH_ADD_ACCOUNT, AUTH_LIST_ACCOUNTS message types
- [ ] Implement router handlers for new messages
- [ ] Update auth-popup to list accounts and support switching
- [ ] Broadcast SESSION_CHANGED after account switch
- [ ] Unit tests for new router handlers
- [ ] Unit tests for updated auth-popup states
- [ ] All unit + integration tests green, typecheck clean
