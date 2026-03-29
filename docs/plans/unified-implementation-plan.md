# Unified Implementation Plan — Runtime Hardening + Web Components Refactor

## TL;DR

This plan combines all discovered issues into one execution roadmap that:

- fixes runtime correctness regressions first,
- refactors UI primitives to proper Custom Elements,
- hardens performance and security,
- reconciles docs with current WXT + ATProto behavior,
- validates with focused and full-suite testing.

It preserves existing auth/message/XRPC behavior while modernizing architecture and removing known correctness/performance risks.

---

## Goals

- Restore and protect runtime correctness (especially message routing and content-script behavior).
- Refactor account card, toast, and edit modal into standards-compliant Web Components.
- Reduce avoidable DOM-scan overhead and lifecycle leaks in content script.
- Improve security hygiene (logging and key-handling documentation/policy).
- Bring docs in `docs/` into alignment with implementation (`wxt/browser`, WXT entrypoints, message catalog).

## Non-goals

- No feature expansion beyond current behavior.
- No auth flow redesign or XRPC contract changes.
- No UI redesign outside migration to componentized equivalents.

---

## External documentation constraints integrated into this plan

### Web Components + shadow DOM

- Use autonomous custom elements (`extends HTMLElement`) for compatibility and simplicity.
- Register with `customElements.define(...)` only once (guard with `customElements.get(...)`) to avoid duplicate-define runtime errors.
- Use `observedAttributes` + `attributeChangedCallback` for attribute-driven rendering.
- Events crossing shadow boundaries must use `{ bubbles: true, composed: true }`.

### Cross-browser extension messaging

- Preserve callback-safe `runtime.onMessage` async response strategy (`return true` + `sendResponse`) for compatibility.
- Do not refactor background listener into promise-only semantics.

### WXT packaging/runtime

- Keep `defineBackground` / `defineContentScript` entrypoint patterns intact.
- Maintain content-script behavior in line with WXT registration and CSS injection conventions.

### ATProto/XRPC consistency

- Keep `query` vs `procedure` behavior intact (`GET` vs `POST` semantics).
- Keep standard XRPC error handling assumptions (`error` + `message`) robust.
- Preserve existing `createRecord` / `putRecord` / `getRecord` / `uploadBlob` semantics and validation flags.
- Avoid protocol-level behavior drift as part of UI refactor.

### Slingshot usage posture

- Treat Slingshot as optional acceleration layer, not a trust/correctness source.
- Keep canonical correctness path independent from cache acceleration assumptions.

---

## Workstreams and sequencing

## Phase 0 — Baseline and guardrails (short)

1. Confirm baseline tests/typecheck pass on current branch.
2. Add or update regression test placeholders for:
   - `CREATE_RECORD` routing,
   - account-card event propagation,
   - edit-modal lifecycle behavior,
   - toast lifecycle cleanup.

**Rationale:** lock behavior before structural refactors.

---

## Phase 1 — Critical correctness fixes (blocking)

1. Fix `KNOWN_TYPES` gate in `src/background/message-router.ts` to include `CREATE_RECORD`.
2. Expand `test/unit/background/message-router.test.ts` for:
   - `CREATE_RECORD` success path,
   - invalid payload path,
   - unauthenticated path.
3. Remove duplicated `requiresReauth` branch in `src/content/content-script.ts` (if still present).

**Exit criteria:** no valid `CREATE_RECORD` request is rejected as unknown; tests explicitly cover regression.

---

## Phase 2 — Proper Web Components migration (core refactor)

### 2.1 New shared account card component

Create `src/shared/components/account-card.ts`.

Requirements:

- `class AccountCard extends HTMLElement`
- Guarded registration: `account-card`
- Shadow DOM + `globalStyles`
- Observed attributes:
  - `did`
  - `handle`
  - `is-active`
  - `switch-label`
  - `remove-label`
  - `show-reauthorize`
- Emits:
  - `account-switch`
  - `account-remove`
  - `account-reauthorize`

  with `{ bubbles: true, composed: true, detail: { did } }`

### 2.2 New toast component

Create `src/content/toast.ts`.

Requirements:

- `class SkeeditorToast extends HTMLElement`
- Guarded registration: `skeeditor-toast`
- Reads message from attribute/property contract
- Self-dismiss ~3s with internal timer
- Clears timer in `disconnectedCallback`
- Shadow DOM-contained style/animation

### 2.3 Edit modal conversion

Refactor `src/content/edit-modal.ts`.

Requirements:

- Convert from wrapper-object style to `EditModal extends HTMLElement`
- Constructor: `super()` + `attachShadow({ mode: 'open' })`
- Guarded registration: `edit-modal`
- Preserve API behavior (`open`, `close`, `setError`, `setSuccess`, etc.)
- Preserve focus-management and cleanup semantics

### 2.4 Consumer migrations

#### Popup

Update `src/popup/auth-popup.ts`:

- Replace string `accountCard()` output with `<account-card>` usage.
- Add delegated listeners on shadow root for composed account events.
- Remove class-based wiring (`.account-switch`, `.account-sign-out`, per-button dataset scraping).

#### Options

Update `src/options/options.ts`:

- Replace string rendering with `<account-card>` usage.
- Delegate account events from `accountsList`.
- Remove class-selector and `data-did` scraping in parent.

#### Content script toast

Update `src/content/content-script.ts`:

- Remove inline imperative `showToast()` DOM/shadow factory.
- Import/register new toast component and instantiate element directly.

### 2.5 Style source update

Update `src/shadow-styles.css`:

- Add `@source '../shared/components/**/*.ts'`.

### 2.6 Legacy helper retirement

Retire `src/shared/utils/account-ui.ts` after all usages are migrated.

**Exit criteria:** popup/options/content-script behavior unchanged from user perspective, with componentized internals and no duplicate element registration errors.

---

## Phase 3 — Dataflow/performance hardening

1. Refactor repeated scan/apply hotspots in `src/content/content-script.ts`:
   - `fetchEditedPostsInView`
   - `fetchOwnPostsInView`
   - `fetchPermalinkPost`
   - `handleLabelPush`
2. Build one-pass post indexes per cycle; avoid repeated `findPosts(document)` inside nested loops.
3. Add deterministic update ordering when concurrent triggers race (scan/fetch vs push updates).
4. Tighten listener lifecycle symmetry for edited-label listeners and cleanup.

**Exit criteria:** same functionality with materially fewer redundant scans and stable ordering under concurrent triggers.

---

## Phase 4 — Security and operational hygiene

1. Reduce or gate sensitive runtime logs in `src/background/message-router.ts` (avoid routine DID/URI/CID logging outside debug intent).
2. Reduce unnecessary `innerHTML` exposure in options rendering by relying on component boundaries and explicit contracts.
3. Document and decide DPoP key persistence posture in `src/shared/auth/dpop.ts`:
   - keep current behavior with explicit threat model + constraints, or
   - introduce rotation/TTL policy.

**Exit criteria:** safer default logging and explicit key-management rationale documented.

---

## Phase 5 — Documentation parity update

Update docs for implementation truthfulness:

- `docs/platform.md`
- `docs/dev/platform.md`
- `docs/messages.md`
- `docs/dev/build.md` (targeted checks)

Required updates:

- reflect WXT entrypoint architecture and `wxt/browser` usage,
- remove stale legacy manifest/polyfill assumptions,
- ensure message catalog includes current message types and notification semantics,
- align docs with `wxt.config.ts` and `src/shared/messages.ts`.

**Exit criteria:** docs and code tell the same story; no stale architecture guidance remains.

---

## Testing & verification plan

## Automated

1. Unit tests:
   - `message-router.test.ts` CREATE_RECORD regression coverage
   - popup/options tests for custom event-driven account actions
   - edit-modal tests updated to element-native API
   - toast tests for lifecycle + auto-dismiss cleanup
2. Content-script behavior tests for scan dedup/indexing and listener cleanup symmetry.
3. Typecheck + lint pass with zero new diagnostics.
4. Full test suite pass (unit/integration/e2e as configured).

## Manual smoke checks

1. Popup:
   - sign-in/out pathways unaffected,
   - switch/remove/reauthorize account actions work.
2. Options:
   - account list renders and actions fire correctly,
   - add-account/settings flow unchanged.
3. Content:
   - toast renders and dismisses consistently,
   - edit modal open/save/error/focus behavior unchanged,
   - edited-post updates still apply correctly in feed/thread/permalink contexts.

## Static drift checks

Search to confirm migration completeness:

- no `account-ui` imports remain,
- no old class-based account action wiring remains,
- no wrapper `.element` assumptions for edit modal remain,
- no stale docs references to removed/legacy build patterns.

---

## PR batch strategy (recommended)

- **PR 1 (high priority):** Phase 1 correctness fixes + tests.
- **PR 2 (structural):** Phase 2 Web Components migration + tests.
- **PR 3 (runtime quality):** Phase 3 performance/lifecycle hardening.
- **PR 4 (hygiene/docs):** Phase 4 security hygiene + Phase 5 docs parity.

This keeps risk isolated, reviewable, and reversible.

---

## Risk register

1. **Behavior drift during edit-modal class-shape migration**
   - Mitigation: compatibility-oriented tests first; preserve API semantics.
2. **Custom element registration collisions in test/dev reload loops**
   - Mitigation: guard every define call.
3. **Shadow boundary event loss**
   - Mitigation: enforce composed+bubbling events and delegated listeners.
4. **Performance refactor introduces update ordering regressions**
   - Mitigation: deterministic ordering rules + regression tests.
5. **Docs updated without code reference validation**
   - Mitigation: cross-check each doc claim against `wxt.config.ts` and source symbols.

---

## Final deliverable

One coherent implementation spanning correctness, UI architecture modernization, performance/security hardening, and docs parity—without changing protocol/auth semantics.
