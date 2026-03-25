# Using skeeditor

## Sign in

skeeditor uses Bluesky's official OAuth 2.0 flow. Your password is never stored or even seen by the extension.

1. Click the **skeeditor** icon in your browser toolbar.
2. The popup shows a **Sign In** button. Click it.
3. A new tab opens to `bsky.social` (the Bluesky authorization server).
4. Log in with your Bluesky credentials and approve the access request.
5. The tab closes automatically and the popup now shows your handle and a **Sign Out** button.

::: info Re-authorization
OAuth tokens expire. When your session expires, the popup will prompt you to **Re-authorize**. This repeats the same OAuth flow but does not require you to re-enter your password if Bluesky still has an active session for your browser.
:::

---

## Edit a post

1. Browse to [bsky.app](https://bsky.app) while signed in via skeeditor.
2. Any post written by your account will show a small **✏ Edit** badge in the bottom‑right corner.
3. Click **Edit** to open the editor modal.

### The edit modal

The editor modal contains:

- A **text area** pre-filled with the full current text of the post.
- A **character counter** that tracks the 300-character limit.
- A **Save** button to write the changes back to your Bluesky repository.
- A **Cancel** button to close without saving.

Edit the text as needed, then click **Save**.

::: warning Facets are recalculated
When you save, skeeditor scans the new text for links (URLs), @mentions, and #hashtags and recalculates the byte-offset facets automatically. You don't need to do anything special — just type normally.
:::

### After saving

After a successful save the modal closes and the post text on the page updates to reflect your edits. Other users will see the updated text the next time they load or refresh the page.

---

## Conflict handling

If the post was updated elsewhere (for example, by another device or app) after the editor was opened, skeeditor detects the CID mismatch and shows a **conflict warning** before overwriting.

The warning describes what happened and asks you to:

- **Reload** — discard your edits and reload the current version of the post, or
- **Force save** — overwrite the post with your edited version regardless.

See [Conflict Handling](../dev/conflicts) in the developer docs for the full technical details.

---

## Sign out

1. Click the **skeeditor** toolbar icon.
2. Click **Sign Out**.

skeeditor deletes all stored tokens immediately. The edit badges disappear from bsky.app until you sign in again.
