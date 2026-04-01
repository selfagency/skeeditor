import globalStyles from '../../shadow-styles.css?inline';

const BASE_BTN =
  'inline-flex items-center justify-center h-7 rounded px-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2';
const INDIGO_BTN = `${BASE_BTN} bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 focus-visible:outline-indigo-600`;
const RED_BTN = `${BASE_BTN} bg-red-600 text-white hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400 focus-visible:outline-red-600`;
const GHOST_BTN = `${BASE_BTN} bg-white text-gray-900 inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:inset-ring-white/5 dark:hover:bg-white/20`;

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
    this.root.innerHTML = `<style>${globalStyles}</style>`;

    if (!this.did) {
      return;
    }

    const row = document.createElement('div');
    row.className = 'account-row flex items-center justify-between gap-2';

    const accountLabel = document.createElement('div');
    accountLabel.className = 'min-w-0 flex-1 flex items-center gap-1';

    const label = document.createElement('span');
    if (this.handle) {
      label.className = 'truncate text-sm font-medium text-gray-900 dark:text-gray-100';
      label.textContent = this.handle;
    } else {
      label.className = 'truncate font-mono text-xs text-gray-600 dark:text-gray-400';
      label.textContent = this.did;
    }
    accountLabel.appendChild(label);

    if (this.isActive) {
      accountLabel.appendChild(createActiveIndicator());
    }

    const actions = document.createElement('div');
    actions.className = 'flex shrink-0 items-center gap-1';

    if (!this.isActive) {
      const switchButton = this.createActionButton(`account-switch ${INDIGO_BTN}`, this.switchLabel);
      switchButton.addEventListener('click', () => this.emitAction('account-switch'));
      actions.appendChild(switchButton);
    }

    if (this.isActive && this.showReauthorize) {
      const reauthorizeButton = this.createActionButton(`account-reauthorize ${GHOST_BTN}`, 'Reauthorize');
      reauthorizeButton.id = 'reauthorize';
      reauthorizeButton.addEventListener('click', () => this.emitAction('account-reauthorize'));
      actions.appendChild(reauthorizeButton);
    }

    const removeButton = this.createActionButton(`account-sign-out account-remove ${RED_BTN}`, this.removeLabel);
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
