import '@src/shared/components/account-card';

import { describe, expect, it, vi } from 'vitest';

interface AccountCardElement extends HTMLElement {
  shadowRoot: ShadowRoot;
}

const createCard = (attrs: Record<string, string | boolean | undefined>): AccountCardElement => {
  const el = document.createElement('account-card') as AccountCardElement;

  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    if (typeof value === 'boolean') {
      if (value) {
        el.setAttribute(key, 'true');
      }
      continue;
    }
    el.setAttribute(key, value);
  }

  document.body.appendChild(el);
  return el;
};

describe('<account-card>', () => {
  it('renders handle when provided', () => {
    const el = createCard({ did: 'did:plc:abc123', handle: 'alice.bsky.social' });

    expect(el.shadowRoot.textContent).toContain('alice.bsky.social');
    expect(el.shadowRoot.textContent).not.toContain('did:plc:abc123');
  });

  it('renders did when handle is missing', () => {
    const el = createCard({ did: 'did:plc:abc123' });

    expect(el.shadowRoot.textContent).toContain('did:plc:abc123');
  });

  it('emits account-switch with did detail when switch is clicked', () => {
    const el = createCard({ did: 'did:plc:abc123', 'is-active': false });
    const onSwitch = vi.fn();
    el.addEventListener('account-switch', onSwitch);

    el.shadowRoot.querySelector<HTMLButtonElement>('.account-switch')?.click();

    expect(onSwitch).toHaveBeenCalledTimes(1);
    const event = onSwitch.mock.calls[0]?.[0] as CustomEvent<{ did: string }>;
    expect(event.detail.did).toBe('did:plc:abc123');
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
  });

  it('emits account-remove with did detail when sign-out is clicked', () => {
    const el = createCard({ did: 'did:plc:abc123' });
    const onRemove = vi.fn();
    el.addEventListener('account-remove', onRemove);

    el.shadowRoot.querySelector<HTMLButtonElement>('.account-sign-out')?.click();

    expect(onRemove).toHaveBeenCalledTimes(1);
    const event = onRemove.mock.calls[0]?.[0] as CustomEvent<{ did: string }>;
    expect(event.detail.did).toBe('did:plc:abc123');
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
  });

  it('emits account-reauthorize for active account when enabled', () => {
    const el = createCard({ did: 'did:plc:abc123', 'is-active': true, 'show-reauthorize': true });
    const onReauth = vi.fn();
    el.addEventListener('account-reauthorize', onReauth);

    el.shadowRoot.querySelector<HTMLButtonElement>('#reauthorize')?.click();

    expect(onReauth).toHaveBeenCalledTimes(1);
    const event = onReauth.mock.calls[0]?.[0] as CustomEvent<{ did: string }>;
    expect(event.detail.did).toBe('did:plc:abc123');
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
  });
});
