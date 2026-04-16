# E2E Harness Contracts

This document defines the shared E2E harness contracts used by Skeeditor tests so new scenarios remain deterministic and low-flake across browser environments.

## Scope

- Test root: `test/e2e/`
- Primary execution paths:
  - Chromium extension: Playwright persistent context (`chromium-extension`)
  - Chromium devnet: Playwright + local devnet (`chromium-devnet`)
  - Firefox extension/devnet: currently scaffolded with capability gates; Firefox functional validation is web-ext-first in this cycle

## Journey inventory baseline

Current implemented journey IDs and coverage anchors:

- `skeeditor-vwhj` — content script injection and own-post processing (`chrome.spec.ts`)
- `skeeditor-9zyf` — own vs other post edit-button visibility (`chrome.spec.ts`)
- `skeeditor-iuey` — edit modal load and happy-path save (`chrome.spec.ts`)
- `skeeditor-yz58` — unauthenticated visibility behavior (`chrome.spec.ts`)
- `skeeditor-gz1w` — conflict prompt behavior (`chrome.spec.ts`)
- `skeeditor-akvi·1..5` — real-network Chromium devnet flows (`chrome-devnet.spec.ts`)

Firefox stubs:

- `firefox.spec.ts` and `firefox-devnet.spec.ts` are currently scaffolded and explicitly gated for tooling limitations.

## Readiness contracts

Use state-based readiness helpers instead of fixed waits.

### Content script ready

Use `waitForContentScriptReady(page)`.

Contract:

- Waits for `:root[data-skeeditor-initialized]`.
- Represents completion of content script startup and initial auth-state fetch.

### Edit modal ready

Use `waitForEditModalReady(modal, expectedText?)`.

Contract:

- Modal is attached.
- Loading state is hidden.
- Textarea value is loaded (optional assertion).
- Textarea is editable.

## Deterministic storage setup

Use fixture helpers that seed extension storage through popup context instead of per-test ad hoc setup.

- `setExtensionSettings(context, extensionId, settings)` in `test/e2e/fixtures/extension-storage.ts`

Contract:

- Seeds `sessions`, `activeDid`, and `settings` in one operation.
- Uses known DID/session fixture state for consistency.

## Flake-avoidance rules

- Prefer helper-based readiness checks over hard-coded timeout sleeps.
- Keep network mocking route-based and explicit per scenario.
- Use user-visible assertions first (`role`, text, attached/visible state), then payload assertions.
- Avoid asserting transient intermediate UI state unless the test specifically targets transitions.

## Adding new E2E tests

1. Choose or create a journey ID and annotate the spec with it.
2. Reuse existing fixture helpers for readiness and storage setup.
3. Add user-visible assertions before internal payload assertions.
4. Run browser-targeted E2E task(s) for changed scope.
5. Update the journey inventory baseline in this document when adding new journeys.
