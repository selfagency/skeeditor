---
# skeeditor-vklb
title: Convert and test in Safari via Xcode
status: todo
type: task
priority: normal
created_at: 2026-03-18T14:30:25Z
updated_at: 2026-03-18T14:51:50Z
parent: skeeditor-7d7e
---

Run `xcrun safari-web-extension-converter`, open generated Xcode project, and test the extension on Safari — document any manual steps required.

## Todo

- [ ] Run `xcrun safari-web-extension-converter` and capture required flags for our build
- [ ] Open generated Xcode project and wire signing/provisioning (manual step)
- [ ] Test Web Component Shadow DOM behavior in Safari (differences in CSS/custom properties)
- [ ] Document Safari-specific API gaps (e.g., webRequest limitations) and recommended degradations
- [ ] Add a manual test checklist in `docs/platform.md` for Safari QA
