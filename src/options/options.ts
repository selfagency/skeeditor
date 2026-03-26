import { sendMessage } from '../shared/messages';

const status = document.querySelector<HTMLParagraphElement>('#status');
const pdsUrlInput = document.querySelector<HTMLInputElement>('#pds-url');
const saveButton = document.querySelector<HTMLButtonElement>('#save-pds-url');

if (status) {
  status.textContent = 'Options entry loaded.';
}

async function loadCurrentPdsUrl(): Promise<void> {
  if (!pdsUrlInput) return;

  try {
    const response = await sendMessage({ type: 'GET_PDS_URL' });
    if ('url' in response) {
      pdsUrlInput.value = response.url;
      if (status) {
        status.textContent = `Current PDS: ${response.url}`;
        status.className = 'status success';
      }
    } else {
      if (status) {
        status.textContent = 'Failed to load current PDS URL';
        status.className = 'status error';
      }
    }
  } catch (error) {
    console.error('Error loading PDS URL:', error);
    if (status) {
      status.textContent = 'Error loading PDS URL';
      status.className = 'status error';
    }
  }
}

async function savePdsUrl(): Promise<void> {
  if (!pdsUrlInput || !saveButton) return;

  const newUrl = pdsUrlInput.value.trim();
  if (!newUrl || !newUrl.startsWith('https://')) {
    if (status) {
      status.textContent = 'Please enter a valid HTTPS URL';
      status.className = 'status error';
    }
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = 'Saving...';

  try {
    const response = await sendMessage({ type: 'SET_PDS_URL', url: newUrl });
    if ('ok' in response && response.ok) {
      if (status) {
        status.textContent = `PDS URL updated to: ${newUrl}`;
        status.className = 'status success';
      }
    } else {
      if (status) {
        status.textContent = response.error || 'Failed to update PDS URL';
        status.className = 'status error';
      }
    }
  } catch (error) {
    console.error('Error saving PDS URL:', error);
    if (status) {
      status.textContent = 'Error saving PDS URL';
      status.className = 'status error';
    }
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Save PDS URL';
  }
}

// Initialize the options page
if (pdsUrlInput && saveButton) {
  pdsUrlInput.placeholder = 'https://bsky.social';
  saveButton.addEventListener('click', savePdsUrl);

  // Load current PDS URL when page loads
  loadCurrentPdsUrl();
}
