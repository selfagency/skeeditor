import { AtUriParseError, parseAtUri, parseBskyPostUrl } from '../shared/api/at-uri';

export interface PostInfo {
  atUri: string;
  repo: string;
  collection: string;
  rkey: string;
  element: HTMLElement;
}

const POST_CONTAINER_SELECTORS = [
  '[data-at-uri]',
  '[data-uri]',
  '[data-post]',
  '[data-testid*="post"]',
  '[role="article"]',
  'article',
  '.post',
].join(', ');

export function isBlueskyPost(element: HTMLElement): boolean {
  return element.matches(POST_CONTAINER_SELECTORS);
}

export function findPostElement(root: Document | HTMLElement = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(POST_CONTAINER_SELECTORS);
}

export function extractPostInfo(element: HTMLElement): PostInfo | null {
  const candidates = [
    element,
    element.closest('[data-at-uri]'),
    element.closest('[data-uri]'),
    element.closest('article'),
  ].filter((el): el is HTMLElement => el !== null);

  for (const candidate of candidates) {
    const atUri = candidate.getAttribute('data-at-uri') || candidate.getAttribute('data-uri');
    if (atUri) {
      try {
        const parsed = parseAtUri(atUri);
        return { ...parsed, element: candidate, atUri };
      } catch {
        continue;
      }
    }

    const anchor = candidate.querySelector<HTMLAnchorElement>('a[href]');
    if (anchor?.href) {
      try {
        const parsed = parseBskyPostUrl(anchor.href);
        return { ...parsed, element: candidate, atUri: parsed.uri };
      } catch {
        continue;
      }
    }
  }

  return null;
}

export function* findPosts(root: Document | HTMLElement = document): Generator<PostInfo> {
  const posts = root.querySelectorAll<HTMLElement>(POST_CONTAINER_SELECTORS);
  for (const post of Array.from(posts)) {
    const info = extractPostInfo(post);
    if (info) {
      yield info;
    }
  }
}

export function isOwnPost(element: HTMLElement, did: string): boolean {
  const info = extractPostInfo(element);
  return info?.repo === did;
}

export class PostDetectionError extends Error {
  public readonly input: string;

  public constructor(message: string, input: string) {
    super(message);
    this.name = 'PostDetectionError';
    this.input = input;
  }
}

export function tryExtractPostInfo(element: HTMLElement): PostInfo | PostDetectionError {
  try {
    const info = extractPostInfo(element);
    if (!info) {
      return new PostDetectionError('Could not extract post info', element.outerHTML);
    }
    return info;
  } catch (error) {
    if (error instanceof AtUriParseError) {
      return new PostDetectionError(error.message, error.input);
    }
    return new PostDetectionError('Unexpected error during post extraction', element.outerHTML);
  }
}
