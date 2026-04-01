export class OptionsStatus extends HTMLElement {
  public static readonly observedAttributes = ['message', 'type'];

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

  public setStatus(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    this.setAttribute('message', message);
    this.setAttribute('type', type);
  }

  public clear(): void {
    this.removeAttribute('message');
    this.removeAttribute('type');
  }

  private get message(): string {
    return this.getAttribute('message') ?? '';
  }

  private get type(): string {
    return this.getAttribute('type') ?? 'info';
  }

  private render(): void {
    const colorVar =
      this.type === 'success'
        ? 'var(--color-success)'
        : this.type === 'error'
          ? 'var(--color-error)'
          : 'var(--color-info)';

    this.root.innerHTML = `
      <style>
        :host { display: block; min-height: 1.25rem; }
        p {
          margin: 0;
          font-size: 0.875rem;
          color: ${colorVar};
          padding: 0 0.125rem;
        }
      </style>
      <p>${this.escapeHTML(this.message)}</p>
    `;
  }

  private escapeHTML(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

if (!customElements.get('options-status')) {
  customElements.define('options-status', OptionsStatus);
}
