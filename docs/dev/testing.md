# Testing

skeeditor has three test layers: unit, integration, and end-to-end. Each targets a different scope and uses a different tool.

---

## Quick reference

```sh
pnpm test               # unit + integration (default CI gate)
pnpm test:unit          # unit only
pnpm test:integration   # integration only
pnpm test:e2e           # Playwright E2E (Chrome + Firefox)
pnpm test:watch         # Vitest in watch mode (unit + integration)
```

For a coverage report:

```sh
pnpm test:coverage   # if the script is configured; otherwise:
vitest run --coverage --project unit --project integration
```

---

## Unit tests (Vitest + jsdom)

**Location:** `test/unit/`
**Runner:** Vitest (`vitest.config.ts`, project `unit`)
**Environment:** `jsdom`

Unit tests cover pure functions, utilities, parsers, and class methods in isolation. No network, no browser extension APIs.

### Browser API mocking

`test/setup/unit.ts` is the Vitest setup file for the `unit` project. It registers stubs for the `chrome.*` / `browser.*` extension APIs via `test/mocks/browser-apis.ts`. This lets content-script and background code import and run without a real browser.

### Import example

```ts
import { describe, test, expect } from 'vitest';
import { detectLinks } from '@src/shared/utils/facets';

describe('detectLinks', () => {
  test('returns a facet for a bare URL', () => {
    const text = 'check out https://example.com today';

    const results = detectLinks(text);

    expect(results).toHaveLength(1);
    expect(results[0]?.uri).toBe('https://example.com');
  });
});
```

### Naming and structure conventions

- Files: `test/unit/<mirror-of-src-path>.test.ts`
- Suites: `describe('<module name>')` → `test('should <behaviour>')`
- Arrange-Act-Assert with blank-line separation between phases
- One assertion per test where practical; group only tightly related checks

---

## Integration tests (Vitest + MSW)

**Location:** `test/integration/`
**Runner:** Vitest (`vitest.config.ts`, project `integration`)
**Environment:** `node` (not jsdom)

Integration tests verify HTTP request/response flows — primarily XRPC calls to the Bluesky PDS. [MSW (Mock Service Worker)](https://mswjs.io/) intercepts outbound `fetch` at the Node.js level and returns controlled responses.

### MSW setup

`test/mocks/server.ts` creates the MSW server.
`test/mocks/handlers.ts` defines request handlers for every XRPC endpoint used by the extension.
`test/setup/integration.ts` starts the server before all tests and closes it after.

### Example

```ts
import { http, HttpResponse } from 'msw';
import { server } from '@test/mocks/server';
import { XrpcClient } from '@src/shared/api/xrpc-client';

test('getRecord returns parsed record', async () => {
  server.use(
    http.get('https://bsky.social/xrpc/com.atproto.repo.getRecord', () =>
      HttpResponse.json({ uri: 'at://...', cid: 'baf...', value: { text: 'hello' } })
    )
  );

  const client = new XrpcClient({ pdsUrl: 'https://bsky.social', accessJwt: 'tok' });

  const result = await client.getRecord({ repo: 'did:plc:abc', collection: 'app.bsky.feed.post', rkey: '1' });

  expect(result.value.text).toBe('hello');
});
```

---

## End-to-end tests (Playwright)

**Location:** `test/e2e/`
**Runner:** Playwright (`playwright.config.ts`)
**Targets:** `chromium-extension` and `firefox-extension` projects

E2E tests load the built extension (from `dist/chrome/` or `dist/firefox/`) into a real browser context and exercise the full UI flow.

### Fixtures

`test/e2e/fixtures/chromium-extension.ts` — a custom Playwright fixture that launches a Chromium browser with the extension loaded via `--load-extension`.

`test/e2e/fixtures/firefox-extension.ts` — launches Firefox with the extension loaded as a temporary add-on.

`test/e2e/fixtures/mock-bsky-page.html` — a static HTML page that mimics the bsky.app post DOM structure, allowing E2E tests to run without a live Bluesky connection.

### Running E2E tests

The extension must be built before running E2E tests:

```sh
pnpm build:chrome && pnpm build:firefox
pnpm test:e2e
```

Run only one browser:

```sh
pnpm test:e2e:chromium
pnpm test:e2e:firefox
```

List all tests without running:

```sh
pnpm test:e2e:list
```

---

## Coverage targets

| Package | Target |
| --- | --- |
| `src/shared/` | ≥ 90% line coverage |
| `src/content/` | ≥ 80% line coverage |
| `src/background/` | ≥ 80% line coverage |

Coverage is enforced in CI. A PR that reduces coverage below threshold will fail.

---

## Adding new tests

1. **New utility function** → add a unit test in `test/unit/` first (TDD: write failing test, then implement).
2. **New XRPC endpoint usage** → add an MSW handler in `test/mocks/handlers.ts`, then write an integration test.
3. **New DOM interaction** → unit test the logic, add an E2E test for the browser interaction.
4. **Bug fix** → write a test that reproduces the bug before fixing it.

See [Contributing](./contributing) for the TDD workflow requirements.
