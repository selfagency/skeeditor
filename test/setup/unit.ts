import { afterEach } from 'vitest';

import { installBrowserApiMocks, resetBrowserApiMocks } from '../mocks/browser-apis';

installBrowserApiMocks();

afterEach(() => {
  resetBrowserApiMocks();
  document.body.innerHTML = '';
});
