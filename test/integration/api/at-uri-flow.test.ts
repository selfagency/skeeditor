// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { parseAtUriFromElement } from '../../../src/shared/api/at-uri';

describe('AT URI parser integration flow', () => {
  it('should resolve a post reference from DOM markup used by the content script', () => {
    document.body.innerHTML = `
      <main>
        <article data-testid="post-shell">
          <a href="https://bsky.app/profile/did:plc:integration/post/3kq2flow">View post</a>
        </article>
      </main>
    `;

    const postShell = document.querySelector('[data-testid="post-shell"]');

    expect(postShell).toBeTruthy();
    expect(parseAtUriFromElement(postShell as Element)).toEqual({
      uri: 'at://did:plc:integration/app.bsky.feed.post/3kq2flow',
      repo: 'did:plc:integration',
      collection: 'app.bsky.feed.post',
      rkey: '3kq2flow',
    });
  });
});
