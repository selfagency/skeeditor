import globalStyles from '../shadow-styles.css?inline';
import { createStyleElement, createSvgNode } from '../shared/utils/dom';

const TOAST_DURATION_MS = 3000;
const TOAST_EXIT_MS = 250;

export class SkeeditorToast extends HTMLElement {
  public static readonly observedAttributes = ['message'];

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
      'bottom:1.5rem',
      'left:50%',
      'transform:translateX(-50%) translateY(0.75rem)',
      'z-index:10001',
      'opacity:0',
      'transition:opacity 0.2s ease,transform 0.2s ease',
      'pointer-events:none',
    ].join(';');

    requestAnimationFrame(() => {
      this.style.opacity = '1';
      this.style.transform = 'translateX(-50%) translateY(0)';
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

  private clearTimers(): void {
    if (this.dismissTimer !== null) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
    if (this.cleanupTimer !== null) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private startDismissTimer(): void {
    this.clearTimers();
    this.dismissTimer = setTimeout(() => {
      this.style.opacity = '0';
      this.style.transform = 'translateX(-50%) translateY(0.75rem)';
      this.cleanupTimer = setTimeout(() => {
        this.remove();
      }, TOAST_EXIT_MS);
    }, TOAST_DURATION_MS);
  }

  private render(): void {
    const container = document.createElement('div');
    container.className =
      'inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-zinc-900 px-4 py-2.5 text-sm/6 text-white shadow-lg';

    const icon = createSvgNode('svg', {
      viewBox: '0 0 20 20',
      fill: 'currentColor',
      class: 'size-4 shrink-0 text-green-400',
      'aria-hidden': 'true',
    });
    icon.appendChild(
      createSvgNode('path', {
        'fill-rule': 'evenodd',
        d: 'M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z',
        'clip-rule': 'evenodd',
      }),
    );

    const messageEl = document.createElement('span');
    messageEl.id = 'toast-message';
    messageEl.textContent = this.message;

    container.append(icon, messageEl);

    this.root.replaceChildren(createStyleElement(globalStyles), container);
  }
}

export function ensureToastRegistered(): void {
  if (typeof customElements !== 'undefined' && customElements !== null && !customElements.get('skeeditor-toast')) {
    customElements.define('skeeditor-toast', SkeeditorToast);
  }
}
