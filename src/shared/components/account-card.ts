import globalStyles from '../../shadow-styles.css?inline';

function parseBooleanAttribute(value: string | null): boolean {
  if (value === null) return false;
  if (value === '' || value === 'true') return true;
  return value !== 'false';
}

function createActiveIndicator(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'ml-1 size-3.5 shrink-0 text-indigo-500 dark:text-indigo-400');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-label', 'Active account');
  svg.setAttribute('role', 'img');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z',
  );
  path.setAttribute('fill-rule', 'evenodd');
  path.setAttribute('clip-rule', 'evenodd');

  svg.appendChild(path);
  return svg;
}

export class AccountCard extends HTMLElement {
  public static readonly observedAttributes = [
    'did',
    'handle',
    'is-active',
    'switch-label',
    'remove-label',
    'show-reauthorize',
  ];

  private readonly root: ShadowRoot;

  public constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  public connectedCallback(): void {
    this.render();
  }

  public attributeChangedCallback(): void {
    this.render();
  }

  private get did(): string {
    return this.getAttribute('did') ?? '';
  }

  private get handle(): string | null {
    return this.getAttribute('handle');
  }

  private get isActive(): boolean {
    return parseBooleanAttribute(this.getAttribute('is-active'));
  }

  private get switchLabel(): string {
    return this.getAttribute('switch-label') ?? 'Switch';
  }

  private get removeLabel(): string {
    return this.getAttribute('remove-label') ?? 'Sign out';
  }

  private get showReauthorize(): boolean {
    return parseBooleanAttribute(this.getAttribute('show-reauthorize'));
  }

  private emitAction(type: 'account-switch' | 'account-remove' | 'account-reauthorize'): void {
    if (!this.did) return;
    this.dispatchEvent(
      new CustomEvent<{ did: string }>(type, {
        detail: { did: this.did },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private createActionButton(className: string, label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.dataset['did'] = this.did;
    button.textContent = label;
    return button;
  }

  private render(): void {
    this.root.innerHTML = `
      <style>
        ${globalStyles}
        :host { display: block; }
        .account-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .account-label {
          min-width: 0;
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }
        .account-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.875rem;
          color: var(--color-text-primary);
        }
        .account-name.did {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }
        .active-indicator {
          margin-left: 0.125rem;
          width: 0.875rem;
          height: 0.875rem;
          flex-shrink: 0;
          color: var(--color-primary);
        }
        .actions {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          gap: 0.5rem;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 1.75rem;
          border-radius: var(--radius-control);
          padding: 0.375rem 0.625rem;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        .btn:focus-visible {
          outline: 2px solid var(--color-input-focus);
          outline-offset: 2px;
        }
        .btn.primary {
          background: var(--color-primary);
          color: var(--color-primary-text);
        }
        .btn.primary:hover { background: var(--color-primary-hover); }
        .btn.secondary {
          background: var(--color-secondary-bg);
          color: var(--color-secondary-text);
          border-color: var(--color-secondary-border);
        }
        .btn.secondary:hover { background: var(--color-secondary-bg-hover); }
        .btn.danger {
          background: var(--color-danger);
          color: var(--color-danger-text);
        }
        .btn.danger:hover { background: var(--color-danger-hover); }
      </style>
    `;

    if (!this.did) {
      return;
    }

    const row = document.createElement('div');
    row.className = 'account-row';

    const accountLabel = document.createElement('div');
    accountLabel.className = 'account-label';

    const label = document.createElement('span');
    if (this.handle) {
      label.className = 'account-name';
      label.textContent = this.handle;
    } else {
      label.className = 'account-name did';
      label.textContent = this.did;
    }
    accountLabel.appendChild(label);

    if (this.isActive) {
      const indicator = createActiveIndicator();
      indicator.setAttribute('class', 'active-indicator');
      accountLabel.appendChild(indicator);
    }

    const actions = document.createElement('div');
    actions.className = 'actions';

    if (!this.isActive) {
      const switchButton = this.createActionButton('account-switch btn primary', this.switchLabel);
      switchButton.addEventListener('click', () => this.emitAction('account-switch'));
      actions.appendChild(switchButton);
    }

    if (this.isActive && this.showReauthorize) {
      const reauthorizeButton = this.createActionButton('account-reauthorize btn secondary', 'Reauthorize');
      reauthorizeButton.id = 'reauthorize';
      reauthorizeButton.addEventListener('click', () => this.emitAction('account-reauthorize'));
      actions.appendChild(reauthorizeButton);
    }

    const removeButton = this.createActionButton('account-sign-out account-remove btn danger', this.removeLabel);
    removeButton.addEventListener('click', () => this.emitAction('account-remove'));
    actions.appendChild(removeButton);

    row.append(accountLabel, actions);
    this.root.appendChild(row);
  }
}

const accountCardRegistry =
  globalThis.customElements ??
  (Object.getPrototypeOf(globalThis) as { customElements?: CustomElementRegistry | null })?.customElements ??
  null;
if (accountCardRegistry && !accountCardRegistry.get('account-card')) {
  accountCardRegistry.define('account-card', AccountCard);
}
