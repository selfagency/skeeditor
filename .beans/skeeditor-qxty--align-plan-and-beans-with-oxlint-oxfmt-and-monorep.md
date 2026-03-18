---
# skeeditor-qxty
title: Align plan and beans with oxlint oxfmt and monorepo tooling
status: completed
type: task
priority: high
branch: chore/qxty-align-tooling-docs
created_at: 2026-03-18T15:14:25Z
updated_at: 2026-03-18T15:17:10Z
---

Update `docs/plans/implementation-plan.md` and relevant bean descriptions/todos so they accurately state the intended tooling choices: `oxlint` and `oxfmt` for linting/formatting, and `pnpm workspaces` plus `turbo` for monorepo management.

## Todo

- [x] Identify plan and bean text that mentions linting, formatting, or monorepo tooling
- [x] Update implementation plan to reference `oxlint`, `oxfmt`, and `pnpm workspaces` + `turbo`
- [x] Update relevant beans to match the same tooling decisions
- [x] Validate the wording is consistent across plan and beans
- [x] Summarize the tooling alignment changes

## Summary of Changes

- Updated `docs/plans/implementation-plan.md` to replace `.eslintrc.cjs` / `.prettierrc` references with `.oxlintrc.json` / `.oxfmtrc.json` and to document `pnpm workspaces` plus `turbo` in the repository structure.
- Changed the Epic 1 scaffolding item back to `Initialize monorepo structure` so the plan matches the intended workspace management model.
- Added technical-decision entries for `oxlint`, `oxfmt`, and `pnpm workspaces` + `turbo`.
- Updated scaffolding and CI-related beans so they consistently describe Ox tooling for linting/formatting and monorepo management with `pnpm workspaces` and `turbo`.