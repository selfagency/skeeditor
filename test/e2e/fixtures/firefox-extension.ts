import { test as base, expect } from '@playwright/test';

const firefoxExtensionE2EEnabled = process.env.FIREFOX_EXTENSION_E2E === '1';

export const test = base;

export const skipIfFirefoxExtensionDisabled = (): void => {
  test.skip(
    !firefoxExtensionE2EEnabled,
    'Firefox extension loading scaffold requires FIREFOX_EXTENSION_E2E=1 and web-ext-backed launch wiring.',
  );
};

export { expect };
