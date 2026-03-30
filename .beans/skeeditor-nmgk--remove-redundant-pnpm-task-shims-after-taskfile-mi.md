---
# skeeditor-nmgk
title: Remove redundant pnpm task shims after Taskfile migration
status: completed
type: task
priority: normal
branch: chore/nmgk-remove-pnpm-shims
created_at: 2026-03-30T01:01:59Z
updated_at: 2026-03-30T01:01:59Z
---

## Todo
- [x] Audit which package.json scripts are still required after the Taskfile migration
- [x] Remove redundant pnpm compatibility shims and update any remaining callers
- [x] Validate the direct Task workflow still works locally
- [x] Summarize the cleanup and close the bean

## Summary of Changes
- Replaced documentation references of `pnpm exec task ...` with direct `task ...` commands in `README.md`, `docs/platform.md`, and core `docs/dev/*.md` guides.
- Removed the remaining documentation note suggesting `pnpm run <script>` compatibility as the primary workflow.
- Fixed markdown table alignment in the updated platform/build docs and verified no markdown diagnostics remain in the changed documentation files.
