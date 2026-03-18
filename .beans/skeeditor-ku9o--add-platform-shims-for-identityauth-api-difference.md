---
# skeeditor-ku9o
title: Add platform shims for identity/auth API differences
status: todo
type: feature
priority: normal
created_at: 2026-03-18T14:30:34Z
updated_at: 2026-03-18T14:52:09Z
parent: skeeditor-7d7e
---

Create platform-specific shims for identity and auth differences (Chrome vs Firefox vs Safari) under `src/platform/`.

## Todo

- [ ] Implement `src/platform/chrome/shim.ts`, `src/platform/firefox/shim.ts`, `src/platform/safari/shim.ts`
- [ ] Provide a unified `platform` export for shared code to call (e.g., `platform.openAuthWindow()`)
- [ ] Add Vitest unit tests for shim APIs (mock platform behaviors)
- [ ] Ensure shims are small and tree-shakeable; document their behavior in `docs/platform.md`
