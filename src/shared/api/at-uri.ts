import { APP_BSKY_FEED_POST_COLLECTION, BSKY_APP_ORIGIN } from '../constants';

const INVALID_AT_URI_MESSAGE = 'Invalid AT URI';
const INVALID_BSKY_URL_MESSAGE = 'Invalid Bluesky post URL';

export interface ParsedAtUri {
  uri: string;
  repo: string;
  collection: string;
  rkey: string;
}

export class AtUriParseError extends Error {
  public readonly input: string;

  public constructor(message: string, input: string) {
    super(message);
    this.name = 'AtUriParseError';
    this.input = input;
  }
}

const normalizeValue = (value: string): string => value.trim();

const decodeSegment = (segment: string, input: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw new AtUriParseError('Invalid URI encoding', input);
  }
};

const FORBIDDEN_SEGMENT_CHARS = /[/?#]/;

const assertValidDecodedSegment = (segment: string, input: string, message: string): void => {
  if (FORBIDDEN_SEGMENT_CHARS.test(segment)) {
    throw new AtUriParseError(message, input);
  }
};

const toParsedAtUri = (repo: string, collection: string, rkey: string): ParsedAtUri => {
  return {
    uri: `at://${repo}/${collection}/${rkey}`,
    repo,
    collection,
    rkey,
  };
};

export const parseAtUri = (uri: string): ParsedAtUri => {
  const normalizedUri = normalizeValue(uri);
  const match = /^at:\/\/([^/?#]+)\/([^/?#]+)\/([^/?#]+)$/.exec(normalizedUri);

  if (!match) {
    throw new AtUriParseError(INVALID_AT_URI_MESSAGE, uri);
  }

  const rawRepo = match[1];
  const rawCollection = match[2];
  const rawRkey = match[3];

  if (!rawRepo || !rawCollection || !rawRkey) {
    throw new AtUriParseError(INVALID_AT_URI_MESSAGE, uri);
  }

  const repo = decodeSegment(rawRepo, uri);
  const collection = decodeSegment(rawCollection, uri);
  const rkey = decodeSegment(rawRkey, uri);

  if (!repo || !collection || !rkey) {
    throw new AtUriParseError(INVALID_AT_URI_MESSAGE, uri);
  }

  assertValidDecodedSegment(repo, uri, INVALID_AT_URI_MESSAGE);
  assertValidDecodedSegment(collection, uri, INVALID_AT_URI_MESSAGE);
  assertValidDecodedSegment(rkey, uri, INVALID_AT_URI_MESSAGE);

  return toParsedAtUri(repo, collection, rkey);
};

export const parseBskyPostUrl = (url: string | URL): ParsedAtUri => {
  const input = typeof url === 'string' ? url : url.toString();
  let parsedUrl: URL;

  if (typeof url === 'string') {
    try {
      parsedUrl = new URL(url, BSKY_APP_ORIGIN);
    } catch {
      throw new AtUriParseError(INVALID_BSKY_URL_MESSAGE, input);
    }
  } else {
    parsedUrl = url;
  }

  if (parsedUrl.origin !== BSKY_APP_ORIGIN) {
    throw new AtUriParseError('Unsupported Bluesky URL origin', input);
  }

  // Allow sub-paths (e.g. /liked-by, /reposted-by) so that links to post
  // sub-pages found inside feed/thread containers can still be parsed.
  const match = /^\/profile\/([^/]+)\/post\/([^/?#]+)/.exec(parsedUrl.pathname);

  if (!match) {
    throw new AtUriParseError(INVALID_BSKY_URL_MESSAGE, input);
  }

  const rawRepo = match[1];
  const rawRkey = match[2];

  if (!rawRepo || !rawRkey) {
    throw new AtUriParseError(INVALID_BSKY_URL_MESSAGE, input);
  }

  const repo = decodeSegment(rawRepo, input);
  const rkey = decodeSegment(rawRkey, input);

  if (!repo || !rkey) {
    throw new AtUriParseError(INVALID_BSKY_URL_MESSAGE, input);
  }

  assertValidDecodedSegment(repo, input, INVALID_BSKY_URL_MESSAGE);
  assertValidDecodedSegment(rkey, input, INVALID_BSKY_URL_MESSAGE);

  return toParsedAtUri(repo, APP_BSKY_FEED_POST_COLLECTION, rkey);
};

const getElementCandidates = (element: Element): Element[] => {
  const stable = [
    element,
    element.closest('[data-at-uri]'),
    element.closest('[data-uri]'),
    element.closest('a[href]'),
  ].filter((candidate): candidate is Element => candidate !== null);

  const unique = [...new Set(stable)];

  const hasDirectRef = unique.some(
    c => c.hasAttribute('data-at-uri') || c.hasAttribute('data-uri') || c instanceof HTMLAnchorElement,
  );

  if (hasDirectRef) return unique;

  return [...unique, ...Array.from(element.querySelectorAll('[data-at-uri], [data-uri], a[href]'))];
};

const extractReferenceValue = (element: Element): string | null => {
  const attributeNames = ['data-at-uri', 'data-uri', 'href'] as const;

  for (const candidate of getElementCandidates(element)) {
    for (const attributeName of attributeNames) {
      let value: string | null;

      if (attributeName === 'href' && candidate instanceof HTMLAnchorElement) {
        const rawHref = candidate.getAttribute('href');
        value = rawHref && rawHref.startsWith('/') ? rawHref : candidate.href;
      } else {
        value = candidate.getAttribute(attributeName);
      }

      if (value && value.trim().length > 0) {
        return value;
      }
    }
  }

  return null;
};

export const parseAtUriFromElement = (element: Element): ParsedAtUri => {
  const reference = extractReferenceValue(element);

  if (!reference) {
    throw new AtUriParseError('No AT URI reference found on element', element.outerHTML);
  }

  if (reference.startsWith('at://')) {
    return parseAtUri(reference);
  }

  return parseBskyPostUrl(reference);
};
