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
    this.root.innerHTML = `
      <style>
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
      </style>
      <span class="spinner" aria-hidden="true"></span>
      <span class="spinner-label"></span>
    `;

    const labelElement = this.root.querySelector<HTMLElement>('.spinner-label');
    if (labelElement) {
      labelElement.textContent = label;
    }
  }
}

if (!customElements.get('skeeditor-spinner')) {
  customElements.define('skeeditor-spinner', SkeeditorSpinner);
}
