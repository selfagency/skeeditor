# Using Skeeditor

## Sign in

Skeeditor uses Bluesky's official OAuth 2.0 flow. Your password is never stored or even seen by the extension.

1. Click the **Skeeditor** icon in your browser toolbar.
2. The popup shows a **Sign In** button. Click it.
3. A new tab opens to `bsky.social` (the Bluesky authorization server).
4. Log in with your Bluesky credentials and approve the access request.
5. The tab closes automatically and the popup now shows your handle and account controls.

::: info Re-authorization
OAuth tokens expire. When your session expires, the popup will prompt you to **Re-authorize**. This repeats the same OAuth flow but does not require you to re-enter your password if Bluesky still has an active session for your browser.
:::

---

## Manage multiple accounts

You can sign in to more than one Bluesky account. The active account is the one used when injecting Edit badges and saving edits.

### Switch accounts

1. Click the **Skeeditor** toolbar icon.
2. The popup lists all signed-in accounts. Click any account to make it active.

The content script immediately reflects the new active account — Edit badges appear only on posts by the newly active user.

### Add another account

1. Click the **Skeeditor** toolbar icon.
2. Open the **Settings** page (gear icon or **Options** link).
3. Click **Add account** and complete the OAuth flow for the new account.

### Sign out a single account

1. Click the **Skeeditor** toolbar icon.
2. Find the account you want to remove.
3. Click the **Sign Out** button next to it.

Only that account's session is deleted. Other accounts remain signed in.

### Sign out of all accounts

1. Click the **Skeeditor** toolbar icon.
2. Click **Sign Out All**.

---

## Edit a post

1. Browse to [bsky.app](https://bsky.app) while signed in via Skeeditor.
2. Any post written by your active account will show a small **✏ Edit** badge in the bottom‑right corner.
3. Click **Edit** to open the editor modal.

### The edit modal

The editor modal contains:

- A **text area** pre-filled with the full current text of the post.
- A **character counter** that tracks the 300-grapheme limit.
- An **Add Media** button to attach or remove images and videos.
- A **Save** button to write the changes back to your Bluesky repository.
- A **Cancel** button to close without saving.

Edit the text as needed, then click **Save**.

::: warning Facets are recalculated
When you save, Skeeditor scans the new text for links (URLs), @mentions, and #hashtags and recalculates the byte-offset facets automatically. You don't need to do anything special — just type normally.
:::

### After saving

After a successful save the modal closes and the post text on the page updates to reflect your edits. Other users will see the updated text the next time they load or refresh the page.

If you have subscribed to the Skeeditor labeler (`@skeeditor.link`), an "edited" label will be applied to the post so others can see it has been modified.

---

## Edit time limit

You can configure a time window after which the Edit button is hidden on older posts. This is useful if you only want to allow fast corrections rather than open-ended editing.

1. Click the **Skeeditor** toolbar icon.
2. Click **Options** (or the gear icon).
3. Under **Edit time limit**, choose a window between 0.5 and 5 minutes, or select **No limit** to allow editing at any time.

The setting is stored locally in the extension and takes effect immediately.

---

## Labeler consent

After signing in for the first time, Skeeditor will ask whether you want to subscribe to the **Skeeditor labeler** (`@skeeditor.link`). The labeler is a core part of how Skeeditor communicates that a post has been edited. When you subscribe:

- Posts you edit through Skeeditor will be marked with an **"edited"** label visible to other Bluesky users who also subscribe to the labeler.
- The label is informational only — it does not suppress or hide the post.

You can choose **Subscribe** to opt in or **Not now** to decline. Declining has no effect on the editing functionality, but without the labeler subscription other users will have no way to see that a post was edited.

You can manage your labeler subscriptions at any time from your [Bluesky moderation settings](https://bsky.app/moderation).

---

## Conflict handling

If the post was updated elsewhere (for example, by another device or app) after the editor was opened, Skeeditor detects the CID mismatch and shows a **conflict warning** before overwriting.

The warning describes what happened and asks you to:

- **Reload** — discard your edits and reload the current version of the post, or
- **Force save** — overwrite the post with your edited version regardless.

See [Conflict Handling](../dev/conflicts) in the developer docs for the full technical details.

---

## Sign out

1. Click the **Skeeditor** toolbar icon.
2. Click **Sign Out** next to your account (or **Sign Out All**).

Skeeditor immediately deletes the stored session. The edit badges disappear from bsky.app until you sign in again.
