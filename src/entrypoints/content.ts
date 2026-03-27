import { defineContentScript } from 'wxt/utils/define-content-script';
import { start } from '../content/content-script';

export default defineContentScript({
  matches: ['https://bsky.app/*'],
  runAt: 'document_idle',
  main() {
    start();
  },
});
