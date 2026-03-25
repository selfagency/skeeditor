# Introduction

**skeeditor** is a cross-browser extension that adds an **Edit** button to your own posts on [bsky.app](https://bsky.app). Click it, change the text, save — and the post is updated via the official AT Protocol API without you leaving the page.

## How it works

Bluesky posts are stored as records in the AT Protocol repository. skeeditor authenticates with your Bluesky account using OAuth 2.0 + PKCE, fetches the current record from the PDS (Personal Data Server), opens an in-page editor pre-filled with your original text, then writes the updated record back when you save.

Rich-text facets (links, mentions, hashtags) are re-detected from the edited text and recalculated at the correct UTF-8 byte offsets before the record is written, so formatting is preserved correctly.

## Supported browsers

| Browser | Status       | Minimum version                                            |
| ------- | ------------ | ---------------------------------------------------------- |
| Chrome  | ✅ Supported | 120+                                                       |
| Firefox | ✅ Supported | 121+ (Nightly / Developer Edition recommended for testing) |
| Safari  | ✅ Supported | macOS 14+ (Sonoma)                                         |

## Current status

skeeditor is an early-access project. The core edit flow (sign in → edit → save) is complete and tested. Check the [GitHub releases page](https://github.com/selfagency/skeeditor/releases) for the latest published version.

## What skeeditor does not do

- It does not edit root posts that other people have replied to if the Bluesky character limit would be exceeded after the edit.
- It does not support editing embedded images or videos (text-only edits for now).
- It does not edit posts on behalf of other accounts.
- It does not transmit any data except to `bsky.social` (the Bluesky PDS) for authentication and record operations.

## Next steps

- [Install the extension →](./installation)
- [Learn how to use it →](./usage)
