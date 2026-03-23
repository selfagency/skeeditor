import { describe, expect, it } from 'vitest';

import { extractPostInfo, findPostElement, findPosts, isOwnPost } from '@src/content/post-detector';

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
});
