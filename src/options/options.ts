import { EDIT_TIME_LIMIT_MAX, EDIT_TIME_LIMIT_MIN } from '../shared/constants';
import { sendMessage } from '../shared/messages';

const status = document.querySelector<HTMLParagraphElement>('#status');
const pdsUrlInput = document.querySelector<HTMLInputElement>('#pds-url');
const editTimeLimitInput = document.querySelector<HTMLInputElement>('#edit-time-limit');
const saveButton = document.querySelector<HTMLButtonElement>('#save-settings');

if (status) {
  status.textContent = '';
}

async function loadCurrentPdsUrl(): Promise<void> {
  if (!pdsUrlInput) return;

  try {
    const response = await sendMessage({ type: 'GET_PDS_URL' });
    if ('url' in response) {
      pdsUrlInput.value = response.url;
      if (status) {
        status.textContent = `Current PDS: ${response.url}`;
        status.className = 'mb-6 text-sm text-green-400';
      }
    } else {
      if (status) {
        status.textContent = 'Failed to load current PDS URL';
        status.className = 'mb-6 text-sm text-red-400';
      }
    }
  } catch (error) {
    console.error('Error loading PDS URL:', error);
    if (status) {
      status.textContent = 'Error loading PDS URL';
      status.className = 'mb-6 text-sm text-red-400';
    }
  }
}

async function loadCurrentSettings(): Promise<void> {
  if (!editTimeLimitInput) return;

  try {
    const response = await sendMessage({ type: 'GET_SETTINGS' });
    if (!('error' in response)) {
      editTimeLimitInput.value = response.editTimeLimit === null ? '' : String(response.editTimeLimit);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function saveSettings(): Promise<void> {
  if (!pdsUrlInput || !editTimeLimitInput || !saveButton) return;

  const newUrl = pdsUrlInput.value.trim();
  const rawEditTimeLimit = editTimeLimitInput.value.trim();
  if (!newUrl || !newUrl.startsWith('https://')) {
    if (status) {
      status.textContent = 'Please enter a valid HTTPS URL';
      status.className = 'mb-6 text-sm text-red-400';
    }
    return;
  }

  const editTimeLimit = rawEditTimeLimit.length === 0 ? null : Number.parseFloat(rawEditTimeLimit);

  if (
    editTimeLimit !== null &&
    (!Number.isFinite(editTimeLimit) || editTimeLimit < EDIT_TIME_LIMIT_MIN || editTimeLimit > EDIT_TIME_LIMIT_MAX)
  ) {
    if (status) {
      status.textContent = `Edit time limit must be between ${EDIT_TIME_LIMIT_MIN} and ${EDIT_TIME_LIMIT_MAX} minutes, or left blank to disable.`;
      status.className = 'mb-6 text-sm text-red-400';
    }
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = 'Saving...';

  try {
    const pdsResponse = await sendMessage({ type: 'SET_PDS_URL', url: newUrl });
    if (!('ok' in pdsResponse && pdsResponse.ok)) {
      if (status) {
        status.textContent = ('error' in pdsResponse ? pdsResponse.error : null) ?? 'Failed to update PDS URL';
        status.className = 'mb-6 text-sm text-red-400';
      }
      return;
    }

    const settingsResponse = await sendMessage({ type: 'SET_SETTINGS', settings: { editTimeLimit } });
    if (!('ok' in settingsResponse && settingsResponse.ok)) {
      if (status) {
        status.textContent =
          ('error' in settingsResponse ? settingsResponse.error : null) ?? 'Failed to update settings';
        status.className = 'mb-6 text-sm text-red-400';
      }
      return;
    }

    if (status) {
      status.textContent =
        editTimeLimit === null
          ? `Settings saved. PDS URL updated to: ${newUrl}. Edit time limit disabled.`
          : `Settings saved. PDS URL updated to: ${newUrl}. Edit time limit: ${editTimeLimit} minutes.`;
      status.className = 'mb-6 text-sm text-green-400';
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    if (status) {
      status.textContent = 'Error saving settings';
      status.className = 'mb-6 text-sm text-red-400';
    }
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Save Settings';
  }
}

// Initialize the options page
if (pdsUrlInput && editTimeLimitInput && saveButton) {
  pdsUrlInput.placeholder = 'https://bsky.social';
  editTimeLimitInput.min = String(EDIT_TIME_LIMIT_MIN);
  editTimeLimitInput.max = String(EDIT_TIME_LIMIT_MAX);
  editTimeLimitInput.step = '0.5';
  saveButton.addEventListener('click', saveSettings);

  // Load current PDS URL when page loads
  loadCurrentPdsUrl();
  loadCurrentSettings();
}
