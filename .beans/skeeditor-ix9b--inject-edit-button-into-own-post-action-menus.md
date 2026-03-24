---
# skeeditor-ix9b
title: Inject "Edit" button into own-post action menus
status: completed
type: feature
priority: critical
created_at: 2026-03-18T14:29:10Z
updated_at: 2026-03-24T23:06:44Z
parent: skeeditor-02o8
blocked_by:
    - skeeditor-03tp
    - skeeditor-1e94
---

Add an Edit action to the post action menu only for the current user's posts; ensure a11y and non-intrusive styling. The Edit action should open the `edit-modal` Web Component when clicked.

## Todo

- [ ] Detect owner posts and insert Edit action
- [ ] Open `edit-modal` Web Component on click
- [ ] Ensure keyboard accessibility and ARIA attributes
- [ ] Test injection resilience against DOM changes
