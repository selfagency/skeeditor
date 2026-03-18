import { describe, expect, it } from 'vitest';

import { AtUriParseError, parseAtUri, parseAtUriFromElement, parseBskyPostUrl } from '@src/shared/api/at-uri';

describe('AT URI parser', () => {
  it('should parse an AT Protocol URI into repo, collection, and rkey', () => {
    const parsed = parseAtUri('at://did:plc:alice123/app.bsky.feed.post/3kq2abcxyz');

    expect(parsed).toEqual({
      uri: 'at://did:plc:alice123/app.bsky.feed.post/3kq2abcxyz',
      repo: 'did:plc:alice123',
      collection: 'app.bsky.feed.post',
      rkey: '3kq2abcxyz',
    });
  });

  it('should normalize a Bluesky post URL into an AT URI shape', () => {
    const parsed = parseBskyPostUrl('https://bsky.app/profile/alice.test/post/3kq2abcxyz');

    expect(parsed).toEqual({
      uri: 'at://alice.test/app.bsky.feed.post/3kq2abcxyz',
      repo: 'alice.test',
      collection: 'app.bsky.feed.post',
      rkey: '3kq2abcxyz',
    });
  });

  it('should normalize a relative Bluesky post URL path', () => {
    const parsed = parseBskyPostUrl('/profile/alice.test/post/3kq2relative');

    expect(parsed).toEqual({
      uri: 'at://alice.test/app.bsky.feed.post/3kq2relative',
      repo: 'alice.test',
      collection: 'app.bsky.feed.post',
      rkey: '3kq2relative',
    });
  });

  it('should parse from a DOM element data-at-uri attribute', () => {
    document.body.innerHTML = '<article data-at-uri="at://did:plc:bob456/app.bsky.feed.post/3kq2zzz"></article>';
    const article = document.querySelector('article');

    expect(article).toBeTruthy();
    expect(parseAtUriFromElement(article as Element)).toEqual({
      uri: 'at://did:plc:bob456/app.bsky.feed.post/3kq2zzz',
      repo: 'did:plc:bob456',
      collection: 'app.bsky.feed.post',
      rkey: '3kq2zzz',
    });
  });

  it('should parse from a nested link that points at a Bluesky post URL', () => {
    document.body.innerHTML = `
      <article>
        <div>
          <a href="https://bsky.app/profile/did:plc:charlie/post/3kq2nested">Open</a>
        </div>
      </article>
    `;
    const linkText = document.querySelector('div');

    expect(linkText).toBeTruthy();
    expect(parseAtUriFromElement(linkText as Element)).toEqual({
      uri: 'at://did:plc:charlie/app.bsky.feed.post/3kq2nested',
      repo: 'did:plc:charlie',
      collection: 'app.bsky.feed.post',
      rkey: '3kq2nested',
    });
  });

  it('should parse from a nested link with relative href using resolved anchor URL', () => {
    document.body.innerHTML = `
      <article>
        <div>
          <a href="/profile/did:plc:charlie/post/3kq2relative">Open</a>
        </div>
      </article>
    `;

    const linkText = document.querySelector('div');

    expect(linkText).toBeTruthy();
    expect(parseAtUriFromElement(linkText as Element)).toEqual({
      uri: 'at://did:plc:charlie/app.bsky.feed.post/3kq2relative',
      repo: 'did:plc:charlie',
      collection: 'app.bsky.feed.post',
      rkey: '3kq2relative',
    });
  });

  it('should reject malformed URIs with a typed parser error', () => {
    expect(() => parseAtUri('https://example.com/not-an-at-uri')).toThrowError(AtUriParseError);
    expect(() => parseAtUri('at://did:plc:alice123/app.bsky.feed.post')).toThrow('Invalid AT URI');
  });

  it('should reject malformed Bluesky URLs with a typed parser error', () => {
    expect(() => parseBskyPostUrl(':::bad-url:::')).toThrowError(AtUriParseError);
    expect(() => parseBskyPostUrl(':::bad-url:::')).toThrow('Invalid Bluesky post URL');
  });

  it('should reject AT URI segments that decode into reserved separators', () => {
    expect(() => parseAtUri('at://did:plc:alice123/app.bsky.feed.post/abc%2Fdef')).toThrowError(AtUriParseError);
    expect(() => parseAtUri('at://did:plc:alice123/app.bsky.feed.post/abc%2Fdef')).toThrow('Invalid AT URI');
  });

  it('should reject Bluesky URL segments that decode into reserved separators', () => {
    expect(() => parseBskyPostUrl('https://bsky.app/profile/alice.test/post/abc%2Fdef')).toThrowError(AtUriParseError);
    expect(() => parseBskyPostUrl('https://bsky.app/profile/alice.test/post/abc%2Fdef')).toThrow(
      'Invalid Bluesky post URL',
    );
  });
});
