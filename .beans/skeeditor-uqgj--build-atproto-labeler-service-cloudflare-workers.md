---
# skeeditor-uqgj
title: Build ATProto labeler service (Cloudflare Workers)
status: completed
type: feature
priority: high
created_at: 2026-03-27T20:23:03Z
updated_at: 2026-03-27T20:30:25Z
---

Build the packages/labeler Cloudflare Worker service for real-time edit propagation.

DID: did:plc:m6h36r2hzbnozuhxj4obhkyb (@skeeditor.bsky.social)

## Todo
- [ ] Update wrangler.jsonc LABELER_DID to did:plc:m6h36r2hzbnozuhxj4obhkyb
- [ ] Add LABELER_DID constant to src/shared/constants.ts
- [ ] Create packages/labeler/src/label.ts (buildLabel, CBOR frame encoding)
- [ ] Create packages/labeler/src/hub.ts (BroadcastHub Durable Object)
- [ ] Create packages/labeler/src/index.ts (Worker entrypoint, routes)
- [ ] Wire CHECK_LABELER_SUBSCRIPTION after AUTH_CALLBACK (silent fail putPreferences)
- [ ] Add labeler subscription message types to src/shared/messages.ts
