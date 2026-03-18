---
# skeeditor-qvbq
title: Install Lexicons and generate TS schemas
status: in-progress
type: task
priority: critical
created_at: 2026-03-18T14:26:28Z
updated_at: 2026-03-18T17:15:38Z
parent: skeeditor-5atd
branch: feature/skeeditor-5atd-project-scaffolding-build-pipeline
---

Install required lexicons (app.bsky.feed.post, com.atproto.repo.*) and run lex build to generate TypeScript helpers under lexicons/ or generated folder.

## Todo

- [ ] Confirm the required `@atproto/lex` install/build workflow and output layout for this repo
- [ ] Add the lexicon tooling dependencies and scripts
- [ ] Install the required AT Protocol lexicons into the workspace
- [ ] Generate TypeScript helpers from the installed lexicons and wire them into the build/typecheck flow
- [ ] Validate the lexicon generation commands locally
