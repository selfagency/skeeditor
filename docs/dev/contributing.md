# Contributing

Thank you for contributing to skeeditor! This guide covers everything you need to know before submitting a pull request.

---

## Beans workflow

All work is tracked with [Beans](https://usebeans.io/). Before writing any code:

1. Search for a relevant bean (`@beans /search <keyword>`) or create a new one.
2. Set it to `in-progress`.
3. Create or check out the issue branch (see [Branch naming](#branch-naming)).
4. Maintain a `## Todo` checklist in the bean body. Update it after each step.
5. When done, add `## Summary of Changes`, set status to `completed`, and commit.

---

## Branch naming

```text
<type>/<bean-id>-<short-slug>
```

Examples:

```text
feat/1234-add-search
fix/987-crash-on-init
test/456-mock-xrpc
docs/lydm-vitepress-docs
```

Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `build`, `ci`.

---

## TDD workflow (required)

All changes **must** follow Red-Green-Refactor:

1. **RED** — Write a failing test first. Confirm it fails for the expected reason. Commit: `test: add failing test for <feature>`.
2. **GREEN** — Write the minimum code to make the test pass. Confirm no regressions. Commit: `feat: implement <feature>`.
3. **REFACTOR** — Clean up while keeping tests green. Commit: `refactor: <description>`.

Never submit a PR without tests covering the changed behaviour. Bug fixes must include a test that would have caught the bug.

---

## Commit style

[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer — e.g., Closes #<bean-id>]
```

Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `build`, `ci`.

Scopes: `api`, `content`, `background`, `popup`, `options`, `build`, `manifest`, `auth`, `facets`.

---

## Code style

- **TypeScript strict mode.** `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes` must all pass. No `any` without an explicit `// eslint-disable-next-line` comment.
- **Named exports only.** No default exports.
- **`interface` for object shapes.** Use `type` for unions, intersections, and mapped types.
- **Explicit return types** on all exported functions and all `async` functions.
- **Explicit `public` modifiers** on exported class members and constructors.
- **`@src` alias** for all intra-repo imports (not relative `../../../`).

Formatter: `oxfmt` with `arrowParens: 'avoid'` (single-parameter arrow functions omit parentheses), `printWidth: 120`, `singleQuote: true`.

```sh
pnpm format        # auto-format
pnpm format:check  # check without writing
pnpm lint          # ESLint + oxlint
pnpm lint:fix      # fix auto-fixable issues
pnpm typecheck     # tsc --noEmit
```

All three must pass before pushing.

---

## PR requirements

- Reference the bean ID in the PR description.
- All unit and integration tests must pass (`pnpm test`).
- `pnpm lint` and `pnpm typecheck` must pass without errors.
- E2E tests run on-demand for PRs and are always required on merge to `main`.
- Squash-merge to `main`. The squash commit message must be a valid conventional commit.
- Coverage must not regress below threshold (see [Testing → Coverage targets](./testing#coverage-targets)).

---

## CI pipeline

Every push and every PR runs:

1. Lint + type-check
2. Unit tests (Vitest)
3. Integration tests (Vitest + MSW)
4. Build all browser targets
5. E2E tests (Playwright — Chrome + Firefox)
6. Safari build verification (xcrun converter, macOS runner only)

Safari E2E is manual (Xcode simulator); CI only verifies the converter succeeds.

---

## Setting up the environment

See [Getting Started](./getting-started) for prerequisites, clone instructions, and how to load the extension in your browser for development.
