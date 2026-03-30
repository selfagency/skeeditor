# FAQ

## General

### Can I edit any post?

You can only edit your own posts — the ones written by the account you signed in with. Skeeditor adds the Edit button only to posts authored by your DID.

### Can I edit posts that other people have replied to?

Yes. Editing a post never changes its AT-URI or CID, so existing replies remain attached. Note that while existing replies remain linked, they were written in response to your original text — editing may change the context of those replies.

### Does editing notify my followers?

No. Editing a record in the AT Protocol does not generate a new feed event. Your followers will not receive a notification. Downstream Bluesky indexers such as AppView will pick up the change the next time they process your repository, but the update will not appear as a new post in feeds.

### Will the "edited" indicator appear on my post?

If you have subscribed to the **Skeeditor labeler** (`@skeeditor.link`), an "edited" label will be applied to your post after you save an edit. Other Bluesky users who also subscribe to the Skeeditor labeler will see this label on your post.

The labeler is a core part of how Skeeditor communicates that a post has been edited — without it, there is no visible indicator on the Bluesky platform. You can subscribe during the initial sign-in flow or at any time from your [Bluesky moderation settings](https://bsky.app/moderation). See [Using Skeeditor → Labeler consent](./usage#labeler-consent) for more details.

---

## Signing in

### Why does sign-in open a new tab?

OAuth requires a browser redirect to the authorization server (bsky.social). Browser extensions cannot intercept HTTPS redirects in a popup window, so Skeeditor opens a dedicated tab, completes the OAuth flow there, and then closes the tab automatically.

### I closed the sign-in tab by accident. What do I do?

The OAuth flow will time out. Click **Sign In** in the popup again to start a fresh flow.

### Do I need to sign in every time?

No. Skeeditor stores your refresh token and automatically renews it in the background. You should remain signed in indefinitely as long as your Bluesky session is active. If Bluesky revokes your token (e.g. you change your password), the popup will prompt you to re-authorize.

---

## Editing

### What is the character limit for edits?

300 graphemes — same as a new Bluesky post. This means the limit is based on user-perceived characters, not code points or bytes.

### Can I add or remove images and videos?

Yes. The edit modal includes an **Add Media** button that lets you attach new images or videos, and you can remove existing media from the post. Existing embeds (images, videos, external link cards) are preserved when you save unless you explicitly remove them.

### I edited a post but the page still shows the old text. Why?

bsky.app may have cached the post. Try refreshing the page. The edit is saved on the server — you can verify by opening the post directly.

### What does "Conflict detected" mean?

This means the post was updated (by another device, app, or browser extension) between when you opened the editor and when you clicked Save. Skeeditor noticed the mismatch via the record's CID and is preventing a silent overwrite. You can reload the current version or force-save your version. See [Conflict Handling](../dev/conflicts) for details.

---

## Cross-browser

### Which browsers are supported?

Chrome 120+ and Firefox 125+. Safari support is coming soon. See [Installation](./installation) for browser-specific instructions.

### Is there a mobile version?

Not yet. Mobile browsers have more restricted extension APIs. A future release may target Firefox for Android, which has better extension support than mobile Chrome or Safari.

---

## Privacy and security

### Does Skeeditor see my Bluesky password?

No. The extension uses OAuth 2.0 + PKCE. You authenticate directly on bsky.social; Skeeditor only ever holds the OAuth tokens, never your password.

### Does Skeeditor collect any data?

No. Skeeditor collects absolutely no user data, telemetry, analytics, or identifying information. We keep no records whatsoever — not even during the authentication flow through our website. See [Privacy & Security](./privacy) for full details.

### Does Skeeditor send my posts to any server other than Bluesky?

No. All network requests go to your Bluesky PDS (typically `bsky.social`) and, if you subscribe, the Skeeditor labeler at `labeler.skeeditor.link`. There are no intermediate proxies, analytics endpoints, or other third-party servers. See [Privacy & Security](./privacy) for the full list of network destinations.

### Is Skeeditor open source?

Yes, MIT licence. The full source is at [github.com/selfagency/skeeditor](https://github.com/selfagency/skeeditor).
