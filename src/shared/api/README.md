# Shared API helpers

## `at-uri.ts`

Use the AT URI helpers to normalize post references from raw AT URIs, Bluesky web URLs, or DOM elements already discovered by the content script.

### Examples

- `parseAtUri('at://did:plc:alice/app.bsky.feed.post/3kq2abc')`
- `parseBskyPostUrl('https://bsky.app/profile/alice.test/post/3kq2abc')`
- `parseAtUriFromElement(postElement)`

All helpers return a normalized object with:

- `uri`
- `repo`
- `collection`
- `rkey`
