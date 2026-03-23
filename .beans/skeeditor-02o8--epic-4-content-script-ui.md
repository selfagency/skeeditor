---
# skeeditor-02o8
title: 'Epic 4: Content Script & UI'
status: in-progress
type: epic
priority: critical
created_at: 2026-03-18T14:25:30Z
updated_at: 2026-03-23T17:19:00Z
parent: skeeditor-bmr4
branch: feat/02o8-content-script-ui
---

Content script to detect posts, inject Edit button, build edit modal and wire to background via messaging. Preserve facets and embeds.

UI approach: Implement interactive UI pieces (edit modal, popup) as framework-agnostic Web Components (Shadow DOM) so components are encapsulated and portable across browsers.

## Todo

- [ ] Implement MutationObserver and post detection
- [ ] Inject Edit button and wire to Web Component modal, honoring the configured edit window
- [ ] Ensure message passing and background wiring works with Web Components
- [ ] Preserve facets and embeds through edit flow, including visible edited labels

### Planned follow-up beans

- `skeeditor-mwhy` — add configurable edit window setting (30 seconds to 5 minutes)
- `skeeditor-xojb` — honor the configured edit window when rendering edit actions
- `skeeditor-n1ms` — display an edited label for extension-managed edited posts
