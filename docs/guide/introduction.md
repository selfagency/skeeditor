# Introduction

> **They said Bluesky would never have an edit button. We simply disagreed.** 🦋✏️

**skeeditor** is a cross-browser extension that adds the **✏️ Edit** button to your posts on [bsky.app](https://bsky.app) that you've been waiting for since the day you joined. Click it, fix whatever needs fixing, save — and the post is updated via the official AT Protocol API without you ever leaving the page. No more deleting and reposting. No more screenshots of your own typos in the replies. Just edit.

## 🔧 How it works

Bluesky posts are stored as records in the AT Protocol repository. skeeditor authenticates with your Bluesky account using OAuth 2.0 + PKCE, fetches the current record from the PDS (Personal Data Server), opens a slick in-page editor pre-filled with your original text, then writes the updated record back when you save.

Rich-text facets (links, mentions, hashtags) are re-detected from the edited text and recalculated at the correct UTF-8 byte offsets before the record is written, so formatting is preserved correctly. Your post comes out the other side looking like it was always meant to be that way. 💅

## Supported browsers

| Browser | Status       | Minimum version                                            |
| ------- | ------------ | ---------------------------------------------------------- |
| Chrome  | ✅ Supported | 120+                                                       |
| Firefox | ✅ Supported | 125+ (Nightly / Developer Edition recommended for testing) |
| Safari  | ✅ Supported | macOS 14+ (Sonoma)                                         |

## 🚀 Current status

skeeditor is an early-access project — but the important bits work. The core edit flow (sign in → edit → save) is complete and tested. Check the [GitHub releases page](https://github.com/selfagency/skeeditor/releases) for the latest published version.

## 🚫 What skeeditor does not do

Let's set expectations (for now):

- It does not edit root posts that other people have replied to if the Bluesky character limit would be exceeded after the edit.
- It does not support editing embedded images or videos (text-only edits for now — we're working on it 🫡).
- It does not edit posts on behalf of other accounts. Your typos are your own.
- It does not transmit any data except to `bsky.social` (the Bluesky PDS) for authentication and record operations. Your data stays between you and Bluesky.

## 👉 Next steps

- [Install the extension →](./installation)
- [Learn how to use it →](./usage)
