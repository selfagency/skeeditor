import '@src/popup/auth-popup';

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { StoredSession } from '@src/shared/auth/session-store';

const flushPromises = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

const makeSession = (overrides: Partial<StoredSession> = {}): StoredSession => ({
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: Date.now() + 60_000,
  scope: 'atproto transition:generic',
  did: 'did:plc:testuser123',
  ...overrides,
});

const createElement = (): HTMLElement => document.createElement('auth-popup');

const attach = async (el: HTMLElement): Promise<void> => {
  document.body.appendChild(el);
  await flushPromises();
};

describe('auth-popup Web Component', () => {
  beforeEach(() => {
    vi.mocked(browser.runtime.sendMessage).mockResolvedValue({ ok: true });
  });

  describe('loading state', () => {
    it('renders a loading indicator before the session check resolves', () => {
      // Make storage block indefinitely so the component stays loading
      vi.mocked(browser.storage.local.get).mockImplementation(() => new Promise(() => {}));

      const el = createElement();
      document.body.appendChild(el);

      const root = el.shadowRoot;
      expect(root?.querySelector('.loading')).not.toBeNull();
    });
  });

  describe('unauthenticated state', () => {
    it('shows a sign-in button when storage returns no session', async () => {
      vi.mocked(browser.storage.local.get).mockResolvedValue({} as never);

      const el = createElement();
      await attach(el);

      const root = el.shadowRoot;
      expect(root?.querySelector('#sign-in')).not.toBeNull();
      expect(root?.querySelector('#sign-out')).toBeNull();
    });

    it('shows a sign-in button when the stored session is expired', async () => {
      const expired = makeSession({ expiresAt: Date.now() - 1000 });
      vi.mocked(browser.storage.local.get).mockResolvedValue({ session: expired } as never);

      const el = createElement();
      await attach(el);

      const root = el.shadowRoot;
      expect(root?.querySelector('#sign-in')).not.toBeNull();
    });
  });

  describe('authenticated state', () => {
    it('shows the DID when a valid session exists', async () => {
      const session = makeSession();
      vi.mocked(browser.storage.local.get).mockResolvedValue({ session } as never);

      const el = createElement();
      await attach(el);

      const root = el.shadowRoot;
      expect(root?.textContent).toContain('did:plc:testuser123');
    });

    it('shows sign-out and reauthorize buttons when authenticated', async () => {
      const session = makeSession();
      vi.mocked(browser.storage.local.get).mockResolvedValue({ session } as never);

      const el = createElement();
      await attach(el);

      const root = el.shadowRoot;
      expect(root?.querySelector('#sign-out')).not.toBeNull();
      expect(root?.querySelector('#reauthorize')).not.toBeNull();
      expect(root?.querySelector('#sign-in')).toBeNull();
    });
  });

  describe('messages', () => {
    it('sends AUTH_SIGN_IN when sign-in button is clicked', async () => {
      vi.mocked(browser.storage.local.get).mockResolvedValue({} as never);

      const el = createElement();
      await attach(el);

      el.shadowRoot?.querySelector<HTMLButtonElement>('#sign-in')?.click();

      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({ type: 'AUTH_SIGN_IN' });
    });

    it('sends AUTH_SIGN_OUT when sign-out button is clicked', async () => {
      const session = makeSession();
      vi.mocked(browser.storage.local.get).mockResolvedValue({ session } as never);

      const el = createElement();
      await attach(el);

      el.shadowRoot?.querySelector<HTMLButtonElement>('#sign-out')?.click();
      await flushPromises();

      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({ type: 'AUTH_SIGN_OUT' });
    });

    it('transitions back to unauthenticated after sign-out', async () => {
      const session = makeSession();
      vi.mocked(browser.storage.local.get).mockResolvedValue({ session } as never);

      const el = createElement();
      await attach(el);

      el.shadowRoot?.querySelector<HTMLButtonElement>('#sign-out')?.click();
      await flushPromises();

      expect(el.shadowRoot?.querySelector('#sign-in')).not.toBeNull();
      expect(el.shadowRoot?.querySelector('#sign-out')).toBeNull();
    });

    it('sends AUTH_REAUTHORIZE when reauthorize button is clicked', async () => {
      const session = makeSession();
      vi.mocked(browser.storage.local.get).mockResolvedValue({ session } as never);

      const el = createElement();
      await attach(el);

      el.shadowRoot?.querySelector<HTMLButtonElement>('#reauthorize')?.click();

      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({ type: 'AUTH_REAUTHORIZE' });
    });
  });
});
