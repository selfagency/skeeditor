import { describe, expect, it } from 'vitest';

import { EditHistoryModal } from '@src/content/edit-history-modal';

describe('edit-history-modal', () => {
  it('renders version text as plain text without injecting HTML', () => {
    const modal = new EditHistoryModal();
    modal.showVersions([
      {
        text: '<img src=x onerror=alert(1)>hello<script>alert(2)</script>',
        editedAt: new Date().toISOString(),
      },
    ]);

    const root = modal.element.shadowRoot;
    expect(root).toBeTruthy();

    const textNode = root!.querySelector('.history-version-text');
    expect(textNode?.textContent).toBe('<img src=x onerror=alert(1)>hello<script>alert(2)</script>');

    // Ensure malicious HTML is not interpreted as DOM elements.
    expect(root!.querySelector('.history-version-text img')).toBeNull();
    expect(root!.querySelector('.history-version-text script')).toBeNull();
  });
});
