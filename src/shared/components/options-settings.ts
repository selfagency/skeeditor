import { EDIT_TIME_LIMIT_MAX, EDIT_TIME_LIMIT_MIN, EDIT_TIME_LIMIT_OPTIONS } from '../constants';
import { sendMessage } from '../messages';
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
    const editTimeLimitOptions = EDIT_TIME_LIMIT_OPTIONS.map(
      value => `<option value="${value}">${formatEditTimeLimitLabel(value)}</option>`,
    ).join('');

    this.root.innerHTML = `
      <style>
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
      </style>
      <div class="card">
        <div class="card-header"><h2>Extension Settings</h2></div>
        <div class="card-body">
          <div>
            <label for="edit-time-limit">Edit time limit</label>
            <select id="edit-time-limit">
              <option value="">No limit</option>
              ${editTimeLimitOptions}
            </select>
          </div>
          <p class="hint">
            When set, posts older than the selected window cannot be edited.
          </p>

          <div>
            <label for="save-strategy">How Skeeditor saves an edit</label>
            <select id="save-strategy">
              <option value="recreate">Recreate record atomically</option>
              <option value="edit">Edit record in place</option>
            </select>
          </div>
          <p class="hint">
            <strong>Recreate record</strong> is the recommended default because it performs an atomic
            delete-and-create at the same record key with a fresh <code>createdAt</code>, which is what
            reliably makes Bluesky/AppView surface the change across clients. This also means the recreated
            post loses its existing likes and reposts. <strong>Edit record</strong>
            keeps the existing record identity and preserves the original post timestamp, but Bluesky may
            not visibly refresh its cached view. Skeeditor users and other appviews that do not rely on
            Bluesky's cache can still see the changed text sooner.
          </p>

          <div>
            <button class="save-btn" id="save-settings" type="button">Save Settings</button>
          </div>
        </div>
      </div>
    `;

    this.editTimeLimitSelect = this.root.getElementById('edit-time-limit') as HTMLSelectElement;
    this.saveStrategySelect = this.root.getElementById('save-strategy') as HTMLSelectElement;
    this.saveButton = this.root.getElementById('save-settings') as HTMLButtonElement;
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
