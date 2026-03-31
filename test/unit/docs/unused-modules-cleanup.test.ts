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
    const userAuth = readRepoFile('docs/auth.md');
    const devArchitecture = readRepoFile('docs/dev/architecture.md');
    const devFacets = readRepoFile('docs/dev/facets.md');

    // Ensure no doc points to removed auth modules
    expect(devAuth).not.toContain('src/shared/auth/app-password.ts');
    expect(devAuth).not.toContain('src/shared/auth/token-refresh.ts');
    expect(userAuth).not.toContain('src/shared/auth/app-password.ts');
    expect(userAuth).not.toContain('src/shared/auth/token-refresh.ts');

    // Ensure no doc points to removed content/utils modules
    expect(projectStructure).not.toContain('post-badges.ts');
    expect(projectStructure).not.toContain('facet-offsets.ts');
    expect(devArchitecture).not.toContain('post-badges.ts');
    expect(devArchitecture).not.toContain('facet-offsets.ts');
    expect(devFacets).not.toContain('post-badges.ts');
    expect(devFacets).not.toContain('facet-offsets.ts');
  });
});
