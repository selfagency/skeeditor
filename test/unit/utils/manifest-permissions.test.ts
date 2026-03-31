import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('manifest permission least-privilege audit', () => {
  it('keeps only runtime permissions used by the extension', () => {
    const wxtConfig = readRepoFile('wxt.config.ts');

    expect(wxtConfig).toContain("permissions: ['storage', 'tabs', 'alarms']");
    expect(wxtConfig).not.toContain('activeTab');
  });

  it('documents retained runtime permissions without activeTab', () => {
    const authDoc = readRepoFile('docs/auth.md');
    const buildDoc = readRepoFile('docs/dev/build.md');
    const devPlatformDoc = readRepoFile('docs/dev/platform.md');
    const installationGuide = readRepoFile('docs/guide/installation.md');

    expect(authDoc).toContain('(`storage`, `tabs`, `alarms`)');
    expect(authDoc).not.toContain('activeTab');

    expect(buildDoc).toContain("permissions: ['storage', 'tabs', 'alarms']");
    expect(buildDoc).not.toContain('activeTab');

    expect(devPlatformDoc).toContain("permissions: ['storage', 'tabs', 'alarms']");
    expect(devPlatformDoc).not.toContain('activeTab');

    expect(installationGuide).toContain('- `storage`');
    expect(installationGuide).toContain('- `tabs`');
    expect(installationGuide).toContain('- `alarms`');
    expect(installationGuide).not.toContain('activeTab');
  });
});
