import { describe, expect, it } from 'vitest';

import { extractPostInfo, extractPostText, findPostElement, findPosts, isOwnPost } from '@src/content/post-detector';

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
      atUri: 'at://alice.bsky.social/app.bsky.feed.post/3feedrkey',
      repo: 'alice.bsky.social',
      collection: 'app.bsky.feed.post',
      rkey: '3feedrkey',
      element: container,
      uri: 'at://alice.bsky.social/app.bsky.feed.post/3feedrkey',
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
      atUri: 'at://alice.bsky.social/app.bsky.feed.post/3threadrkey',
      repo: 'alice.bsky.social',
      collection: 'app.bsky.feed.post',
      rkey: '3threadrkey',
      element: container,
      uri: 'at://alice.bsky.social/app.bsky.feed.post/3threadrkey',
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
});
