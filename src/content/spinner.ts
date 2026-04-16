import { createStyleElement } from '../shared/utils/dom';

export class SkeeditorSpinner extends HTMLElement {
  private readonly root: ShadowRoot;

  public constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  public connectedCallback(): void {
    this.render();
  }

  public static get observedAttributes(): string[] {
    return ['label'];
  }

  public attributeChangedCallback(): void {
    this.render();
  }

  private render(): void {
    const label = this.getAttribute('label') ?? 'Loading';
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    spinner.setAttribute('aria-hidden', 'true');

    const labelElement = document.createElement('span');
    labelElement.className = 'spinner-label';
    labelElement.textContent = label;

    this.root.replaceChildren(
      createStyleElement(`
        :host {
          display: inline-flex;
          align-items: center;
          gap: 0.625rem;
          color: var(--color-text-secondary, #536471);
          font-size: 0.875rem;
        }
        .spinner {
          width: 1rem;
          height: 1rem;
          border-radius: 9999px;
          border: 2px solid color-mix(in srgb, currentColor 25%, transparent);
          border-top-color: currentColor;
          animation: skeeditor-spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes skeeditor-spin {
          to { transform: rotate(360deg); }
        }
      `),
      spinner,
      labelElement,
    );
  }
}

if (typeof customElements !== 'undefined' && customElements !== null && !customElements.get('skeeditor-spinner')) {
  customElements.define('skeeditor-spinner', SkeeditorSpinner);
}
