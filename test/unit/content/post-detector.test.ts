import { describe, expect, it } from 'vitest';

import {
  extractPostInfo,
  extractPostText,
  findPostElement,
  findPosts,
  isOwnPost,
  updatePostText,
} from '@src/content/post-detector';

describe('post-detector', () => {
  it('should find the first post element in the DOM', () => {
    document.body.innerHTML = `
      <article data-at-uri="at://did:plc:alice123/app.bsky.feed.post/3abc">
        <div>Post one</div>
      </article>
      <article data-at-uri="at://did:plc:alice123/app.bsky.feed.post/3def">
        <div>Post two</div>
      </article>
    `;

    const firstPost = document.querySelector('article');

    expect(firstPost).toBeTruthy();
    expect(findPostElement()).toBe(firstPost);
  });

  it('should extract post info from a data-at-uri attribute', () => {
    document.body.innerHTML = '<article data-at-uri="at://did:plc:alice123/app.bsky.feed.post/3abc"></article>';
    const article = document.querySelector('article');

    expect(article).toBeTruthy();
    expect(extractPostInfo(article as HTMLElement)).toEqual({
      atUri: 'at://did:plc:alice123/app.bsky.feed.post/3abc',
      repo: 'did:plc:alice123',
      collection: 'app.bsky.feed.post',
      rkey: '3abc',
      element: article,
      uri: 'at://did:plc:alice123/app.bsky.feed.post/3abc',
    });
  });

  it('should extract post info from a nested Bluesky post link', () => {
    document.body.innerHTML = `
      <article>
        <a href="https://bsky.app/profile/did:plc:alice123/post/3nested">Open</a>
      </article>
    `;

    const article = document.querySelector('article');

    expect(article).toBeTruthy();
    expect(extractPostInfo(article as HTMLElement)).toEqual({
      atUri: 'at://did:plc:alice123/app.bsky.feed.post/3nested',
      repo: 'did:plc:alice123',
      collection: 'app.bsky.feed.post',
      rkey: '3nested',
      element: article,
      uri: 'at://did:plc:alice123/app.bsky.feed.post/3nested',
    });
  });

  it('should extract post info from a bsky.app feedItem container (profile/home feed)', () => {
    document.body.innerHTML = `
      <div data-testid="feedItem-by-did:plc:alice123">
        <a href="https://bsky.app/profile/alice.bsky.social">alice.bsky.social</a>
        <a href="https://bsky.app/profile/alice.bsky.social/post/3feedrkey">· 2h</a>
        <p>Post text</p>
      </div>
    `;

    const container = document.querySelector<HTMLElement>('[data-testid="feedItem-by-did:plc:alice123"]');

    expect(container).toBeTruthy();
    expect(extractPostInfo(container as HTMLElement)).toEqual({
      atUri: 'at://did:plc:alice123/app.bsky.feed.post/3feedrkey',
      repo: 'did:plc:alice123',
      collection: 'app.bsky.feed.post',
      rkey: '3feedrkey',
      element: container,
      uri: 'at://did:plc:alice123/app.bsky.feed.post/3feedrkey',
    });
  });

  it('should canonicalize handle-form data-at-uri to DID when feed metadata includes a DID', () => {
    document.body.innerHTML = `
      <article data-testid="feedItem-by-did:plc:alice123" data-at-uri="at://alice.bsky.social/app.bsky.feed.post/3abc">
        <p data-testid="post-text">Hello</p>
      </article>
    `;

    const article = document.querySelector('article');

    expect(article).toBeTruthy();
    expect(extractPostInfo(article as HTMLElement)).toEqual({
      atUri: 'at://alice.bsky.social/app.bsky.feed.post/3abc',
      repo: 'did:plc:alice123',
      collection: 'app.bsky.feed.post',
      rkey: '3abc',
      element: article,
      uri: 'at://did:plc:alice123/app.bsky.feed.post/3abc',
    });
  });

  it('should extract post info from a liked-by sub-page link (post thread page)', () => {
    document.body.innerHTML = `
      <div data-testid="postThreadItem-by-did:plc:alice123">
        <a href="https://bsky.app/profile/alice.bsky.social">alice.bsky.social</a>
        <a href="https://bsky.app/profile/alice.bsky.social/post/3threadrkey/liked-by">3 likes</a>
        <p>Post text</p>
      </div>
    `;

    const container = document.querySelector<HTMLElement>('[data-testid="postThreadItem-by-did:plc:alice123"]');

    expect(container).toBeTruthy();
    expect(extractPostInfo(container as HTMLElement)).toEqual({
      atUri: 'at://did:plc:alice123/app.bsky.feed.post/3threadrkey',
      repo: 'did:plc:alice123',
      collection: 'app.bsky.feed.post',
      rkey: '3threadrkey',
      element: container,
      uri: 'at://did:plc:alice123/app.bsky.feed.post/3threadrkey',
    });
  });

  it('should iterate all detected posts in the DOM', () => {
    document.body.innerHTML = `
      <article data-at-uri="at://did:plc:alice123/app.bsky.feed.post/3abc"></article>
      <article data-at-uri="at://did:plc:alice123/app.bsky.feed.post/3def"></article>
    `;

    expect(Array.from(findPosts())).toHaveLength(2);
  });

  it('should detect when a post belongs to the given DID', () => {
    document.body.innerHTML = '<article data-at-uri="at://did:plc:alice123/app.bsky.feed.post/3abc"></article>';
    const article = document.querySelector('article');

    expect(article).toBeTruthy();
    expect(isOwnPost(article as HTMLElement, 'did:plc:alice123')).toBe(true);
    expect(isOwnPost(article as HTMLElement, 'did:plc:bob456')).toBe(false);
  });

  it('should extract the visible post body text instead of article chrome', () => {
    document.body.innerHTML = `
      <article data-testid="post">
        <header>
          <strong>@skeeditor.dev</strong>
          <time datetime="2026-03-18T12:00:00Z">now</time>
        </header>
        <p data-testid="post-text">A static Bluesky-like page for extension E2E scaffolding.</p>
      </article>
    `;

    const article = document.querySelector('article');

    expect(article).toBeTruthy();
    expect(extractPostText(article as HTMLElement)).toBe('A static Bluesky-like page for extension E2E scaffolding.');
  });

  it('should prefer the current post permalink over nested quoted-post permalinks', () => {
    document.body.innerHTML = `
      <article data-testid="post">
        <a href="https://bsky.app/profile/alice.bsky.social/post/3outer">Outer post</a>
        <div data-testid="post" class="quoted-post">
          <a href="https://bsky.app/profile/bob.bsky.social/post/3inner">Quoted post</a>
        </div>
      </article>
    `;

    const article = document.querySelector('article');

    expect(article).toBeTruthy();
    expect(extractPostInfo(article as HTMLElement)).toEqual({
      atUri: 'at://alice.bsky.social/app.bsky.feed.post/3outer',
      repo: 'alice.bsky.social',
      collection: 'app.bsky.feed.post',
      rkey: '3outer',
      element: article,
      uri: 'at://alice.bsky.social/app.bsky.feed.post/3outer',
    });
  });

  it('should extract and update only the outer post text when nested post text exists', () => {
    document.body.innerHTML = `
      <article data-testid="post">
        <p data-testid="post-text">Outer text</p>
        <div data-testid="post" class="quoted-post">
          <p data-testid="post-text">Nested quoted text</p>
        </div>
      </article>
    `;

    const article = document.querySelector('article') as HTMLElement;
    const quotedText = document.querySelector('.quoted-post [data-testid="post-text"]') as HTMLElement;

    expect(extractPostText(article)).toBe('Outer text');

    updatePostText(article, 'Updated outer text');

    expect(extractPostText(article)).toBe('Updated outer text');
    expect(quotedText.textContent).toBe('Nested quoted text');
  });

  it('should extract post text using structural fallback when no data-testid is present (permalink page)', () => {
    // Mirrors the bsky.app permalink DOM structure where the thread-root
    // component renders without any data-testid on the post body element.
    document.body.innerHTML = `
      <div data-testid="postThreadItem-by-did:plc:alice">
        <a href="/profile/alice.bsky.social" aria-label="alice's avatar" role="link">
          <div><!-- avatar --></div>
        </a>
        <a href="/profile/alice.bsky.social" aria-label="alice">
          <div>alice</div>
          <div>@alice.bsky.social</div>
        </a>
        <div>
          <div>
            <button type="button" aria-label="View label info">
              <div>1 label has been placed on this content</div>
            </button>
          </div>
          <div>
            <button type="button" aria-label="Edited"><div>Edited</div></button>
            <button type="button" aria-label="Bluesky Elder"><div>Bluesky Elder</div></button>
            <div>this is the actual post body text without any testid</div>
            <div role="link" aria-label="Post by some.bsky.social">
              <div>quoted post text that must not be returned</div>
            </div>
          </div>
        </div>
        <div>
          <div>9:31 PM · Mar 7, 2026</div>
          <button type="button" aria-label="Edit who can reply">
            <div>Some people can reply</div>
          </button>
        </div>
      </div>
    `;

    const container = document.querySelector<HTMLElement>('[data-testid^="postThreadItem"]')!;

    expect(extractPostText(container)).toBe('this is the actual post body text without any testid');

    updatePostText(container, 'updated post body text');

    expect(extractPostText(container)).toBe('updated post body text');
    // Timestamp must not have been touched
    expect(document.querySelector('div')!.closest('[data-testid^="postThreadItem"]')).toBeTruthy();
    const timestampDiv = Array.from(container.querySelectorAll('div')).find(
      d => d.children.length === 0 && d.textContent?.includes('9:31 PM'),
    );
    expect(timestampDiv?.textContent).toBe('9:31 PM · Mar 7, 2026');
  });
});
