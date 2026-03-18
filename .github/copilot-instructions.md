---
title: Copilot Instructions
description: Global Copilot instructions for TDD-driven cross-browser extension development with Beans task management.
applyTo: "**"
---

## Beans Task Management Rules

<CRITICALLY_IMPORTANT>

1. **Never start work without a bean.** Before writing any code or making any change, find a relevant existing bean or create a new one. Set its status to `in-progress`. There are no exceptions.

2. **Always use the extension or MCP first.** Invoke Beans operations through the VS Code extension commands or MCP tools. Use the `@beans` chat participant for guidance. Fall back to the CLI only when the extension, chat, and MCP are genuinely unavailable — and even then, read the constraints below.

3. **Track all work in the bean's body.** Maintain a `## Todo` checklist in the bean body. After each completed step, mark the item done and sync the bean. Never use TodoWrite, editor scratch pads, or ad-hoc lists.

4. **Commit beans promptly.**
   - Commit a bean immediately after creating or modifying it — unless you are creating a milestone/epic and are about to create its child beans, in which case commit everything together once the hierarchy is complete.
   - Completed todo items may be committed together with the code changes they relate to.

5. **Start or resume on the correct issue branch before writing code.**
   - If the issue does not already have a branch, create one when you begin work.
   - If you are resuming work, checkout the existing branch for that issue first.
   - Branch names must follow: `[type]/[issue-number-without-prefix]-[short-title]`.
   - Examples: `feat/1234-add-search`, `fix/987-crash-on-init`, `test/456-mock-xrpc`.
   - Push the branch and record it in the bean frontmatter as soon as it exists.

6. **Record the branch and PR in the bean.** As soon as a branch or PR exists, add it to the bean's YAML frontmatter:

   ```yaml
   branch: feature/<bean-id>-<slug>
   pr: <pr-number>
   ```

   Commit this update immediately.

7. **Closing a bean.**
   - Completed: add a `## Summary of Changes` section, then set status to `completed`.
   - Scrapped: add a `## Reasons for Scrapping` section, then set status to `scrapped`.

### Agent-Specific Constraints

- **Agent MUST create or switch to the issue branch before making any edits.** If the bean already has an existing branch, checkout that branch; otherwise create a new branch and push it immediately.
- **Agents must NOT keep a separate internal todo list.** All progress, subtasks, and checkboxes belong in the bean's `## Todo` checklist. Update via MCP or extension APIs and commit; never persist task state only in agent runtime.
- **Agents must NOT create bean files by writing files directly or adding custom frontmatter fields.** Always use MCP or extension commands. The only permitted frontmatter keys the agent may set are `branch` and `pr`.

### Beans Interface Priority (highest → lowest)

1. **Beans VS Code extension commands/UI** ← start here every time
2. **Beans chat participant (`@beans`) and slash commands**
3. **Beans MCP tools**
4. **Beans CLI** ← last resort only

### Core Beans Workflow

1. **Before any work:** search for a relevant bean (`beans.search` or `@beans /search`). If none fits, create one with `beans.create` and set it to `in-progress`.
2. **Create or checkout the issue branch** before coding.
3. **Push branch and add branch/PR to bean frontmatter** as soon as they exist. Commit the bean update.
4. **Maintain a `## Todo` checklist** in the bean body. Update it after every completed step and commit.
5. **On completion**, add `## Summary of Changes`, set status to `completed`, and commit.
6. **On scrap**, add `## Reasons for Scrapping`, set status to `scrapped`, and commit.

### Planning Mode for Epic Decomposition

When planning an epic:

1. Confirm goal, constraints, and definition of done.
2. Propose a child-issue map grouped by outcomes.
3. For each child issue, include title, type, priority, and dependencies.
4. Ask for approval before creating any issues.
5. Create all approved child issues and link them with parent relationships.
6. **Commit the parent epic and all child beans together** once the hierarchy is complete.
7. Return created IDs and suggest the first issue to start.

Use compact planning checklist format:

- [ ] `<title>` — type=`<type>`, priority=`<priority>`, depends_on=`<ids|none>`

</CRITICALLY_IMPORTANT>

---

## TDD Workflow — Red-Green-Refactor

Every feature, bug fix, or refactor MUST follow this cycle. No exceptions.

### The Cycle

1. **RED — Write a failing test first.**
   - Create the test in the appropriate `test/` subdirectory.
   - Run the test suite and confirm the new test fails for the expected reason.
   - Commit the failing test: `test: add failing test for <feature>`.
   - Update the bean's `## Todo` to note the test was written.

2. **GREEN — Write the minimum code to pass.**
   - Implement only enough production code to satisfy the test assertion.
   - Run the full test suite to confirm no regressions.
   - Commit: `feat: implement <feature>` or `fix: resolve <issue>`.

3. **REFACTOR — Clean up while keeping tests green.**
   - Extract shared logic, rename for clarity, reduce duplication.
   - Run the full test suite after every refactor step.
   - Commit: `refactor: <description>`.

4. **Update the bean** — mark the todo item complete, sync, commit.

### Test Taxonomy

| Layer       | Tool         | Scope                                                   | Target              |
| :---------- | :----------- | :------------------------------------------------------ | :------------------ |
| Unit        | Vitest       | Pure functions, utilities, parsers, transformers        | `test/unit/`        |
| Integration | Vitest + MSW | HTTP request/response flows, auth, multi-step sequences | `test/integration/` |
| E2E         | Playwright   | Full extension loaded in real browser                   | `test/e2e/`         |

### Test-Writing Standards

- **One assertion per test** where practical. Prefer many small tests over few large ones.
- **Descriptive names**: `it('should recalculate facet byte offsets when text is prepended', ...)` not `it('works', ...)`.
- **Arrange-Act-Assert** structure in every test body. Separate the three phases with blank lines.
- **No test interdependence.** Each test must set up its own state and tear it down.
- **Mock at the boundary.** Mock XRPC HTTP calls (via MSW), not internal functions. Mock browser extension APIs (`chrome.*` / `browser.*`) with lightweight stubs.
- **Snapshot tests are discouraged** for logic. Use them only for stable serialized output (e.g., manifest validation).
- **Coverage target**: ≥ 90% line coverage for `src/shared/`, ≥ 80% for content/background scripts.

### When to Write Which Test

- **New utility function** → unit test first.
- **New API interaction** (XRPC call) → integration test with MSW mock first, then unit tests for request/response transformation.
- **New UI injection or DOM manipulation** → unit test for the logic, then E2E test for the browser interaction.
- **Bug fix** → write a test that reproduces the bug (RED), then fix it (GREEN).

---

## Cross-Browser Extension Development Standards

### Manifest V3

All browser targets use **Manifest V3**. Maintain separate `manifest.json` files per browser under `manifests/<browser>/` with a shared build step that merges common fields.

**Chrome:**

- Standard Manifest V3. Uses `chrome.*` namespace.
- Service worker for background script (`"background": { "service_worker": "..." }`).
- Publish to Chrome Web Store.

**Firefox:**

- Manifest V3 with `browser_specific_settings.gecko.id` for add-on ID.
- Uses `browser.*` namespace (Promise-based). Use `webextension-polyfill` to normalize.
- Background scripts use `"background": { "scripts": ["..."] }` (non-persistent).
- Test with `web-ext run`. Publish to AMO (addons.mozilla.org).

**Safari:**

- Convert from Chrome/Firefox build output using `xcrun safari-web-extension-converter`.
- Requires an Xcode project wrapper (macOS app + extension target, optionally iOS).
- Some APIs are incompatible (e.g., `webRequest` in MV3 is unsupported). Check [Apple's compatibility tables](https://developer.apple.com/documentation/safari-release-notes).
- Enable unsigned extensions for dev: Safari → Settings → Advanced → Show features for web developers → Developer → Allow unsigned extensions.
- Build script: `scripts/build-safari.sh` wraps the converter.

### Browser API Compatibility

- **Always use `webextension-polyfill`** (`browser.*` Promise API) as the primary interface in shared code.
- **Platform shims** in `src/platform/<browser>/` for any API that diverges (e.g., `identity.launchWebAuthFlow` differences, `sidePanel` availability).
- **Feature-detect, never user-agent sniff.** Check for API existence (`typeof chrome.sidePanel !== 'undefined'`) rather than browser identity.
- **Permissions must be minimal.** Request only what is needed. Prefer `activeTab` + `host_permissions` for `https://bsky.app/*` over broad `<all_urls>`.

### Required Manifest Permissions (baseline)

```json
{
  "permissions": ["storage", "activeTab"],
  "host_permissions": ["https://bsky.app/*", "https://*.bsky.network/*"],
  "content_scripts": [{
    "matches": ["https://bsky.app/*"],
    "js": ["content/content-script.js"],
    "css": ["content/styles.css"]
  }]
}
```

### Build & Dev Tooling

- **Bundler**: Vite (or esbuild) with separate entry points for content script, service worker, popup, and options.
- **TypeScript**: Strict mode (`"strict": true`). No `any` unless explicitly justified with a `// eslint-disable-next-line` comment.
- **Linting**: ESLint with `@typescript-eslint`. Prettier for formatting.
- **Dev workflow**:
  - Chrome: `vite build --watch` + load unpacked from `dist/chrome/`.
  - Firefox: `web-ext run --source-dir dist/firefox/ --firefox=nightly`.
  - Safari: manual rebuild via Xcode after `scripts/build-safari.sh`.

---

## AT Protocol (atproto) Development Standards

### SDK Usage

- Use **`@atproto/lex`** for type-safe Lexicon tooling. Install Lexicons with `lex install`, build TypeScript schemas with `lex build`.
- Install at minimum: `app.bsky.feed.post`, `app.bsky.actor.profile`, `com.atproto.repo.*` Lexicons.
- Use generated `$build()`, `$parse()`, `$check()`, and `$validate()` helpers for all record construction and validation.
- Use the `Client` class from `@atproto/lex` for XRPC calls (`client.get()`, `client.put()`, `client.create()`, `client.delete()`).

### Authentication in Extensions

- **OAuth with PKCE** is the preferred authentication method for browser extensions.
- Use `@atproto/oauth-client` for the OAuth flow. The extension background/service worker manages the session.
- Store tokens in `browser.storage.local` (encrypted if possible). Never store tokens in content scripts or expose them to page context.
- Handle token refresh transparently in the background script. Content scripts communicate via `browser.runtime.sendMessage`.

### XRPC Request Patterns

- All XRPC calls go through the background/service worker, never from content scripts directly.
- Content script sends a message → service worker makes the authenticated XRPC call → returns the result.
- Always handle `XrpcResponseError` (server error), `XrpcUpstreamError` (malformed response), and `XrpcInternalError` (network failure) distinctly.
- Use `swapRecord` (CID) on `putRecord` for optimistic concurrency. Retry with fresh `getRecord` on conflict.

### Record Manipulation Rules

- **Never modify fields you don't understand.** When updating a post, preserve all existing fields and only change what the user explicitly edited.
- **Recalculate facets** whenever `text` changes. Facets use byte offsets into the UTF-8 encoded text, not character or grapheme offsets.
- **Preserve `createdAt`** from the original record. Do not overwrite it with the current time.
- **Preserve embeds** unless the user explicitly removes them.
- **Validate the complete record** against the `app.bsky.feed.post` schema (via `$parse()` or `$validate()`) before calling `putRecord`.

### Microcosm APIs (Optional Enhancement)

- [Slingshot](https://slingshot.microcosm.blue/) can be used to rapidly fetch and cache records and resolve identities.
- [Constellation](https://constellation.microcosm.blue/) provides backlink indexing — useful for showing reply context or engagement data.
- [Spacedust](https://spacedust.microcosm.blue/) enables real-time firehose filtering — useful for live edit notifications.
- These are community infrastructure and should be used as optional enhancement layers, not hard dependencies.

---

## Code Style & Conventions

### TypeScript

- **Strict mode always.** `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes` all enabled.
- **Explicit return types** on all exported functions and all async functions.
- **No default exports.** Use named exports exclusively.
- **Prefer `interface` over `type`** for object shapes. Use `type` for unions, intersections, and mapped types.
- **Error handling**: Use typed error classes extending `Error`. Never `catch` and swallow silently.

### File Naming

- `kebab-case` for all files and directories.
- `.test.ts` suffix for test files, co-located in `test/` mirror of `src/` structure.
- `.spec.ts` suffix for E2E Playwright tests only.

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer — e.g., Closes #<bean-id>]
```

Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `build`, `ci`.
Scopes: `api`, `content`, `background`, `popup`, `options`, `build`, `manifest`, `auth`, `facets`.

### PR & Review

- Every PR must reference a bean ID in the description.
- PRs require passing CI (all unit + integration tests, lint, type-check).
- E2E tests run on merge to `main` (or on-demand for the PR).
- Squash-merge to `main`. The squash message must be a valid conventional commit.

---

## CI Pipeline

```yaml
# Stages:
# 1. Lint + Type-check
# 2. Unit tests (Vitest)
# 3. Integration tests (Vitest + MSW)
# 4. Build all browser targets
# 5. E2E tests (Playwright — Chrome + Firefox)
# 6. Safari build verification (xcrun converter — macOS runner only)
```

- Tests run on every push and PR.
- E2E tests use Playwright with browser extension fixtures for Chrome and Firefox.
- Safari E2E is manual (Xcode simulator) — CI only verifies the converter succeeds.
- Coverage reports uploaded to CI artifacts. Regressions below threshold block merge.
