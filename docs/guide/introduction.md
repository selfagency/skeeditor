# Introduction

> **The edit button Bluesky never gave you. Until now.** 🦋✏️

**Skeeditor** is a cross-browser extension that adds the **✏️ Edit** button to your posts on [bsky.app](https://bsky.app). Spot a typo? Want to rephrase something? Just click Edit, make your change, and save — your post is updated in place without you ever leaving the page.

No more deleting and reposting. No more copying text into a third-party tool. Just a simple, friendly edit button right where it belongs.

## How it works

When you click Edit, Skeeditor talks directly to the Bluesky servers using the official AT Protocol API. It fetches your post, lets you change it, and writes it back — preserving your links, mentions, hashtags, embeds, and timestamps. Everything stays exactly the way it should.

If you subscribe to the Skeeditor labeler (`@skeeditor.link`), your edited posts will be tagged with an "edited" label so other users know the post was modified. This is entirely optional.

For the full technical details on how things work under the hood, check out the [Developer Docs](/dev/architecture).

## Supported browsers

| Browser | Status                | Minimum version    |
| ------- | --------------------- | ------------------ |
| Chrome  | ✅ Supported          | 120+               |
| Firefox | ✅ Supported          | 125+               |
| Safari  | 🔜 Coming soon        | macOS 14+ (Sonoma) |

## 🚀 Current status

Skeeditor is in active development. The core edit flow — sign in, edit, save — is fully working and tested across Chrome and Firefox. Multi-account support, labeler integration, and edit time limits are all live. Check the [GitHub releases page](https://github.com/selfagency/skeeditor/releases) for the latest version.

## 🚫 What Skeeditor does not do

- **No data collection.** Skeeditor collects absolutely no user data, telemetry, analytics, or identifying information. We keep no records whatsoever — not even during the authentication flow through our website. Your data stays between you and Bluesky.
- **No editing other people's posts.** You can only edit posts authored by accounts you've signed in with. Your typos are your own.
- **No exceeding the post limit.** Skeeditor enforces Bluesky's 300-grapheme limit and shows an error if your edit is too long.

## 👉 Next steps

- [Install the extension →](./installation)
- [Learn how to use it →](./usage)
