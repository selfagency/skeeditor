import '../../global.css';
import '../../shared/components/options-status';
import '../../shared/components/options-accounts';
import '../../shared/components/options-settings';
import type { OptionsStatus } from '../../shared/components/options-status';

// Route status-update events from child components to <options-status>
document.addEventListener('status-update', (event: Event) => {
  const { message, type } = (event as CustomEvent<{ message: string; type: 'info' | 'success' | 'error' }>).detail;
  const statusEl = document.querySelector<OptionsStatus>('options-status');
  statusEl?.setStatus(message, type);
});
