---
# skeeditor-w0mg
title: Multi-account storage redesign (Phase C)
status: completed
type: feature
priority: high
created_at: 2026-03-26T19:19:43Z
updated_at: 2026-03-26T19:44:56Z
---


## Summary of Changes

- Replaced single-slot `session` storage key with a `sessions: Record<DID, StoredSession>` map + `activeDid` key
- Added `sessionStore` methods: `getByDid`, `getActiveDid`, `setActiveDid`, `listDids`, `clearForDid`, `migrateFromLegacy`
- Replaced global `pdsUrl` storage key with per-DID `pdsUrls: Record<DID, string>` map in `constants.ts`
- Added `setGlobalPdsUrl()` for pre-auth (no-DID) PDS URL storage
- Updated `message-router.ts`: per-DID DPoP key pair cache (`Map<string, CryptoKeyPair>`); pdsUrl passed through auth state; all authenticated handlers call `getCurrentPdsUrl(stored.did)`
- Updated `RouterDeps.storeAuthState/getAuthState` to carry optional `pdsUrl`
- Updated all unit tests (session-store, message-router, auth-popup) to match new storage API
- All 285 unit tests + 33 integration tests pass; typecheck clean

Branch: `feat/w0mg-multi-account-storage`
PR: #54
