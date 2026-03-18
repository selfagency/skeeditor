---
# skeeditor-02o8
title: 'Epic 4: Content Script & UI'
status: todo
type: epic
priority: critical
created_at: 2026-03-18T14:25:30Z
updated_at: 2026-03-18T14:43:34Z
parent: skeeditor-bmr4
---

Content script to detect posts, inject Edit button, build edit modal and wire to background via messaging. Preserve facets and embeds.

UI approach: Implement interactive UI pieces (edit modal, popup) as framework-agnostic Web Components (Shadow DOM) so components are encapsulated and portable across browsers.

## Todo

- [ ] Implement MutationObserver and post detection
- [ ] Inject Edit button and wire to Web Component modal
- [ ] Ensure message passing and background wiring works with Web Components
- [ ] Preserve facets and embeds through edit flow
