---
layout: home

hero:
  name: skeeditor
  text: Edit your Bluesky posts
  tagline: A cross-browser extension that lets you edit your own posts directly on bsky.app, without leaving the page.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: alt
      text: Developer Docs
      link: /dev/architecture
    - theme: alt
      text: View on GitHub
      link: https://github.com/selfagency/skeeditor

features:
  - icon: ✏️
    title: In-place editing
    details: Click the edit button next to any of your own posts on bsky.app and edit the text right there — no copy-paste to a third-party site required.
  - icon: 🔒
    title: Secure by design
    details: Authenticates with Bluesky via OAuth 2.0 + PKCE. Tokens are stored only in your browser's extension storage, never sent anywhere else.
  - icon: 🌐
    title: Cross-browser
    details: Works on Chrome, Firefox, and Safari (macOS). Uses the standard WebExtension API via webextension-polyfill so the same codebase targets all three.
  - icon: ⚡
    title: Fast and lightweight
    details: Pure TypeScript, no UI framework overhead. The extension adds a single content script and a small background worker.
  - icon: 🦋
    title: Official Bluesky account
    details: Follow [@skeeditor.bsky.social](https://bsky.app/profile/skeeditor.bsky.social) for updates and support.
---
