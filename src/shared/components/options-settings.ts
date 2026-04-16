import { EDIT_TIME_LIMIT_MAX, EDIT_TIME_LIMIT_MIN, EDIT_TIME_LIMIT_OPTIONS } from '../constants';
import { sendMessage } from '../messages';
import { createStyleElement } from '../utils/dom';
import { showOptionsToast } from './options-toast';

const formatEditTimeLimitLabel = (minutes: number): string => {
  if (minutes === 0.5) return '30 seconds';
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
};

export class OptionsSettings extends HTMLElement {
  private readonly root: ShadowRoot;
  private editTimeLimitSelect: HTMLSelectElement | null = null;
  private saveStrategySelect: HTMLSelectElement | null = null;
  private saveButton: HTMLButtonElement | null = null;

  public constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  public connectedCallback(): void {
    this.render();
    this.attachHandlers();
    void this.loadSettings();
  }

  private render(): void {
    const card = document.createElement('div');
    card.className = 'card';

    const header = document.createElement('div');
    header.className = 'card-header';
    const title = document.createElement('h2');
    title.textContent = 'Extension Settings';
    header.appendChild(title);

    const body = document.createElement('div');
    body.className = 'card-body';

    const editTimeLimitSection = document.createElement('div');
    const editTimeLimitLabel = document.createElement('label');
    editTimeLimitLabel.htmlFor = 'edit-time-limit';
    editTimeLimitLabel.textContent = 'Edit time limit';
    const editTimeLimitSelect = document.createElement('select');
    editTimeLimitSelect.id = 'edit-time-limit';
    const noLimitOption = document.createElement('option');
    noLimitOption.value = '';
    noLimitOption.textContent = 'No limit';
    editTimeLimitSelect.appendChild(noLimitOption);
    for (const value of EDIT_TIME_LIMIT_OPTIONS) {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = formatEditTimeLimitLabel(value);
      editTimeLimitSelect.appendChild(option);
    }
    editTimeLimitSection.append(editTimeLimitLabel, editTimeLimitSelect);

    const editTimeLimitHint = document.createElement('p');
    editTimeLimitHint.className = 'hint';
    editTimeLimitHint.textContent = 'When set, posts older than the selected window cannot be edited.';

    const saveStrategySection = document.createElement('div');
    const saveStrategyLabel = document.createElement('label');
    saveStrategyLabel.htmlFor = 'save-strategy';
    saveStrategyLabel.textContent = 'How Skeeditor saves an edit';
    const saveStrategySelect = document.createElement('select');
    saveStrategySelect.id = 'save-strategy';
    for (const [value, label] of [
      ['recreate', 'Recreate record atomically'],
      ['edit', 'Edit record in place'],
    ] as const) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      saveStrategySelect.appendChild(option);
    }
    saveStrategySection.append(saveStrategyLabel, saveStrategySelect);

    const saveStrategyHint = document.createElement('p');
    saveStrategyHint.className = 'hint';
    const recreateStrong = document.createElement('strong');
    recreateStrong.textContent = 'Recreate record';
    const createdAtCode = document.createElement('code');
    createdAtCode.textContent = 'createdAt';
    const editStrong = document.createElement('strong');
    editStrong.textContent = 'Edit record';
    saveStrategyHint.append(
      recreateStrong,
      ' is the recommended default because it performs an atomic delete-and-create at the same record key with a fresh ',
      createdAtCode,
      ', which is what reliably makes Bluesky/AppView surface the change across clients. This also means the recreated post loses its existing likes and reposts. ',
      editStrong,
      " keeps the existing record identity and preserves the original post timestamp, but Bluesky may not visibly refresh its cached view. Skeeditor users and other appviews that do not rely on Bluesky's cache can still see the changed text sooner.",
    );

    const buttonRow = document.createElement('div');
    const saveButton = document.createElement('button');
    saveButton.className = 'save-btn';
    saveButton.id = 'save-settings';
    saveButton.type = 'button';
    saveButton.textContent = 'Save Settings';
    buttonRow.appendChild(saveButton);

    body.append(editTimeLimitSection, editTimeLimitHint, saveStrategySection, saveStrategyHint, buttonRow);
    card.append(header, body);

    this.root.replaceChildren(
      createStyleElement(`
        :host { display: block; }
        .card {
          overflow: hidden;
          border-radius: var(--radius-card);
          border: 1px solid var(--color-border);
          background: var(--color-surface-raised);
          box-shadow: 0 1px 2px 0 oklch(0% 0 none / 0.05);
        }
        .card-header {
          padding: 1.25rem 1.25rem;
          border-bottom: 1px solid var(--color-border);
        }
        .card-header h2 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }
        .card-body {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-primary);
        }
        select {
          display: block; width: 100%; margin-top: 0.5rem; box-sizing: border-box;
          border-radius: var(--radius-control); padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: var(--color-input-text);
          background: var(--color-input-bg);
          border: 1px solid var(--color-input-border);
          outline: none;
        }
        select:focus {
          border-color: var(--color-input-focus);
          box-shadow: 0 0 0 1px var(--color-input-focus);
        }
        select option { background: var(--color-surface); color: var(--color-input-text); }
        .hint { margin: 0; font-size: 0.875rem; color: var(--color-text-secondary); }
        button.save-btn {
          align-self: flex-start;
          border-radius: var(--radius-control); padding: 0.5rem 0.875rem;
          font-size: 0.875rem; font-weight: 600; cursor: pointer;
          color: var(--color-primary-text);
          background: var(--color-primary);
          border: none;
          box-shadow: 0 1px 2px 0 oklch(0% 0 none / 0.05);
        }
        button.save-btn:hover { background: var(--color-primary-hover); }
        button.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `),
      card,
    );

    this.editTimeLimitSelect = editTimeLimitSelect;
    this.saveStrategySelect = saveStrategySelect;
    this.saveButton = saveButton;
  }

  private attachHandlers(): void {
    this.saveButton?.addEventListener('click', () => void this.saveSettings());
  }

  private async loadSettings(): Promise<void> {
    if (!this.editTimeLimitSelect || !this.saveStrategySelect) return;
    try {
      const response = await sendMessage({ type: 'GET_SETTINGS' });
      if (!('error' in response)) {
        this.editTimeLimitSelect.value = response.editTimeLimit === null ? '' : String(response.editTimeLimit);
        this.saveStrategySelect.value = response.saveStrategy;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  private async saveSettings(): Promise<void> {
    if (!this.editTimeLimitSelect || !this.saveStrategySelect || !this.saveButton) return;

    const saveStrategy = this.saveStrategySelect.value === 'recreate' ? 'recreate' : 'edit';
    const rawEditTimeLimit = this.editTimeLimitSelect.value.trim();
    const editTimeLimit = rawEditTimeLimit.length === 0 ? null : Number.parseFloat(rawEditTimeLimit);

    if (
      editTimeLimit !== null &&
      (!Number.isFinite(editTimeLimit) || editTimeLimit < EDIT_TIME_LIMIT_MIN || editTimeLimit > EDIT_TIME_LIMIT_MAX)
    ) {
      this.emitStatus(
        `Edit time limit must be between ${EDIT_TIME_LIMIT_MIN} and ${EDIT_TIME_LIMIT_MAX} minutes, or left blank to disable.`,
        'error',
      );
      return;
    }

    this.saveButton.disabled = true;
    this.saveButton.textContent = 'Saving…';

    try {
      const response = await sendMessage({ type: 'SET_SETTINGS', settings: { editTimeLimit, saveStrategy } });
      if (!('ok' in response && response.ok)) {
        this.emitStatus(('error' in response ? response.error : null) ?? 'Failed to save settings.', 'error');
        return;
      }
      const saveStrategyLabel = saveStrategy === 'recreate' ? 'Recreate record' : 'Edit record';
      this.emitStatus(
        editTimeLimit === null
          ? `Settings saved. Edit time limit disabled. Save strategy: ${saveStrategyLabel}.`
          : `Settings saved. Edit time limit: ${formatEditTimeLimitLabel(editTimeLimit)}. Save strategy: ${saveStrategyLabel}.`,
        'success',
      );
    } catch (error) {
      console.error('Error saving settings:', error);
      this.emitStatus('Error saving settings.', 'error');
    } finally {
      this.saveButton.disabled = false;
      this.saveButton.textContent = 'Save Settings';
    }
  }

  private emitStatus(message: string, type: 'info' | 'success' | 'error'): void {
    showOptionsToast(message, type);
    this.dispatchEvent(
      new CustomEvent('status-update', {
        detail: { message, type },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

if (!customElements.get('options-settings')) {
  customElements.define('options-settings', OptionsSettings);
}
