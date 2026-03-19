import { sendMessage } from '../shared/messages';

type PopupState = 'loading' | 'unauthenticated' | 'authenticated';

/**
 * `<auth-popup>` Web Component — renders login/logout UI inside the extension
 * popup. Reads session state from `browser.storage.local` directly and delegates
 * auth-flow triggers to the background service worker via `browser.runtime.sendMessage`.
 */
class AuthPopup extends HTMLElement {
  private readonly shadow: ShadowRoot;
  private state: PopupState = 'loading';
  private did: string | null = null;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
    void this.checkAuth();
  }

  private async checkAuth(): Promise<void> {
    const status = await sendMessage({ type: 'AUTH_GET_STATUS' });

    if (status.authenticated) {
      this.state = 'authenticated';
      this.did = status.did;
    } else {
      this.state = 'unauthenticated';
      this.did = null;
    }

    this.render();
  }

  private render(): void {
    this.shadow.innerHTML = this.template();
    this.attachHandlers();
  }

  private template(): string {
    switch (this.state) {
      case 'loading':
        return `<span class="loading">Checking authentication\u2026</span>`;

      case 'unauthenticated':
        return `
          <div class="auth-panel">
            <p>Sign in with your Bluesky account to edit posts.</p>
            <button id="sign-in" class="btn-primary">Sign in with Bluesky</button>
          </div>`;

      case 'authenticated':
        return `
          <div class="auth-panel">
            <p class="account-did">${this.escapeHTML(this.did ?? '')}</p>
            <button id="reauthorize" class="btn-secondary">Reauthorize</button>
            <button id="sign-out" class="btn-danger">Sign out</button>
          </div>`;
    }
  }

  private attachHandlers(): void {
    this.shadow.getElementById('sign-in')?.addEventListener('click', async () => {
      try {
        await sendMessage({ type: 'AUTH_SIGN_IN' });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to start sign-in flow', error);
      }
    });

    this.shadow.getElementById('sign-out')?.addEventListener('click', async () => {
      try {
        await sendMessage({ type: 'AUTH_SIGN_OUT' });
        this.state = 'unauthenticated';
        this.did = null;
        this.render();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to sign out', error);
      }
    });

    this.shadow.getElementById('reauthorize')?.addEventListener('click', async () => {
      try {
        await sendMessage({ type: 'AUTH_REAUTHORIZE' });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to reauthorize session', error);
      }
    });
  }

  /** Prevent XSS when interpolating user-controlled data (e.g. DIDs) into HTML */
  private escapeHTML(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

if (!customElements.get('auth-popup')) {
  customElements.define('auth-popup', AuthPopup);
}
