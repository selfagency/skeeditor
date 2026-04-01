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
    onChanged._emit({ activeDid: { newValue: 'did:plc:alice123' } });

    await flushMicrotasks(3);
    await vi.advanceTimersByTimeAsync(120);
    await flushMicrotasks(3);
    vi.useRealTimers();

    expect(document.querySelector('[data-skeeditor-edit-button]')).toBeTruthy();
  });

  it('should inject edit button via profile-link fallback when repo extraction does not match exactly', async () => {
    document.body.innerHTML = `
      <article role="article" data-testid="feedItem-random">
        <a href="https://bsky.app/profile/self.agency">self.agency</a>
        <a href="https://bsky.app/profile/other.bsky.social/post/3abc">
          <p data-testid="post-text">Hello Bluesky</p>
        </a>
        <div data-testid="postButtonInline"></div>
      </article>
    `;

    const sendMessage = vi.fn(async request => {
      if (request.type === 'AUTH_GET_STATUS') {
        return {
          authenticated: true,
          did: 'did:plc:zju7gpf2woz5vwegmzdg2acl',
          handle: 'self.agency',
          expiresAt: Date.now() + 60_000,
        };
      }

      return { ok: true };
    });

    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks(3);

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
    onChanged._emit({ activeDid: { newValue: null } });

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

    expect(document.querySelector('[data-skeeditor-modal]')).toBeTruthy();

    const onChanged = globalThis.browser.storage.onChanged as unknown as {
      _emit: (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>) => void;
    };
    onChanged._emit({ activeDid: { newValue: null } });

    expect(document.querySelector('[data-skeeditor-modal]')).toBeNull();
  });

  // ── Phase F: auto-switch on profile navigation ────────────────────────────

  it('should load known accounts on startup via AUTH_LIST_ACCOUNTS', async () => {
    const sendMessage = vi.fn(async request => {
      if (request.type === 'AUTH_GET_STATUS') return { authenticated: false };
      if (request.type === 'AUTH_LIST_ACCOUNTS') return { accounts: [] };
      return { ok: true };
    });
    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks(3);

    expect(sendMessage).toHaveBeenCalledWith({ type: 'AUTH_LIST_ACCOUNTS' });
  });

  it('should send AUTH_SWITCH_ACCOUNT when navigating to a non-active known account profile', async () => {
    const sendMessage = vi.fn(async request => {
      if (request.type === 'AUTH_GET_STATUS')
        return {
          authenticated: true,
          did: 'did:plc:alice123',
          handle: 'alice.bsky.social',
          expiresAt: Date.now() + 60_000,
        };
      if (request.type === 'AUTH_LIST_ACCOUNTS')
        return {
          accounts: [
            { did: 'did:plc:alice123', handle: 'alice.bsky.social', expiresAt: Date.now() + 60_000, isActive: true },
            { did: 'did:plc:bob456', handle: 'bob.bsky.social', expiresAt: Date.now() + 60_000, isActive: false },
          ],
        };
      return { ok: true };
    });
    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks(3);

    history.pushState({}, '', '/profile/bob.bsky.social');
    await flushMicrotasks(3);

    expect(sendMessage).toHaveBeenCalledWith({ type: 'AUTH_SWITCH_ACCOUNT', did: 'did:plc:bob456' });
  });

  it('should refresh known accounts lazily in checkProfileSwitch when none loaded', async () => {
    const sendMessage = vi.fn(async request => {
      if (request.type === 'AUTH_GET_STATUS') {
        return {
          authenticated: true,
          did: 'did:plc:alice123',
          handle: 'alice.bsky.social',
          expiresAt: Date.now() + 60_000,
        };
      }
      if (request.type === 'AUTH_LIST_ACCOUNTS') {
        // First startup load fails, subsequent lazy load succeeds.
        const callCount = sendMessage.mock.calls.filter(c => c[0]?.type === 'AUTH_LIST_ACCOUNTS').length;
        if (callCount <= 1) {
          throw new Error('temporary failure');
        }
        return {
          accounts: [
            { did: 'did:plc:alice123', handle: 'alice.bsky.social', expiresAt: Date.now() + 60_000, isActive: true },
            { did: 'did:plc:bob456', handle: 'bob.bsky.social', expiresAt: Date.now() + 60_000, isActive: false },
          ],
        };
      }
      return { ok: true };
    });
    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks(3);

    history.pushState({}, '', '/profile/bob.bsky.social');
    await flushMicrotasks(4);

    expect(sendMessage).toHaveBeenCalledWith({ type: 'AUTH_SWITCH_ACCOUNT', did: 'did:plc:bob456' });
  });

  it('should auto-switch on initial page load when URL profile is a non-active known account', async () => {
    history.replaceState({}, '', '/profile/bob.bsky.social/post/3abc');

    const sendMessage = vi.fn(async request => {
      if (request.type === 'AUTH_GET_STATUS')
        return {
          authenticated: true,
          did: 'did:plc:alice123',
          handle: 'alice.bsky.social',
          expiresAt: Date.now() + 60_000,
        };
      if (request.type === 'AUTH_LIST_ACCOUNTS')
        return {
          accounts: [
            { did: 'did:plc:alice123', handle: 'alice.bsky.social', expiresAt: Date.now() + 60_000, isActive: true },
            { did: 'did:plc:bob456', handle: 'bob.bsky.social', expiresAt: Date.now() + 60_000, isActive: false },
          ],
        };
      return { ok: true };
    });
    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks(4);

    expect(sendMessage).toHaveBeenCalledWith({ type: 'AUTH_SWITCH_ACCOUNT', did: 'did:plc:bob456' });
  });

  it('should match by DID as well as handle when auto-switching', async () => {
    const sendMessage = vi.fn(async request => {
      if (request.type === 'AUTH_GET_STATUS')
        return { authenticated: true, did: 'did:plc:alice123', expiresAt: Date.now() + 60_000 };
      if (request.type === 'AUTH_LIST_ACCOUNTS')
        return {
          accounts: [
            { did: 'did:plc:alice123', expiresAt: Date.now() + 60_000, isActive: true },
            { did: 'did:plc:bob456', expiresAt: Date.now() + 60_000, isActive: false },
          ],
        };
      return { ok: true };
    });
    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks(3);

    history.pushState({}, '', '/profile/did:plc:bob456');
    await flushMicrotasks(3);

    expect(sendMessage).toHaveBeenCalledWith({ type: 'AUTH_SWITCH_ACCOUNT', did: 'did:plc:bob456' });
  });

  it('should not send AUTH_SWITCH_ACCOUNT when navigating to the already-active account', async () => {
    const sendMessage = vi.fn(async request => {
      if (request.type === 'AUTH_GET_STATUS')
        return {
          authenticated: true,
          did: 'did:plc:alice123',
          handle: 'alice.bsky.social',
          expiresAt: Date.now() + 60_000,
        };
      if (request.type === 'AUTH_LIST_ACCOUNTS')
        return {
          accounts: [
            { did: 'did:plc:alice123', handle: 'alice.bsky.social', expiresAt: Date.now() + 60_000, isActive: true },
          ],
        };
      return { ok: true };
    });
    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks(3);

    history.pushState({}, '', '/profile/alice.bsky.social');
    await flushMicrotasks(3);

    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'AUTH_SWITCH_ACCOUNT' }));
  });

  it('should not send AUTH_SWITCH_ACCOUNT for non-profile URLs', async () => {
    const sendMessage = vi.fn(async request => {
      if (request.type === 'AUTH_GET_STATUS')
        return { authenticated: true, did: 'did:plc:alice123', expiresAt: Date.now() + 60_000 };
      if (request.type === 'AUTH_LIST_ACCOUNTS')
        return {
          accounts: [
            { did: 'did:plc:alice123', expiresAt: Date.now() + 60_000, isActive: true },
            { did: 'did:plc:bob456', expiresAt: Date.now() + 60_000, isActive: false },
          ],
        };
      return { ok: true };
    });
    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks(3);

    history.pushState({}, '', '/');
    await flushMicrotasks(3);

    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'AUTH_SWITCH_ACCOUNT' }));
  });

  it('should trigger auto-switch on popstate (browser back/forward)', async () => {
    const sendMessage = vi.fn(async request => {
      if (request.type === 'AUTH_GET_STATUS')
        return {
          authenticated: true,
          did: 'did:plc:alice123',
          handle: 'alice.bsky.social',
          expiresAt: Date.now() + 60_000,
        };
      if (request.type === 'AUTH_LIST_ACCOUNTS')
        return {
          accounts: [
            { did: 'did:plc:alice123', handle: 'alice.bsky.social', expiresAt: Date.now() + 60_000, isActive: true },
            { did: 'did:plc:bob456', handle: 'bob.bsky.social', expiresAt: Date.now() + 60_000, isActive: false },
          ],
        };
      return { ok: true };
    });
    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks(3);

    // Simulate the URL having changed before popstate fires (as browsers do)
    history.pushState({}, '', '/profile/bob.bsky.social');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await flushMicrotasks(3);

    expect(sendMessage).toHaveBeenCalledWith({ type: 'AUTH_SWITCH_ACCOUNT', did: 'did:plc:bob456' });
  });

  it('should not sync UI when a rapid subsequent navigation supersedes the switch', async () => {
    let resolveSwitch: (() => void) | undefined;
    const switchInFlight = new Promise<void>(resolve => {
      resolveSwitch = resolve;
    });

    const sendMessage = vi.fn(async request => {
      if (request.type === 'AUTH_GET_STATUS')
        return {
          authenticated: true,
          did: 'did:plc:alice123',
          handle: 'alice.bsky.social',
          expiresAt: Date.now() + 60_000,
        };
      if (request.type === 'AUTH_LIST_ACCOUNTS')
        return {
          accounts: [
            { did: 'did:plc:alice123', handle: 'alice.bsky.social', expiresAt: Date.now() + 60_000, isActive: true },
            { did: 'did:plc:bob456', handle: 'bob.bsky.social', expiresAt: Date.now() + 60_000, isActive: false },
          ],
        };
      if (request.type === 'AUTH_SWITCH_ACCOUNT') {
        await switchInFlight; // Suspend so we can fire a second navigation.
        return { ok: true };
      }
      return { ok: true };
    });
    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks(3);

    // Navigation A — triggers switch to bob.
    history.pushState({}, '', '/profile/bob.bsky.social');

    // Yield so checkProfileSwitch for bob reaches its first await (sendMessage).
    await Promise.resolve();

    // Navigation B fires while A is suspended — increments the navigation token.
    history.pushState({}, '', '/');

    // Allow A's sendMessage to resolve.
    resolveSwitch?.();
    await flushMicrotasks(4);

    // AUTH_SWITCH_ACCOUNT was sent (can't cancel an in-flight message), but
    // AUTH_LIST_ACCOUNTS should NOT have been called again because the token
    // check aborted A's UI sync steps.
    const listAccountsCalls = sendMessage.mock.calls.filter(c => c[0]?.type === 'AUTH_LIST_ACCOUNTS');
    // Only the startup call — not a second one from A's post-switch sync.
    expect(listAccountsCalls).toHaveLength(1);
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

    const modal = document.querySelector<HTMLElement>('[data-skeeditor-modal]');
    expect(modal).toBeTruthy();

    const shadowRoot = modal?.shadowRoot;
    const textarea = shadowRoot?.querySelector<HTMLTextAreaElement>('textarea');
    const saveButton = shadowRoot?.querySelector<HTMLButtonElement>('.save-button');
    const statusMessage = shadowRoot?.querySelector<HTMLElement>('.status-message');

    expect(textarea?.disabled).toBe(true);
    expect(saveButton?.disabled).toBe(true);
    expect(statusMessage?.textContent).toContain('older than your edit time limit of 5 minutes');
  });

  it('should preserve the original createdAt when save strategy is edit', async () => {
    const createdAt = '2026-03-26T00:00:00.000Z';
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
          value: { $type: 'app.bsky.feed.post', text: 'Hello Bluesky', createdAt },
          cid: 'bafyreitest',
        };
      }

      if (request.type === 'GET_SETTINGS') return { editTimeLimit: null, saveStrategy: 'edit' };

      if (request.type === 'CREATE_RECORD') {
        return { type: 'CREATE_RECORD_SUCCESS', uri: 'at://archive', cid: 'bafyreihistory' };
      }

      if (request.type === 'PUT_RECORD') {
        return { type: 'PUT_RECORD_SUCCESS', uri: 'at://updated', cid: 'bafyreinew' };
      }

      return { ok: true };
    });

    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks();

    const editButton = document.querySelector<HTMLButtonElement>('[data-skeeditor-edit-button]');
    editButton?.click();
    await flushMicrotasks(4);

    const modal = document.querySelector<HTMLElement>('[data-skeeditor-modal]');
    const shadowRoot = modal?.shadowRoot;
    const textarea = shadowRoot?.querySelector<HTMLTextAreaElement>('textarea');
    const saveButton = shadowRoot?.querySelector<HTMLButtonElement>('.save-button');

    textarea!.value = 'Hello Bluesky, preserved';
    textarea!.dispatchEvent(new Event('input', { bubbles: true }));
    saveButton?.click();
    await flushMicrotasks(6);

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PUT_RECORD',
        record: expect.objectContaining({ createdAt, text: 'Hello Bluesky, preserved' }),
      }),
    );
  });

  it('should recreate the record with a fresh createdAt when save strategy is recreate', async () => {
    const createdAt = '2026-03-26T00:00:00.000Z';
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
          value: { $type: 'app.bsky.feed.post', text: 'Hello Bluesky', createdAt },
          cid: 'bafyreitest',
        };
      }

      if (request.type === 'GET_SETTINGS') return { editTimeLimit: null, saveStrategy: 'recreate' };
      if (request.type === 'CREATE_RECORD') {
        return { type: 'CREATE_RECORD_SUCCESS', uri: 'at://archive', cid: 'bafyreihistory' };
      }
      if (request.type === 'RECREATE_RECORD') {
        return { type: 'PUT_RECORD_SUCCESS', uri: 'at://updated', cid: 'bafyreinew' };
      }

      return { ok: true };
    });

    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks();

    const editButton = document.querySelector<HTMLButtonElement>('[data-skeeditor-edit-button]');
    editButton?.click();
    await flushMicrotasks(4);

    const modal = document.querySelector<HTMLElement>('[data-skeeditor-modal]');
    const shadowRoot = modal?.shadowRoot;
    const textarea = shadowRoot?.querySelector<HTMLTextAreaElement>('textarea');
    const saveButton = shadowRoot?.querySelector<HTMLButtonElement>('.save-button');

    textarea!.value = 'Hello Bluesky, recreated';
    textarea!.dispatchEvent(new Event('input', { bubbles: true }));
    const before = Date.now();
    saveButton?.click();
    await flushMicrotasks(6);
    const after = Date.now();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RECREATE_RECORD',
        record: expect.objectContaining({ text: 'Hello Bluesky, recreated' }),
      }),
    );
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'PUT_RECORD' }));

    const recreateCall = sendMessage.mock.calls.find(([request]) => request.type === 'RECREATE_RECORD');
    const recreatedRecord = recreateCall?.[0]?.record as { createdAt: string } | undefined;
    const recreatedAt = recreatedRecord ? Date.parse(recreatedRecord.createdAt) : Number.NaN;

    expect(recreatedRecord?.createdAt).not.toBe(createdAt);
    expect(recreatedAt).toBeGreaterThanOrEqual(before - 5000);
    expect(recreatedAt).toBeLessThanOrEqual(after + 5000);
  });

  it('should surface a local validation error and skip PUT_RECORD when the edited post is invalid', async () => {
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
          value: { $type: 'app.bsky.feed.post', text: 'Hello Bluesky', createdAt: 'not-a-datetime' },
          cid: 'bafyreitest',
        };
      }

      if (request.type === 'GET_SETTINGS') return { editTimeLimit: null, saveStrategy: 'edit' };

      return { ok: true };
    });

    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    await import('@src/content/content-script');
    await flushMicrotasks();

    const editButton = document.querySelector<HTMLButtonElement>('[data-skeeditor-edit-button]');
    editButton?.click();
    await flushMicrotasks(4);

    const modal = document.querySelector<HTMLElement>('[data-skeeditor-modal]');
    const shadowRoot = modal?.shadowRoot;
    const textarea = shadowRoot?.querySelector<HTMLTextAreaElement>('textarea');
    const saveButton = shadowRoot?.querySelector<HTMLButtonElement>('.save-button');

    textarea!.value = 'Hello Bluesky, invalid preserve';
    textarea!.dispatchEvent(new Event('input', { bubbles: true }));
    saveButton?.click();
    await flushMicrotasks(6);

    const statusMessage = shadowRoot?.querySelector<HTMLElement>('.status-message');

    expect(statusMessage?.textContent).toContain('Edited post is invalid');
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'PUT_RECORD' }));
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'CREATE_RECORD' }));
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'RECREATE_RECORD' }));
  });

  // ── Phase 3: listener lifecycle ──────────────────────────────────────────

  it('should remove the Edited label click listener from document on cleanupContentScript', async () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const sendMessage = vi.fn(async (request: { type: string }) => {
      if (request.type === 'AUTH_GET_STATUS') return { authenticated: false };
      return { ok: true };
    });
    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    const { cleanupContentScript } = await import('@src/content/content-script');
    await flushMicrotasks();

    // Capture the exact handler reference that was registered.
    const addCall = addEventListenerSpy.mock.calls.find(([event, , capture]) => event === 'click' && capture === true);
    expect(addCall).toBeDefined();
    const registeredHandler = addCall![1];

    cleanupContentScript();

    // removeEventListener must be called with the identical function reference.
    const removeCall = removeEventListenerSpy.mock.calls.find(
      ([event, handler, capture]) => event === 'click' && handler === registeredHandler && capture === true,
    );
    expect(removeCall).toBeDefined();
  });

  it('should re-attach the Edited label click listener after a cleanup-and-restart cycle', async () => {
    const sendMessage = vi.fn(async (request: { type: string }) => {
      if (request.type === 'AUTH_GET_STATUS') return { authenticated: false };
      return { ok: true };
    });
    globalThis.browser.runtime.sendMessage = sendMessage as typeof globalThis.browser.runtime.sendMessage;

    // Use the same module instance so the test exercises cleanupContentScript()
    // actually resetting editedLabelListenerAttached / editedLabelClickHandler.
    // A vi.resetModules() + re-import would mask regressions because a fresh
    // module instance always starts with clean state regardless of cleanup.
    const { cleanupContentScript, start } = await import('@src/content/content-script');
    await flushMicrotasks();

    // First lifecycle teardown.
    cleanupContentScript();

    // Spy AFTER cleanup so we only capture listener additions from the next start().
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    // Second lifecycle: restart in the same module instance.
    start();
    await flushMicrotasks();

    // The click capture listener must be registered again on the second start.
    const captureAdditions = addEventListenerSpy.mock.calls.filter(
      ([event, , capture]) => event === 'click' && capture === true,
    );
    expect(captureAdditions.length).toBeGreaterThan(0);
  });
});
