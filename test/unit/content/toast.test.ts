import '@src/content/toast';

import { afterEach, describe, expect, it, vi } from 'vitest';

const createToast = (message: string): HTMLElement => {
  const toast = document.createElement('skeeditor-toast');
  toast.setAttribute('message', message);
  document.body.appendChild(toast);
  return toast;
};

describe('<skeeditor-toast>', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('renders provided message in shadow DOM', () => {
    const toast = createToast('Edit saved.');

    expect(toast.shadowRoot?.textContent).toContain('Edit saved.');
  });

  it('renders message as text and does not parse HTML markup', () => {
    const payload = '<img src=x onerror=alert(1)>unsafe';
    const toast = createToast(payload);

    expect(toast.shadowRoot?.querySelector('img')).toBeNull();
    expect(toast.shadowRoot?.textContent).toContain(payload);
  });

  it('auto-dismisses and removes itself', () => {
    vi.useFakeTimers();

    const toast = createToast('Edit saved.');
    expect(document.body.contains(toast)).toBe(true);

    vi.advanceTimersByTime(3250);

    expect(document.body.contains(toast)).toBe(false);
  });
});
