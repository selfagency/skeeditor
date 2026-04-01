---
title: Copilot Instructions
description: TDD-driven browser extension development with Web Components and TypeScript
applyTo: '**'
---

## Scope

- Follow these instructions for all code changes unless a more specific project file says otherwise.
- Read local repository instructions first, including `.github/copilot-instructions.md`, `.github/instructions/`, and `CLAUDE.md` if present.
- Match the existing architecture, naming, and folder structure before introducing new patterns.
- Make the smallest safe change that solves the task.

## Core Workflow

- Use **test-driven development** for every feature, bug fix, and refactor:
  - write a failing test first
  - implement the minimum code to make it pass
  - refactor only while tests stay green
- Never write production code before the failing test exists.
- For bugs, reproduce the issue with a test before fixing it.
- Keep work incremental and easy to review.

## Browser Extension Rules

- Target **Manifest V3**.
- Use `webextension-polyfill` and prefer `browser.*` in shared code.
- Use `chrome.*` only in browser-specific shims when needed.
- Keep privileged logic in the background/service worker.
- Keep content scripts thin: read page state, send messages, render minimal UI.
- Use feature detection, not user-agent sniffing.
- Request the minimum permissions and host access required.

## Web Components Rules

- Build UI with **standards-based Web Components**.
- Prefer small, focused custom elements with clear responsibilities.
- Keep attribute/property sync explicit and predictable.
- Use shadow DOM when encapsulation helps; keep styles local and simple.
- Prefer semantic HTML inside components.
- Ensure keyboard access, visible focus, and accessible labels.
- Use ARIA only when semantic HTML is not enough.

## TypeScript Rules

- Use **strict TypeScript**.
- Prefer named exports.
- Add explicit return types to exported functions and async functions.
- Prefer `interface` for object shapes and `type` for unions, intersections, and mapped types.
- Avoid `any`; if unavoidable, keep it tightly scoped and justified.
- Keep functions small, readable, and easy to test.
- Prefer `async`/`await` over raw promise chains.

## Testing Rules

- Use the project’s test stack consistently.
- Test behavior, not implementation details.
- Keep tests isolated and deterministic.
- Prefer one behavior per test where practical.
- Mock only at boundaries:
  - browser extension APIs
  - network calls
  - storage
  - external services
- For Web Components, test:
  - rendering
  - attribute/property behavior
  - events
  - keyboard interaction
  - accessibility-relevant state
- For browser extensions, test:
  - message passing
  - storage behavior
  - permission-sensitive flows
  - background/content script boundaries
- Use E2E tests for real browser interactions and integration behavior.

## Quality Bar

- Prefer clarity over cleverness.
- Avoid premature abstraction.
- Do not add dependencies unless they clearly improve the solution.
- Remove dead code, commented-out code, and unused exports.
- Keep changes aligned with existing linting, formatting, and build rules.
- Measure before optimizing.

## Security

- Never hardcode secrets, tokens, or credentials.
- Sanitize and validate untrusted input at boundaries.
- Minimize permissions and exposed APIs.
- Avoid unsafe DOM insertion and unsafe HTML rendering.
- Do not assume user input is safe.
- Handle errors explicitly and avoid silent failures.

## Accessibility

- Use semantic HTML first.
- Ensure all interactive controls are keyboard accessible.
- Maintain visible focus states.
- Provide text labels for inputs and controls.
- Do not rely on color alone to convey meaning.
- Make custom elements accessible by default.

## Communication

- Be concise and direct.
- State assumptions clearly when needed.
- Ask before guessing if requirements are ambiguous.
- Reference files and symbols precisely when helpful.
- Prefer actionable guidance over speculation.
