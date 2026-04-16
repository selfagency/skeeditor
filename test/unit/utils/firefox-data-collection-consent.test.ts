import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('Firefox data collection consent metadata', () => {
  it('declares required Firefox data collection permissions in WXT config', () => {
    const wxtConfig = readRepoFile('wxt.config.ts');

    expect(wxtConfig).toContain('data_collection_permissions');
    expect(wxtConfig).toContain("strict_min_version: '140.0'");
    expect(wxtConfig).toContain('gecko_android: {');
    expect(wxtConfig).toContain("strict_min_version: '142.0'");
    expect(wxtConfig).toContain("required: ['authenticationInfo', 'personalCommunications']");
  });

  it('documents the Firefox consent categories in build and privacy docs', () => {
    const buildDoc = readRepoFile('docs/dev/build.md');
    const platformDoc = readRepoFile('docs/dev/platform.md');
    const privacyDoc = readRepoFile('docs/guide/privacy.md');
    const releasingDoc = readRepoFile('docs/dev/releasing.md');

    expect(buildDoc).toContain('data_collection_permissions');
    expect(platformDoc).toContain('data_collection_permissions');
    expect(privacyDoc).toContain('authenticationInfo');
    expect(privacyDoc).toContain('personalCommunications');
    expect(releasingDoc).toContain('browser_specific_settings.gecko.data_collection_permissions');
  });
});
