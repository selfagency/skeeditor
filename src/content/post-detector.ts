import { AtUriParseError, parseAtUri, parseBskyPostUrl } from '../shared/api/at-uri';

export interface PostInfo {
  atUri: string;
  repo: string;
  collection: string;
  rkey: string;
  element: HTMLElement;
}

const POST_TEXT_SELECTORS = [
  '[data-testid="post-text"]',
  '[data-testid="postText"]',
  '[data-testid="post-content"]',
].join(', ');
const POST_CONTAINER_SELECTORS = [
  '[data-at-uri]',
  '[data-uri]',
  '[data-post]',
  '[data-testid*="feedItem"]',
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

    // Prefer a link that points directly at a post (permalink or sub-page like /liked-by).
    // Falls back to the first available anchor if no post-url link is found.
    const anchor =
      candidate.querySelector<HTMLAnchorElement>('a[href*="/post/"]') ??
      candidate.querySelector<HTMLAnchorElement>('a[href]');
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

export function extractPostText(element: HTMLElement): string {
  const textElement = element.querySelector<HTMLElement>(POST_TEXT_SELECTORS);
  const text = textElement?.textContent?.trim();

  if (text) {
    return text;
  }

  return element.textContent?.trim() ?? '';
}

/**
 * Immediately update the visible post text in the DOM after a successful save.
 *
 * bsky.app caches post data in its React client state and won't re-fetch until
 * the user navigates away, even though the AppView picks up the change from the
 * firehose within seconds. Updating the DOM directly gives the user immediate
 * feedback. React will overwrite this if it re-renders the component, at which
 * point it will use the already-updated AppView data.
 */
export function updatePostText(element: HTMLElement, text: string): void {
  const textElement = element.querySelector<HTMLElement>(POST_TEXT_SELECTORS);
  if (!textElement) return;
  // Clear React-rendered rich text nodes and replace with plain text.
  // Facet-based formatting (mentions, links) is lost until React re-renders,
  // but the content will be correct immediately after the user saves.
  textElement.textContent = text;
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
