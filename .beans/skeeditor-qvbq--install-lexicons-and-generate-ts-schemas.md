---
# skeeditor-qvbq
title: Install Lexicons and generate TS schemas
status: completed
type: task
priority: critical
created_at: 2026-03-18T14:26:28Z
updated_at: 2026-03-18T17:30:26Z
parent: skeeditor-5atd
---

Install required lexicons (app.bsky.feed.post, com.atproto.repo.*) and run lex build to generate TypeScript helpers under lexicons/ or generated folder.

## Todo

- [x] Confirm the required `@atproto/lex` install/build workflow and output layout for this repo
- [x] Add a failing unit smoke test for generated Bluesky/atproto lexicon namespaces
- [x] Add the lexicon tooling dependencies and scripts
- [x] Install the required AT Protocol lexicons into the workspace
- [x] Generate TypeScript helpers from the installed lexicons and wire them into the build/typecheck flow
- [x] Validate the lexicon generation commands locally

## Summary of Changes

- Added `@atproto/lex@^0.0.20` as a runtime dependency.
- Added `lex:install`, `lex:build`, `lex:sync` scripts to `package.json`; wired `lex:build` into `build`, `typecheck`, and `test:unit` so schemas are always fresh.
- Created `scripts/prepare-generated-lexicons.ts`: idempotent post-processor that prepends `// @ts-nocheck` to every generated file under `src/lexicons/` to avoid an incompatibility between the `@atproto/lex` code generator and `exactOptionalPropertyTypes: true`.
- Installed `app.bsky.feed.post`, `app.bsky.actor.profile`, and the full `com.atproto.repo.*` suite into `lexicons/`.
- Generated TypeScript namespace helpers (re-exported as `src/lexicons/app`, `src/lexicons/com`, `src/lexicons/tools`).
- Added a passing unit smoke test that asserts `app.bsky.feed.post` and `com.atproto.repo.putRecord` are defined after code generation.
- Fixed a pre-existing Vite 8 build error (`modulepreload-polyfill` not exported for non-HTML entries) by setting `build.modulePreload.polyfill: false` in `vite.config.ts`.
- Full validation green: lint ✅, typecheck ✅, unit tests ✅ (3/3), integration tests ✅ (1/1), build ✅.
