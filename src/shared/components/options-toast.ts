const TOAST_DURATION_MS = 3000;
const TOAST_EXIT_MS = 200;

export class OptionsToast extends HTMLElement {
  public static readonly observedAttributes = ['message', 'type'];

  private readonly root: ShadowRoot;
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  public connectedCallback(): void {
    this.render();
    this.style.cssText = [
      'position:fixed',
      'top:1rem',
      'right:1rem',
      'z-index:1000',
      'opacity:0',
      'transform:translateY(-0.5rem)',
      'transition:opacity 0.18s ease, transform 0.18s ease',
      'pointer-events:none',
    ].join(';');
    requestAnimationFrame(() => {
      this.style.opacity = '1';
      this.style.transform = 'translateY(0)';
    });
    this.startDismissTimer();
  }

  public disconnectedCallback(): void {
    this.clearTimers();
  }

  public attributeChangedCallback(): void {
    this.render();
  }

  private get message(): string {
    return this.getAttribute('message') ?? '';
  }

  private get tone(): 'info' | 'success' | 'error' {
    const type = this.getAttribute('type');
    return type === 'success' || type === 'error' ? type : 'info';
  }

  private clearTimers(): void {
    if (this.dismissTimer !== null) clearTimeout(this.dismissTimer);
    if (this.cleanupTimer !== null) clearTimeout(this.cleanupTimer);
    this.dismissTimer = null;
    this.cleanupTimer = null;
  }

  private startDismissTimer(): void {
    this.clearTimers();
    this.dismissTimer = setTimeout(() => {
      this.style.opacity = '0';
      this.style.transform = 'translateY(-0.5rem)';
      this.cleanupTimer = setTimeout(() => this.remove(), TOAST_EXIT_MS);
    }, TOAST_DURATION_MS);
  }

  private render(): void {
    const palette =
      this.tone === 'success'
        ? { bg: 'var(--color-success-bg)', fg: 'var(--color-success-text)' }
        : this.tone === 'error'
          ? { bg: 'var(--color-error-bg)', fg: 'var(--color-error-text)' }
          : { bg: 'var(--color-primary-soft-bg)', fg: 'var(--color-text-primary)' };

    this.root.innerHTML = `
      <style>
        :host { display: block; }
        .toast {
          max-width: min(24rem, calc(100vw - 2rem));
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-card);
          padding: 0.75rem 1rem;
          box-shadow: 0 10px 25px oklch(0% 0 none / 0.12);
          background: ${palette.bg};
          color: ${palette.fg};
          font-size: 0.875rem;
          line-height: 1.4;
        }
      </style>
      <div class="toast">${this.message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</div>
    `;
  }
}

export function showOptionsToast(message: string, type: 'info' | 'success' | 'error'): void {
  if (!customElements.get('options-toast')) {
    customElements.define('options-toast', OptionsToast);
  }

  document.querySelectorAll('options-toast').forEach(el => el.remove());
  const toast = document.createElement('options-toast');
  toast.setAttribute('message', message);
  toast.setAttribute('type', type);
  document.body.appendChild(toast);
}
