import type { Main as RichtextFacet } from '../../lexicons/app/bsky/richtext/facet.defs';

import { utf8ByteLength } from './text';

export type FacetTokenKind = 'mention' | 'link' | 'tag';

export interface FacetToken {
  kind: FacetTokenKind;
  value: string;
  start: number;
  end: number;
}

export interface ByteOffsets {
  byteStart: number;
  byteEnd: number;
}

export interface BuildFacetsOptions {
  resolveMentionDid?: (handle: string) => string | undefined;
}

const linkPattern = /https?:\/\/[^\s]+/giu;
const mentionPattern =
  /(^|[^\p{L}\p{N}._-])@([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)/giu;
const hashtagPattern = /(^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]{1,64})/gu;

const trailingLinkPunctuationPattern = /[),.!?;:]+$/u;

const trimTrailingLinkPunctuation = (uri: string): string => {
  return uri.replace(trailingLinkPunctuationPattern, '');
};

const normalizeHandle = (handle: string): string => {
  return handle.toLowerCase();
};

const overlaps = (left: FacetToken, right: FacetToken): boolean => {
  return left.start < right.end && right.start < left.end;
};

const overlapsAny = (candidate: FacetToken, existing: FacetToken[]): boolean => {
  return existing.some(entry => overlaps(candidate, entry));
};

export function detectLinks(text: string): FacetToken[] {
  const tokens: FacetToken[] = [];

  for (const match of text.matchAll(linkPattern)) {
    const rawValue = match[0];
    if (!rawValue) {
      continue;
    }

    const uri = trimTrailingLinkPunctuation(rawValue);
    if (!uri) {
      continue;
    }

    const start = match.index ?? 0;
    const end = start + uri.length;

    tokens.push({
      kind: 'link',
      value: uri,
      start,
      end,
    });
  }

  return tokens;
}

export function detectMentions(text: string): FacetToken[] {
  const tokens: FacetToken[] = [];

  for (const match of text.matchAll(mentionPattern)) {
    const prefix = match[1] ?? '';
    const handle = match[2];

    if (!handle) {
      continue;
    }

    const normalizedHandle = normalizeHandle(handle);
    const matchStart = match.index ?? 0;
    const start = matchStart + prefix.length;
    const end = start + 1 + handle.length;

    tokens.push({
      kind: 'mention',
      value: normalizedHandle,
      start,
      end,
    });
  }

  return tokens;
}

export function detectHashtags(text: string): FacetToken[] {
  const tokens: FacetToken[] = [];

  for (const match of text.matchAll(hashtagPattern)) {
    const prefix = match[1] ?? '';
    const tag = match[2];

    if (!tag) {
      continue;
    }

    const matchStart = match.index ?? 0;
    const start = matchStart + prefix.length;
    const end = start + 1 + tag.length;

    tokens.push({
      kind: 'tag',
      value: tag,
      start,
      end,
    });
  }

  return tokens;
}

export function toByteOffsets(text: string, start: number, end: number): ByteOffsets {
  return {
    byteStart: utf8ByteLength(text.slice(0, start)),
    byteEnd: utf8ByteLength(text.slice(0, end)),
  };
}

export function buildFacets(text: string, options: BuildFacetsOptions = {}): RichtextFacet[] {
  const links = detectLinks(text);
  const hashtags = detectHashtags(text).filter(token => !overlapsAny(token, links));
  const mentions = detectMentions(text).filter(token => !overlapsAny(token, links));

  const tokens = [...links, ...hashtags, ...mentions].sort((left, right) => left.start - right.start);

  const facets: RichtextFacet[] = [];

  for (const token of tokens) {
    const index = toByteOffsets(text, token.start, token.end);

    if (token.kind === 'link') {
      facets.push({
        $type: 'app.bsky.richtext.facet',
        index,
        features: [
          {
            $type: 'app.bsky.richtext.facet#link',
            uri: token.value as `${string}:${string}`,
          },
        ],
      });
      continue;
    }

    if (token.kind === 'tag') {
      facets.push({
        $type: 'app.bsky.richtext.facet',
        index,
        features: [
          {
            $type: 'app.bsky.richtext.facet#tag',
            tag: token.value,
          },
        ],
      });
      continue;
    }

    const did = options.resolveMentionDid?.(token.value);
    if (!did) {
      continue;
    }

    facets.push({
      $type: 'app.bsky.richtext.facet',
      index,
      features: [
        {
          $type: 'app.bsky.richtext.facet#mention',
          did: did as `did:${string}:${string}`,
        },
      ],
    });
  }

  return facets;
}
