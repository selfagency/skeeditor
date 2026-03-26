# FAQ

## General

### Can I edit any post?

You can only edit your own posts — the ones written by the account you signed in with. skeeditor adds the Edit button only to posts authored by your DID.

### Can I edit posts that other people have replied to?

Yes. Editing a post never changes its AT-URI or CID, so existing replies remain attached. Note that while existing replies remain linked, they were written in response to your original text — editing may change the context of those replies.

### Does editing notify my followers?

No. Editing a record in the AT Protocol does not generate a new feed event. Your followers will not receive a notification. Downstream Bluesky indexers such as AppView will pick up the change the next time they process your repository, but the update will not appear as a new post in feeds.

### Will the "edited" indicator appear on my post?

The Bluesky platform does not currently display an edited indicator on posts. This is a Bluesky product decision, not something skeeditor controls.

---

## Signing in

### Why does sign-in open a new tab?

OAuth requires a browser redirect to the authorization server (bsky.social). Browser extensions cannot intercept HTTPS redirects in a popup window, so skeeditor opens a dedicated tab, completes the OAuth flow there, and then closes the tab automatically.

### I closed the sign-in tab by accident. What do I do?

The OAuth flow will time out. Click **Sign In** in the popup again to start a fresh flow.

### Do I need to sign in every time?

No. skeeditor stores your refresh token and automatically renews it in the background. You should remain signed in indefinitely as long as your Bluesky session is active. If Bluesky revokes your token (e.g. you change your password), the popup will prompt you to re-authorize.

---

## Editing

### What is the character limit for edits?

300 characters — same as a new Bluesky post.

### Can I add or remove images and videos?

Not yet. The current version edits text only. Embeds are preserved as-is when you save; you cannot add, remove, or replace them through skeeditor.

### I edited a post but the page still shows the old text. Why?

bsky.app may have cached the post. Try refreshing the page. The edit is saved on the server — you can verify by opening the post directly.

### What does "Conflict detected" mean?

This means the post was updated (by another device, app, or browser extension) between when you opened the editor and when you clicked Save. skeeditor noticed the mismatch via the record's CID and is preventing a silent overwrite. You can reload the current version or force-save your version. See [Conflict Handling](../dev/conflicts) for details.

---

## Cross-browser

### Which browsers are supported?

Chrome 120+, Firefox 125+, and Safari on macOS 14+ (Sonoma). See [Installation](./installation) for browser-specific instructions.

### Is there a mobile version?

Not yet. Mobile browsers have more restricted extension APIs. A future release may target Firefox for Android, which has better extension support than mobile Chrome or Safari.

---

## Privacy and security

### Does skeeditor see my Bluesky password?

No. The extension uses OAuth 2.0 + PKCE. You authenticate directly on bsky.social; skeeditor only ever holds the OAuth tokens, never your password.

### Does skeeditor send my posts to any server other than Bluesky?

No. All network requests go to `bsky.social`. There are no intermediate proxies, analytics endpoints, or skeeditor-operated servers. See [Privacy & Security](./privacy) for the full list of network destinations.

### Is skeeditor open source?

Yes, MIT licence. The full source is at [github.com/selfagency/skeeditor](https://github.com/selfagency/skeeditor).
