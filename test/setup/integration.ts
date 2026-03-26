import { afterAll, afterEach, beforeAll } from 'vitest';

import { installBrowserApiMocks, resetBrowserApiMocks } from '../mocks/browser-apis';
import { server } from '../mocks/server';

installBrowserApiMocks();

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
  resetBrowserApiMocks();
});

afterAll(() => {
  server.close();
});
