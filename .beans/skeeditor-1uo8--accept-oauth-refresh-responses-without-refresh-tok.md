---
# skeeditor-1uo8
title: Accept OAuth refresh responses without refresh_token
status: in-progress
type: bug
priority: high
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T15:13:51Z
parent: skeeditor-d3m1
branch: fix/1uo8-refresh-token-retention
---

`AUTH_GET_STATUS` currently expects a refreshed `refresh_token` even though many providers legally omit it. Preserve the existing refresh token when the response only returns a new access token.

## Todo
- [x] Add a failing test for access-token-only refresh responses
- [x] Update background refresh logic to retain the existing refresh token
- [x] Add coverage for malformed or partial refresh payloads
- [x] Verify existing refresh behavior still works when a new refresh token is returned
