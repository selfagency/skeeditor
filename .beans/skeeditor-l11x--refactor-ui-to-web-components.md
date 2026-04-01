---
# skeeditor-l11x
title: Refactor UI to web components
status: in-progress
type: feature
priority: normal
created_at: 2026-03-31T14:45:43Z
updated_at: 2026-03-31T14:45:58Z
branch: feat/skeeditor-l11x-refactor-ui-web-components
---
Refactor all UI elements (EditModal, EditHistoryModal, options page sections) to proper web components following the existing auth-popup/account-card/toast patterns.

## Todo

- [ ] Convert EditModal class to proper HTMLElement web component
- [ ] Convert EditHistoryModal class to proper HTMLElement web component
- [ ] Create `<options-status>` web component
- [ ] Create `<options-accounts>` web component
- [ ] Create `<options-settings>` web component
- [ ] Update options entrypoint HTML and main.ts to use new components
- [ ] Update content-script.ts to use new web component APIs
- [ ] Delete old src/options/options.ts and src/options/options.html
- [ ] Update existing tests
- [ ] Run full test suite and verify
