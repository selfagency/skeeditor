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
    vi.useRealTimers();
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
    vi.useFakeTimers();
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
    await vi.advanceTimersByTimeAsync(120);
    await flushMicrotasks(3);
    vi.useRealTimers();

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

  it('should inject into the live action row when postButtonInline is absent', async () => {
    document.body.innerHTML = `
      <article role="article">
        <a href="https://bsky.app/profile/alice.bsky.social/post/3abc">
          <p data-testid="post-text">Hello Bluesky</p>
        </a>
        <div class="action-row">
          <button aria-label="Reply (0 replies)" type="button"></button>
          <button aria-label="Open share menu" type="button"></button>
          <button aria-label="Open post options menu" type="button"></button>
        </div>
      </article>
    `;

    const sendMessage = vi.fn(async request => {
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

    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks();

    const actionRow = document.querySelector('.action-row');
    const editButton = document.querySelector('[data-skeeditor-edit-button]');
    const optionsButton = document.querySelector('button[aria-label="Open post options menu"]');

    expect(editButton).toBeTruthy();
    expect(actionRow?.contains(editButton)).toBe(true);
    expect(editButton?.nextElementSibling).toBe(optionsButton);
  });

  it('should close and remove the edit modal when session is cleared via storage change', async () => {
    const sendMessage = vi.fn(async request => {
      if (request.type === 'AUTH_GET_STATUS') {
        return {
          authenticated: true,
          did: 'did:plc:alice123',
          expiresAt: Date.now() + 60_000,
        };
      }

      if (request.type === 'GET_RECORD') {
        return {
          value: { $type: 'app.bsky.feed.post', text: 'Hello Bluesky', createdAt: '2026-03-26T00:00:00.000Z' },
          cid: 'bafyreitest',
        };
      }

      return { ok: true };
    });

    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks();

    const editButton = document.querySelector<HTMLButtonElement>('[data-skeeditor-edit-button]');
    expect(editButton).toBeTruthy();
    editButton?.click();
    await flushMicrotasks(3);

    expect(document.querySelector('edit-modal')).toBeTruthy();

    const onChanged = globalThis.browser.storage.onChanged as unknown as {
      _emit: (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>) => void;
    };
    onChanged._emit({ session: { newValue: null } });

    expect(document.querySelector('edit-modal')).toBeNull();
  });

  it('should block editing when the post is older than the configured edit time limit', async () => {
    const sendMessage = vi.fn(async request => {
      if (request.type === 'AUTH_GET_STATUS') {
        return {
          authenticated: true,
          did: 'did:plc:alice123',
          expiresAt: Date.now() + 60_000,
        };
      }

      if (request.type === 'GET_RECORD') {
        return {
          value: {
            $type: 'app.bsky.feed.post',
            text: 'Hello Bluesky',
            createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
          },
          cid: 'bafyreitest',
        };
      }

      if (request.type === 'GET_SETTINGS') {
        return { editTimeLimit: 5 };
      }

      return { ok: true };
    });

    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks();

    const editButton = document.querySelector<HTMLButtonElement>('[data-skeeditor-edit-button]');
    expect(editButton).toBeTruthy();
    editButton?.click();
    await flushMicrotasks(4);

    const modal = document.querySelector<HTMLElement>('edit-modal');
    expect(modal).toBeTruthy();

    const shadowRoot = modal?.shadowRoot;
    const textarea = shadowRoot?.querySelector<HTMLTextAreaElement>('textarea');
    const saveButton = shadowRoot?.querySelector<HTMLButtonElement>('.save-button');
    const statusMessage = shadowRoot?.querySelector<HTMLElement>('.status-message');

    expect(textarea?.disabled).toBe(true);
    expect(saveButton?.disabled).toBe(true);
    expect(statusMessage?.textContent).toContain('older than your edit time limit of 5 minutes');
  });
});
