import 'webextension-polyfill';

const status = document.querySelector<HTMLParagraphElement>('#status');

if (status) {
  status.textContent = 'Options entry loaded.';
}
