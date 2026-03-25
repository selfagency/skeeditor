---
# skeeditor-pjwz
title: 'Epic 8: Code Quality & Bug Remediation'
status: in-progress
type: epic
priority: high
created_at: 2026-03-25T17:55:49Z
updated_at: 2026-03-25T17:57:16Z
parent: skeeditor-bmr4
---

Comprehensive remediation of issues identified in the full codebase audit (2026-03-25). Covers critical bugs, security hardening, accessibility, feature gaps, performance, test coverage, build config, and documentation.

## Phases

- Phase 1: Critical bugs (mention regex, Shadow DOM)
- Phase 2: Security & privacy (error leakage, DID validation, OAuth CSRF, DRY auth helpers)
- Phase 3: Accessibility (ARIA, focus trap, screen reader announcements, focus restoration)
- Phase 4: Feature gaps (edit window timing, options page, edited label persistence, MAX_POST_LENGTH constant)
- Phase 5: Performance (MutationObserver debounce, observer narrowing, DOM search scope)
- Phase 6: Test coverage (401 refresh, keyboard shortcuts, char limit, storage mock, Firefox E2E)
- Phase 7: Build & config (chrome min version, incognito mode, manifest validation, Vite asset hash)
- Phase 8: Code quality & docs (error class naming, platform detection fallback, undocumented APIs)

## Todo

- [ ] Phase 1: Fix mention regex and Shadow DOM (skeeditor-p1xx)
- [ ] Phase 2: Security hardening (skeeditor-p2xx)
- [ ] Phase 3: Accessibility improvements (skeeditor-p3xx)
- [ ] Phase 4: Feature gap remediation (skeeditor-p4xx)
- [ ] Phase 5: Performance improvements (skeeditor-p5xx)
- [ ] Phase 6: Test coverage improvements (skeeditor-p6xx)
- [ ] Phase 7: Build & config fixes (skeeditor-p7xx)
- [ ] Phase 8: Code quality & docs (skeeditor-p8xx)
