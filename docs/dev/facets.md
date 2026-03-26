# Facets & Rich Text

AT Protocol encodes rich text (links, @mentions, #hashtags) as **facets** — structured annotations that record the byte offsets of each decorated span within the post text. skeeditor recalculates facets automatically whenever a post is saved.

---

## Why byte offsets?

Bluesky facet positions use **UTF-8 byte offsets**, not JavaScript character indices or Unicode code-point positions. A single emoji or CJK character may be 3–4 bytes in UTF-8 but only 1–2 JavaScript string indices. Using the wrong unit causes misaligned rich text rendering on other clients.

All utilities in `src/shared/utils/facets.ts` work in character indices internally and convert to byte offsets only at the final step via `toByteOffsets`.

---

## Detection functions

All three functions accept a plain `string` and return an array of `FacetToken`:

```ts
interface FacetToken {
  kind: 'link' | 'mention' | 'tag';
  value: string;   // URL, handle (without @), or hashtag (without #)
  start: number;   // character index in the string (inclusive)
  end: number;     // character index in the string (exclusive)
}
```

### `detectLinks(text)`

Finds bare URLs matching `https?://…`. Trailing punctuation (`.`, `,`, `)`, `!`, `?`, `;`, `:`) is stripped from the end of each match.

```ts
import { detectLinks } from '@src/shared/utils/facets';

detectLinks('see https://example.com today');
// [{ kind: 'link', value: 'https://example.com', start: 4, end: 23 }]
```

### `detectMentions(text)`

Matches `@handle.bsky.social`-style handles. Must be preceded by a non-alphanumeric character (or be at the start of the string). Handles are normalised to lowercase.

```ts
import { detectMentions } from '@src/shared/utils/facets';

detectMentions('hello @alice.bsky.social!');
// [{ kind: 'mention', value: 'alice.bsky.social', start: 6, end: 24 }]
```

### `detectHashtags(text)`

Matches `#tag` where `tag` is 1–64 Unicode letters, digits, or underscores. Must be preceded by a non-alphanumeric character (or start of string).

```ts
import { detectHashtags } from '@src/shared/utils/facets';

detectHashtags('A #TypeScript post');
// [{ kind: 'tag', value: 'TypeScript', start: 2, end: 13 }]
```

---

## `toByteOffsets`

Converts a character-index range to UTF-8 byte offsets:

```ts
import { toByteOffsets } from '@src/shared/utils/facets';

interface ByteOffsets {
  byteStart: number;
  byteEnd: number;
}

const offsets = toByteOffsets(text, token.start, token.end);
```

Internally uses `utf8ByteLength` from `src/shared/utils/text.ts`, which encodes the prefix `text.slice(0, index)` and measures its byte length.

---

## `buildFacets`

The high-level function used before every `putRecord`. It detects all three token types, deduplicates overlaps (hashtags and mentions that overlap with a URL are discarded), sorts by start offset, converts to byte offsets, and returns an array of `app.bsky.richtext.facet` records ready to embed in the post.

```ts
import { buildFacets } from '@src/shared/utils/facets';

interface BuildFacetsOptions {
  resolveMentionDid?: (handle: string) => string | undefined;
}

const facets = buildFacets(newText, {
  // Optional: resolve a @handle to its DID for richer mention features
  resolveMentionDid: handle => lookupDid(handle),
});
```

If `resolveMentionDid` is not provided (or returns `undefined` for a given handle), the mention facet is omitted — Bluesky requires a DID in mention features, and unresolved handles cannot be reliably linked.

---

## `recalculateFacets` (`src/shared/utils/facet-offsets.ts`)

When text is edited, existing facet byte offsets may need to shift. `recalculateFacets` uses a common-prefix/common-suffix diff algorithm to determine which facets need to move and by how much:

```ts
import { recalculateFacets } from '@src/shared/utils/facet-offsets';

const updatedFacets = recalculateFacets(originalText, editedText, originalFacets);
```

- Facets **before** the edit zone are unchanged.
- Facets **after** the edit zone are shifted by the byte-length delta.
- Facets that **overlap** the edit zone are discarded (they no longer correspond to the original text span).

This utility handles multi-byte characters correctly, including surrogate pairs and CJK characters.

> **Note:** `buildUpdatedPostRecord` in `src/content/post-editor.ts` currently rebuilds all facets from scratch via `buildFacets` rather than using `recalculateFacets`. The incremental approach is available for cases where full rebuild is not desired.

The returned facets are plain `app.bsky.richtext.facet` objects that can be embedded directly in the record:

```ts
const record = {
  $type: 'app.bsky.feed.post',
  text: newText,
  facets: buildFacets(newText),
  createdAt: originalRecord.createdAt,  // always preserve
};
```

---

## Important rules

- **Always recalculate facets when text changes.** Never copy facets from the original record into an edited record — the byte offsets will be wrong if any text was inserted or removed before a decorated span.
- **Preserve `createdAt`.** Copy it from the original record; setting it to the current time changes the post's timestamp in feeds.
- **Preserve embeds.** The edit flow preserves `embed` from the original record unless the user explicitly removes it, since skeeditor does not currently support editing image/video embeds.
