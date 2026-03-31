import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('unused module cleanup', () => {
  it('removes modules that are not integrated into production paths', () => {
    expect(existsSync(resolve(repoRoot, 'src/shared/auth/app-password.ts'))).toBe(false);
    expect(existsSync(resolve(repoRoot, 'src/shared/auth/token-refresh.ts'))).toBe(false);
    expect(existsSync(resolve(repoRoot, 'src/shared/utils/facet-offsets.ts'))).toBe(false);
    expect(existsSync(resolve(repoRoot, 'src/content/post-badges.ts'))).toBe(false);
  });

  it('removes stale developer docs references to removed modules', () => {
    const devAuth = readRepoFile('docs/dev/auth.md');
    const projectStructure = readRepoFile('docs/dev/project-structure.md');

    expect(devAuth).not.toContain('src/shared/auth/app-password.ts');
    expect(devAuth).not.toContain('src/shared/auth/token-refresh.ts');
    expect(projectStructure).not.toContain('post-badges.ts');
    expect(projectStructure).not.toContain('facet-offsets.ts');
  });
});
