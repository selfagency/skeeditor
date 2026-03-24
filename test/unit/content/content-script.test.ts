import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setupDom = (): void => {
  document.body.innerHTML = `
    <article data-at-uri="at://did:plc:alice123/app.bsky.feed.post/3abc">
      <p data-testid="post-text">Hello Bluesky</p>
      <div data-testid="postButtonInline"></div>
    </article>
  `;
};

describe('content-script', () => {
  beforeEach(() => {
    vi.resetModules();
    setupDom();
  });

  afterEach(async () => {
    const { cleanupContentScript } = await import('@src/content/content-script');
    cleanupContentScript();
    vi.restoreAllMocks();
  });

  it('should inject an edit button for the authenticated user own post', async () => {
    const sendMessage = vi.fn(async request => {
      if (request.type === 'AUTH_GET_STATUS') {
        return { authenticated: true, did: 'did:plc:alice123', expiresAt: 0 };
      }

      return { ok: true };
    });

    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('[data-skeeditor-edit-button]')).toBeTruthy();
  });

  it('should not inject an edit button for another user post', async () => {
    const sendMessage = vi.fn(async request => {
      if (request.type === 'AUTH_GET_STATUS') {
        return { authenticated: true, did: 'did:plc:bob456', expiresAt: 0 };
      }

      return { ok: true };
    });

    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('[data-skeeditor-edit-button]')).toBeNull();
  });
});
