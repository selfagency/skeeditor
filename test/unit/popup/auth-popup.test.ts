import '@src/popup/auth-popup';

import { describe, it, expect, vi, beforeEach } from 'vitest';

const flushPromises = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

const createElement = (): HTMLElement => document.createElement('auth-popup');

const attach = async (el: HTMLElement): Promise<void> => {
  document.body.appendChild(el);
  await flushPromises();
};

describe('auth-popup Web Component', () => {
  beforeEach(() => {
    // Default: not authenticated
    vi.mocked(browser.runtime.sendMessage).mockResolvedValue({ authenticated: false });
  });

  describe('loading state', () => {
    it('renders a loading indicator before the session check resolves', () => {
      // Make AUTH_GET_STATUS block indefinitely so the component stays loading
      vi.mocked(browser.runtime.sendMessage).mockImplementation(() => new Promise(() => {}));

      const el = createElement();
      document.body.appendChild(el);

      const root = el.shadowRoot;
      expect(root?.querySelector('.loading')).not.toBeNull();
    });
  });

  describe('unauthenticated state', () => {
    it('shows a sign-in button when AUTH_GET_STATUS returns unauthenticated', async () => {
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue({ authenticated: false });

      const el = createElement();
      await attach(el);

      const root = el.shadowRoot;
      expect(root?.querySelector('#sign-in')).not.toBeNull();
      expect(root?.querySelector('#sign-out')).toBeNull();
    });

    it('shows a sign-in button when the session is expired', async () => {
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue({ authenticated: false });

      const el = createElement();
      await attach(el);

      const root = el.shadowRoot;
      expect(root?.querySelector('#sign-in')).not.toBeNull();
    });
  });

  describe('authenticated state', () => {
    it('shows the DID when a valid session exists', async () => {
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue({
        authenticated: true,
        did: 'did:plc:testuser123',
        expiresAt: Date.now() + 60_000,
      });

      const el = createElement();
      await attach(el);

      const root = el.shadowRoot;
      expect(root?.textContent).toContain('did:plc:testuser123');
    });

    it('shows sign-out and reauthorize buttons when authenticated', async () => {
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue({
        authenticated: true,
        did: 'did:plc:testuser123',
        expiresAt: Date.now() + 60_000,
      });

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
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue({ authenticated: false });

      const el = createElement();
      await attach(el);

      el.shadowRoot?.querySelector<HTMLButtonElement>('#sign-in')?.click();

      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({ type: 'AUTH_SIGN_IN' });
    });

    it('sends AUTH_SIGN_OUT when sign-out button is clicked', async () => {
      vi.mocked(browser.runtime.sendMessage)
        .mockResolvedValueOnce({ authenticated: true, did: 'did:plc:testuser123', expiresAt: Date.now() + 60_000 })
        .mockResolvedValue({ ok: true });

      const el = createElement();
      await attach(el);

      el.shadowRoot?.querySelector<HTMLButtonElement>('#sign-out')?.click();
      await flushPromises();

      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({ type: 'AUTH_SIGN_OUT' });
    });

    it('transitions back to unauthenticated after sign-out', async () => {
      vi.mocked(browser.runtime.sendMessage)
        .mockResolvedValueOnce({ authenticated: true, did: 'did:plc:testuser123', expiresAt: Date.now() + 60_000 })
        .mockResolvedValue({ ok: true });

      const el = createElement();
      await attach(el);

      el.shadowRoot?.querySelector<HTMLButtonElement>('#sign-out')?.click();
      await flushPromises();

      expect(el.shadowRoot?.querySelector('#sign-in')).not.toBeNull();
      expect(el.shadowRoot?.querySelector('#sign-out')).toBeNull();
    });

    it('sends AUTH_REAUTHORIZE when reauthorize button is clicked', async () => {
      vi.mocked(browser.runtime.sendMessage)
        .mockResolvedValueOnce({ authenticated: true, did: 'did:plc:testuser123', expiresAt: Date.now() + 60_000 })
        .mockResolvedValue({ ok: true });

      const el = createElement();
      await attach(el);

      el.shadowRoot?.querySelector<HTMLButtonElement>('#reauthorize')?.click();

      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({ type: 'AUTH_REAUTHORIZE' });
    });
  });
});
