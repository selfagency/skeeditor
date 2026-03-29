import { AtUriParseError, parseAtUri, parseBskyPostUrl } from '../shared/api/at-uri';

export interface PostInfo {
  atUri: string;
  repo: string;
  collection: string;
  rkey: string;
  element: HTMLElement;
}

const DID_HINT_REGEX = /by-(did:[a-z0-9:.]+)/i;

const POST_TEXT_SELECTORS = [
  '[data-testid="postDetailedText"]',
  '[data-testid="post-text"]',
  '[data-testid="postText"]',
  '[data-testid="post-content"]',
].join(', ');
const POST_CONTAINER_SELECTORS = [
  '[data-at-uri]',
  '[data-uri]',
  '[data-post]',
  // Exact or space-separated variations
  '[data-testid="post"]',
  '[data-testid="feedItem"]',
  '[data-testid="postThreadItem"]',
  '[data-testid="notificationItem"]',
  // Prefix-based variants seen on live bsky.app (e.g. postThreadItem-by-did:...)
  '[data-testid^="feedItem"]',
  '[data-testid^="postThreadItem"]',
  '[data-testid^="notificationItem"]',
  // Generic semantic fallbacks
  '[role="article"]',
  'article',
  '.post',
].join(', ');

const isOwnedByContainer = (node: Element, container: HTMLElement): boolean => {
  return node.closest(POST_CONTAINER_SELECTORS) === container;
};

const extractDidHint = (candidate: HTMLElement): string | null => {
  const dataTestId = candidate.getAttribute('data-testid');
  if (!dataTestId) return null;
  const match = DID_HINT_REGEX.exec(dataTestId);
  return match?.[1]?.toLowerCase() ?? null;
};

const maybeCanonicalizeToDid = (
  parsed: { uri: string; repo: string; collection: string; rkey: string },
  didHint: string | null,
): { uri: string; repo: string; collection: string; rkey: string } => {
  if (!didHint) return parsed;
  if (parsed.repo.startsWith('did:')) return parsed;
  return {
    ...parsed,
    repo: didHint,
    uri: `at://${didHint}/${parsed.collection}/${parsed.rkey}`,
  };
};

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
    const didHint = extractDidHint(candidate);
    const atUri = candidate.getAttribute('data-at-uri') || candidate.getAttribute('data-uri');
    if (atUri) {
      try {
        const parsed = maybeCanonicalizeToDid(parseAtUri(atUri), didHint);
        return { ...parsed, element: candidate, atUri };
      } catch {
        continue;
      }
    }

    // Prefer a link that points directly at a post (permalink or sub-page like /liked-by).
    // Falls back to the first available anchor if no post-url link is found.
    const directPostAnchor = Array.from(candidate.querySelectorAll<HTMLAnchorElement>('a[href*="/post/"]')).find(
      anchor => isOwnedByContainer(anchor, candidate),
    );

    const directAnchor = Array.from(candidate.querySelectorAll<HTMLAnchorElement>('a[href]')).find(anchor =>
      isOwnedByContainer(anchor, candidate),
    );

    const anchor =
      directPostAnchor ??
      candidate.querySelector<HTMLAnchorElement>('a[href*="/post/"]') ??
      directAnchor ??
      candidate.querySelector<HTMLAnchorElement>('a[href]');
    if (anchor?.href) {
      try {
        const parsed = maybeCanonicalizeToDid(parseBskyPostUrl(anchor.href), didHint);
        return { ...parsed, element: candidate, atUri: parsed.uri };
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * Locate the specific DOM element that holds the post's visible text content.
 *
 * Tries stable `data-testid` selectors first (works on feed / notification
 * pages). When those are absent — as is the case on bsky.app permalink pages
 * where the thread-root component omits any testid — falls back to a
 * TreeWalker that finds the first leaf element in DOM order that:
 *   1. is not nested inside an interactive element (A, BUTTON, role=link/button), and
 *   2. has non-empty text content.
 *
 * On all observed bsky.app layouts the post body satisfies both conditions and
 * precedes the timestamp / engagement-count nodes in document order, so the
 * first matching leaf is always the post text.
 */
function findPostTextLeaf(container: HTMLElement): HTMLElement | null {
  // Fast path: known stable testId selectors (feed / notification pages).
  const owned = Array.from(container.querySelectorAll<HTMLElement>(POST_TEXT_SELECTORS)).find(el =>
    isOwnedByContainer(el, container),
  );
  if (owned) return owned;
  const direct = container.querySelector<HTMLElement>(POST_TEXT_SELECTORS);
  if (direct) return direct;

  // Structural fallback for permalink pages where no testid is present.
  // Walk all elements in DOM order; FILTER_REJECT skips the element AND its
  // entire subtree, which is how we avoid text nodes inside links/buttons.
  const interactiveTags = new Set(['a', 'button']);
  const interactiveRoles = new Set(['link', 'button']);
  const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('role');
      if (interactiveTags.has(tag) || (role !== null && interactiveRoles.has(role))) {
        return NodeFilter.FILTER_REJECT;
      }
      if (el.children.length === 0 && (el.textContent?.trim() ?? '')) {
        return NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_SKIP;
    },
  });

  const node = walker.nextNode();
  return node ? (node as HTMLElement) : null;
}

export function extractPostText(element: HTMLElement): string {
  const textElement = findPostTextLeaf(element);
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
  const textElement = findPostTextLeaf(element);
  if (textElement) {
    // Clear React-rendered rich text nodes and replace with plain text.
    // Facet-based formatting (mentions, links) is lost until React re-renders,
    // but the content will be correct immediately after the user saves.
    textElement.textContent = text;
    return;
  }

  // Last resort: if the element itself is the text node, write to it directly.
  if (element.children.length === 0) {
    element.textContent = text;
  }
}

export function* findPosts(root: Document | HTMLElement = document): Generator<PostInfo> {
  const yielded = new Set<HTMLElement>();

  // Primary: detect containers via known data attributes and testid patterns.
  for (const post of Array.from(root.querySelectorAll<HTMLElement>(POST_CONTAINER_SELECTORS))) {
    const info = extractPostInfo(post);
    if (info) {
      yielded.add(info.element);
      yield info;
    }
  }

  // Fallback for pages where post containers have no recognizable selectors
  // (e.g. bsky.app search results use plain <div>s with no data-testid).
  // Walk up from each postText leaf to the nearest ancestor that wraps the post permalink.
  for (const textNode of Array.from(root.querySelectorAll<HTMLElement>('[data-testid="postText"]'))) {
    // Skip if this postText is already inside a container yielded above.
    let covered = false;
    for (const yContainer of yielded) {
      if (yContainer.contains(textNode)) {
        covered = true;
        break;
      }
    }
    if (covered) continue;

    // Find the nearest ancestor that contains a post permalink link.
    let container: HTMLElement | null = textNode.parentElement as HTMLElement | null;
    while (container && container !== document.body) {
      if (container.querySelector('a[href*="/post/"]')) break;
      container = container.parentElement as HTMLElement | null;
    }
    if (!container || container === document.body) continue;

    const info = extractPostInfo(container);
    if (info) {
      yielded.add(container);
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
