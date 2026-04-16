# E2E Journey Matrix

This matrix is the canonical cross-browser journey map for Skeeditor extension E2E.

## Purpose

- Enumerate all critical user journeys.
- Define user-visible assertions for each journey.
- Capture browser-specific execution deltas.
- Provide journey IDs for traceable parity and CI policy.

## Journey matrix

| Journey ID | Journey                          | Primary user-visible assertions                                                     | Chrome path                                        | Firefox path                                        | Browser deltas / notes                                                  |
| ---------- | -------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| `J-001`    | Extension popup bootstrap        | Popup loads, heading visible, sign-in CTA visible when signed out                   | Playwright Chromium                                | web-ext Firefox run                                 | Extension loading mechanism differs; assertions remain identical        |
| `J-002`    | OAuth sign-in flow handoff       | Sign-in triggers auth tab/open flow and authenticated UI appears after callback     | Playwright Chromium + mocked callback where needed | web-ext + Firefox callback path                     | Callback interception differs by browser runtime behavior               |
| `J-003`    | Reauthorize expired session      | Reauthorize action available and session restored to authenticated state            | Playwright Chromium                                | web-ext Firefox run                                 | Token refresh and callback timing may differ                            |
| `J-004`    | Sign out (all sessions)          | Signed-in UI transitions to signed-out UI and edit controls disappear after refresh | Playwright Chromium                                | web-ext Firefox run                                 | Storage/session lifecycle differs for temporary add-ons                 |
| `J-005`    | Multi-account list and switch    | Accounts list visible, active indicator moves to selected account                   | Playwright Chromium                                | web-ext Firefox run                                 | None (shared component behavior)                                        |
| `J-006`    | Sign out single account          | Removed account disappears from list while others remain                            | Playwright Chromium                                | web-ext Firefox run                                 | None (shared component behavior)                                        |
| `J-007`    | Content-script initialization    | Page gets initialization marker and own post processing completes                   | Playwright Chromium (`waitForContentScriptReady`)  | web-ext Firefox run                                 | Startup timings differ; use state marker not sleeps                     |
| `J-008`    | Own-post edit button visibility  | Edit button appears on own post only, absent on others                              | Playwright Chromium                                | web-ext Firefox run                                 | DOM rendering timing varies; use role/locator + readiness helpers       |
| `J-009`    | Unauthenticated visibility rules | No edit controls shown when no active session                                       | Playwright Chromium                                | web-ext Firefox run                                 | Temporary install/session semantics in Firefox can persist unexpectedly |
| `J-010`    | Edit modal load readiness        | Modal opens with loading transition complete and textarea editable                  | Playwright Chromium (`waitForEditModalReady`)      | web-ext Firefox run                                 | Modal attachment timing can vary                                        |
| `J-011`    | Save strategy: edit in place     | Save succeeds and payload preserves original `createdAt`                            | Playwright Chromium (capture PUT body)             | web-ext Firefox run with network inspection harness | Request inspection mechanism differs                                    |
| `J-012`    | Save strategy: recreate record   | Save succeeds via applyWrites delete+create and fresh `createdAt`                   | Playwright Chromium (capture applyWrites body)     | web-ext Firefox run with network inspection harness | Request inspection mechanism differs                                    |
| `J-013`    | Conflict handling                | Conflict save shows explicit retry/reload warning message                           | Playwright Chromium                                | web-ext Firefox run                                 | Same UX expectation; transport setup differs                            |
| `J-014`    | Edit time limit enforcement      | Older posts become non-editable and user sees limit message                         | Playwright Chromium                                | web-ext Firefox run                                 | Clock/timing setup may differ                                           |
| `J-015`    | Options settings persistence     | Settings save success feedback and persisted values reload correctly                | Playwright Chromium                                | web-ext Firefox run                                 | None (shared settings component)                                        |
| `J-016`    | Labeler prompt display/dismiss   | Labeler prompt appears when pending, open/dismiss behavior updates UI               | Playwright Chromium                                | web-ext Firefox run                                 | None (popup component behavior)                                         |
| `J-017`    | Edited/archived interception     | Edited/archived interactions show expected history/original-text behavior           | Playwright Chromium                                | web-ext Firefox run                                 | Dialog injection timing may differ                                      |
| `J-018`    | Devnet real-network save         | Edit persists to live devnet PDS and read-back confirms update                      | Chromium devnet Playwright                         | Firefox devnet web-ext path                         | Tooling constraints differ; same read-back expectation                  |
| `J-019`    | Devnet real-network conflict     | External mutation causes conflict warning on local save                             | Chromium devnet Playwright                         | Firefox devnet web-ext path                         | Same outcome, different harness plumbing                                |

## Parity acceptance criteria

For a journey ID to be considered parity-complete:

1. The same journey ID is implemented in both Chrome and Firefox paths.
2. Both implementations assert user-visible outcome(s) first.
3. Browser-specific assertions are additive and do not replace core outcome checks.
4. Each implementation runs in CI on its respective required job.
5. Any temporary exception must be documented as an explicit waiver with reason and expiry.

## Browser-specific constraints tracked in this phase

- Firefox automated extension execution in this cycle is web-ext-first.
- Playwright Firefox extension loading remains non-primary due upstream limitations.
- Chromium uses persistent context extension load with readiness helpers and route-based fixtures.

## Mapping to current suites

- Chromium local: `test/e2e/chrome.spec.ts`
- Chromium devnet: `test/e2e/chrome-devnet.spec.ts`
- Firefox local scaffold: `test/e2e/firefox.spec.ts`
- Firefox devnet scaffold: `test/e2e/firefox-devnet.spec.ts`

Phase 2 and Phase 3 implement full parity against this matrix; Phase 4 enforces it in CI.
