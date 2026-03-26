import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setupDom = (): void => {
  document.body.innerHTML = `
    <article data-at-uri="at://did:plc:alice123/app.bsky.feed.post/3abc">
      <p data-testid="post-text">Hello Bluesky</p>
      <div data-testid="postButtonInline"></div>
    </article>
  `;
};

const flushMicrotasks = async (count = 2): Promise<void> => {
  for (let i = 0; i < count; i += 1) {
    await Promise.resolve();
  }
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
    await flushMicrotasks();

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
    await flushMicrotasks();

    expect(document.querySelector('[data-skeeditor-edit-button]')).toBeNull();
  });

  it('should not inject any edit button when unauthenticated', async () => {
    const sendMessage = vi.fn(async request => {
      if (request.type === 'AUTH_GET_STATUS') {
        return { authenticated: false };
      }

      return { ok: true };
    });

    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks();

    expect(document.querySelector('[data-skeeditor-edit-button]')).toBeNull();
  });

  it('should inject edit button after session is set via storage change', async () => {
    document.body.innerHTML = `
      <article role="article">
        <a href="https://bsky.app/profile/alice.bsky.social/post/3abc">
          <p data-testid="post-text">Hello Bluesky</p>
        </a>
        <div data-testid="postButtonInline"></div>
      </article>
    `;

    const sendMessage = vi.fn(async request => {
      if (request.type === 'AUTH_GET_STATUS') {
        return { authenticated: false };
      }

      return { ok: true };
    });

    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks();

    expect(document.querySelector('[data-skeeditor-edit-button]')).toBeNull();

    sendMessage.mockImplementation(async request => {
      if (request.type === 'AUTH_GET_STATUS') {
        return {
          authenticated: true,
          did: 'did:plc:alice123',
          handle: 'alice.bsky.social',
          expiresAt: Date.now() + 60_000,
        };
      }

      return { ok: true };
    });

    const onChanged = globalThis.browser.storage.onChanged as unknown as {
      _emit: (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>) => void;
    };
    onChanged._emit({ session: { newValue: { did: 'did:plc:alice123' } } });

    await flushMicrotasks(3);
    await new Promise(resolve => setTimeout(resolve, 120));

    expect(document.querySelector('[data-skeeditor-edit-button]')).toBeTruthy();
  });

  it('should remove injected edit button when session is cleared via storage change', async () => {
    const sendMessage = vi.fn(async request => {
      if (request.type === 'AUTH_GET_STATUS') {
        return {
          authenticated: true,
          did: 'did:plc:alice123',
          expiresAt: Date.now() + 60_000,
        };
      }

      return { ok: true };
    });

    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks();

    expect(document.querySelector('[data-skeeditor-edit-button]')).toBeTruthy();

    const onChanged = globalThis.browser.storage.onChanged as unknown as {
      _emit: (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>) => void;
    };
    onChanged._emit({ session: { newValue: null } });

    expect(document.querySelector('[data-skeeditor-edit-button]')).toBeNull();
  });
});
