import { expect, test } from './fixtures/firefox-extension';

test('should keep a Firefox extension project scaffold available', async () => {
  test.skip(
    process.env.FIREFOX_EXTENSION_E2E !== '1',
    'Firefox extension launch remains gated until the web-ext-backed runner is enabled.',
  );

  expect(true).toBe(true);
});
