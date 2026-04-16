# E2E Bug Remediation Workflow

This document defines how E2E test failures are classified, triaged, and fixed in this project.

## Failure Classification

Every E2E failure belongs to exactly one of the following classes:

| Class              | Definition                                 | Example                                    |
| ------------------ | ------------------------------------------ | ------------------------------------------ |
| **Product bug**    | Extension or content-script logic is wrong | Edit modal saves wrong text                |
| **Flake**          | Test passes on re-run without code changes | Timing-sensitive assertion                 |
| **Infrastructure** | External system or environment failure     | devnet unreachable, browser binary missing |

Determining the class is the first step of any remediation. Label the issue accordingly before proceeding.

## Product Bug Remediation

1. **Reproduce** the failure locally with `task test:e2e:chromium` (or `task test:e2e:firefox` for Firefox regressions).
2. **Write a failing test first.** Add or amend the E2E test that directly exercises the broken behavior. The test must fail before any source changes.
3. **Fix the source** with the minimum change needed to make the new test green.
4. **Verify no regressions** — run the full Chromium suite and confirm the count of passing tests did not drop.
5. **Commit** with a message that references the journey ID (e.g., `fix(content): restore J-010 edit-modal load readiness`).

## Flake Remediation

Flakes erode confidence in the suite. Treat them with urgency equal to product bugs.

### Acceptance criteria for a stabilized test

A test is considered stable when:

- It passes on 10 consecutive local runs without code changes.
- It passes in CI on at least 3 consecutive runs.
- No `page.waitForTimeout` or hard-coded sleep is present in the test.

### Stabilization playbook

1. **Isolate** — run only the flaky test to confirm it reproduces: `task test:e2e:chromium -- --grep "test name"`.
2. **Classify the root cause** from this ordered list:
   - Race with content-script initialization → add `waitForContentScriptReady`.
   - Race with modal loading state → add `waitForEditModalReady`.
   - Network mock timing → assert on request interception rather than a delay.
   - Storage seed race → use `setExtensionSettings` or `seedPopupAuthState` _before_ navigating.
   - Selector fragility → migrate to `getByRole` / `getByLabel`.
3. **Apply fix** targeting the specific root cause. Do not add blanket `waitForTimeout` calls.
4. **Document** the stabilization in the commit message (e.g., `test(e2e): stabilize J-013 conflict test — wait for textarea to load initial text`).

## Infrastructure Failure Remediation

Infrastructure failures (devnet down, missing browser binary, build failure) should not result in test fixes. Instead:

1. **Restore the environment** (restart devnet, re-install browser, rebuild the extension).
2. **Re-run the suite** to confirm the failure was environmental.
3. **Add a health check** to the task or CI step if the same failure recurs.

## Remediation Logging Format

When filing an issue or bean for a confirmed E2E failure, use this format in the body:

```text
**Journey:** J-XXX — <title>
**Class:** product bug | flake | infrastructure
**Failure mode:** <one-line description>
**Reproduced locally:** yes | no
**Failing test (before fix):** <test name or file:line>
**Fix summary:** <one-line description of change>
**Regression assertion:** <test name that prevents recurrence>
```

## Regression Assertions

Every product bug fix must ship with at least one new or tightened assertion that would have caught the original failure. This assertion must appear in the same commit as the fix.

Acceptable regression assertions include:

- A new `expect` inside an existing test
- A new test case in the same `describe` block
- A new journey row in `journey-parity.json` that maps to the corrected behavior

## See Also

- [E2E Harness Contracts](e2e-harness.md)
- [Journey Matrix](e2e-journey-matrix.md)
- [Testing Guide](testing.md)
