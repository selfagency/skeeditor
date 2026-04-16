import globalStyles from '../shadow-styles.css?inline';
import { createStyleElement, createSvgNode } from '../shared/utils/dom';

const HISTORY_MODAL_STYLES = `
    :host {
      display: flex;
      flex-direction: column;
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.5);
      align-items: center;
      justify-content: center;
    }
    ${globalStyles}
    .history-meta {
      font-size: 0.875rem;
      color: oklch(55.1% 0.0234 264.4);
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      background: oklch(96.7% 0.0029 264.5);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .history-meta svg {
      flex-shrink: 0;
      color: oklch(72.77% 0.1535 60.62);
    }
    .history-version {
      border: 1px solid oklch(87.17% 0.0093 258.3);
      border-radius: 0.375rem;
      overflow: hidden;
    }
    .history-version-header {
      font-size: 0.75rem;
      font-weight: 600;
      color: oklch(55.1% 0.0234 264.4);
      padding: 0.375rem 0.75rem;
      background: oklch(96.7% 0.0029 264.5);
      border-bottom: 1px solid oklch(87.17% 0.0093 258.3);
    }
    .history-version-text {
      font-size: 0.9375rem;
      color: oklch(21.01% 0.0318 264.7);
      padding: 0.75rem;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.5;
    }
    .loading-text {
      font-size: 0.875rem;
      color: oklch(55.1% 0.0234 264.4);
      text-align: center;
      padding: 1rem 0;
    }
    @media (prefers-color-scheme: dark) {
      .history-meta {
        background: oklch(100% 0 none / 0.08);
        color: oklch(80% 0.02 264.4);
      }
      .history-version {
        border-color: oklch(100% 0 none / 0.1);
      }
      .history-version-header {
        background: oklch(100% 0 none / 0.06);
        border-bottom-color: oklch(100% 0 none / 0.1);
        color: oklch(70% 0.02 264.4);
      }
      .history-version-text {
        color: oklch(92% 0.01 264.7);
      }
      .loading-text {
        color: oklch(70% 0.02 264.4);
      }
    }
`;

function createCloseIcon(): SVGSVGElement {
  const icon = createSvgNode('svg', {
    viewBox: '0 0 24 24',
    class: 'size-5 fill-current',
    'aria-hidden': 'true',
  });
  icon.appendChild(
    createSvgNode('path', {
      d: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    }),
  );
  return icon;
}

function createHistoryMetaIcon(): SVGSVGElement {
  const icon = createSvgNode('svg', {
    fill: 'none',
    viewBox: '0 0 24 24',
    width: '16',
    height: '16',
    'aria-hidden': 'true',
  });
  icon.appendChild(
    createSvgNode('path', {
      fill: 'currentColor',
      'fill-rule': 'evenodd',
      'clip-rule': 'evenodd',
      d: 'M15.439 3.148a1 1 0 0 1 .41.645l.568 3.22a7 7 0 1 1-6.174 10.97L4.32 19.027a1 1 0 0 1-1.159-.811L1.078 6.398a1 1 0 0 1 .81-1.158l12.803-2.258a1 1 0 0 1 .748.166ZM9.325 16.114A7 7 0 0 1 9 14c0-1.56.51-3 1.372-4.164l-6.456 1.139 1.041 5.909 4.368-.77ZM3.568 9.005l10.833-1.91-.347-1.97L3.22 7.036l.347 1.97ZM16 9a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2a1 1 0 0 1 1 1v1.586l1.374 1.374a1 1 0 0 1-1.414 1.414l-1.667-1.667A1 1 0 0 1 15 14v-2a1 1 0 0 1 1-1Z',
    }),
  );
  return icon;
}

export class EditHistoryModal {
  public readonly element: HTMLElement;
  private versionsContainer: HTMLElement | null = null;
  private originalDateStrong: HTMLElement | null = null;
  private previouslyFocused: Element | null = null;
  private handleKeydownBound = this.handleKeydown.bind(this);
  private handleBackgroundClickBound = this.handleBackgroundClick.bind(this);
  private closeBound = this.close.bind(this);

  public constructor() {
    this.element = document.createElement('edit-history-modal');
    const shadow = this.element.attachShadow({ mode: 'open' });

    const container = document.createElement('div');
    container.className = 'edit-modal-container';
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-modal', 'true');
    container.setAttribute('aria-labelledby', 'history-modal-title');

    const header = document.createElement('div');
    header.className = 'edit-modal-header';
    const title = document.createElement('span');
    title.className = 'edit-modal-title';
    title.id = 'history-modal-title';
    title.textContent = 'This post was edited';
    const closeButton = document.createElement('button');
    closeButton.className = 'edit-modal-close close-button';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.appendChild(createCloseIcon());
    header.append(title, closeButton);

    const body = document.createElement('div');
    body.className = 'edit-modal-body';
    const historyMeta = document.createElement('div');
    historyMeta.className = 'history-meta';
    historyMeta.append(createHistoryMetaIcon());
    const historyDate = document.createElement('span');
    historyDate.className = 'history-original-date';
    historyDate.append('Originally posted on ');
    const strong = document.createElement('strong');
    historyDate.appendChild(strong);
    historyMeta.appendChild(historyDate);

    const explainer = document.createElement('p');
    explainer.className = 'loading-text';
    explainer.style.padding = '0';
    explainer.style.textAlign = 'left';
    explainer.textContent = 'Showing the original version saved by skeeditor before edits were applied.';

    const versionsContainer = document.createElement('div');
    versionsContainer.className = 'history-versions-container';
    const loadingText = document.createElement('div');
    loadingText.className = 'loading-text';
    loadingText.textContent = 'Loading edit history…';
    versionsContainer.appendChild(loadingText);
    body.append(historyMeta, explainer, versionsContainer);

    const footer = document.createElement('div');
    footer.className = 'edit-modal-footer';
    const closeFooterButton = document.createElement('button');
    closeFooterButton.className = 'edit-modal-btn edit-modal-btn-cancel close-footer-button';
    closeFooterButton.type = 'button';
    closeFooterButton.textContent = 'Close';
    footer.appendChild(closeFooterButton);

    container.append(header, body, footer);
    shadow.replaceChildren(createStyleElement(HISTORY_MODAL_STYLES), container);
    this.element.style.display = 'none';

    this.versionsContainer = versionsContainer;
    this.originalDateStrong = strong;

    closeButton?.addEventListener('click', this.closeBound);
    closeFooterButton?.addEventListener('click', this.closeBound);

    this.element.addEventListener('keydown', this.handleKeydownBound);
  }

  public open(originalDate: string): void {
    this.previouslyFocused = document.activeElement;

    if (!this.element.isConnected) {
      document.body.appendChild(this.element);
    }

    if (this.originalDateStrong) {
      this.originalDateStrong.textContent = originalDate;
    }

    this.setLoadingMessage('Loading edit history…');

    this.element.removeEventListener('click', this.handleBackgroundClickBound);
    this.element.addEventListener('click', this.handleBackgroundClickBound);
    this.element.style.display = 'flex';

    // Focus the close button for keyboard accessibility
    const closeBtn = this.element.shadowRoot?.querySelector<HTMLButtonElement>('.close-button');
    closeBtn?.focus();
  }

  public showVersions(versions: Array<{ text: string; editedAt: string }>): void {
    if (!this.versionsContainer) return;

    if (versions.length === 0) {
      this.setLoadingMessage('No edit history found.');
      return;
    }

    this.versionsContainer.replaceChildren();

    for (const [i, version] of versions.entries()) {
      const label =
        i === 0
          ? 'Original version'
          : `Version ${i + 1} — edited ${new Date(version.editedAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}`;

      const wrapper = document.createElement('div');
      wrapper.className = 'history-version';

      const header = document.createElement('div');
      header.className = 'history-version-header';
      header.textContent = label;

      const text = document.createElement('div');
      text.className = 'history-version-text';
      text.textContent = version.text;

      wrapper.append(header, text);
      this.versionsContainer.appendChild(wrapper);
    }
  }

  public showError(message: string): void {
    if (!this.versionsContainer) return;
    this.versionsContainer.replaceChildren();
    const container = document.createElement('div');
    container.className = 'loading-text';
    container.textContent = message;
    this.versionsContainer.appendChild(container);
  }

  public close(): void {
    this.element.style.display = 'none';
    if (this.element.isConnected) {
      document.body.removeChild(this.element);
    }
    this.element.removeEventListener('click', this.handleBackgroundClickBound);

    if (this.previouslyFocused instanceof HTMLElement) {
      this.previouslyFocused.focus();
    }
    this.previouslyFocused = null;
  }

  private setLoadingMessage(message: string): void {
    if (!this.versionsContainer) return;
    this.versionsContainer.replaceChildren();
    const container = document.createElement('div');
    container.className = 'loading-text';
    container.textContent = message;
    this.versionsContainer.appendChild(container);
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
    }
    event.stopPropagation();
  }

  private handleBackgroundClick(event: MouseEvent): void {
    const shadow = this.element.shadowRoot;
    if (!shadow) return;
    const container = shadow.querySelector('.edit-modal-container');
    if (container && !container.contains(event.composedPath()[0] as Node)) {
      this.close();
    }
  }
}
