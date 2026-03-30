import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../../..');

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('coverage CI configuration', () => {
  it('defines a CI-focused coverage task that emits JUnit output', () => {
    const taskfile = readRepoFile('Taskfile.yml');

    expect(taskfile).toContain('test:coverage:ci:');
    expect(taskfile).toContain('--coverage');
    expect(taskfile).toContain('--reporter=junit');
    expect(taskfile).toContain('--outputFile=test-report.junit.xml');
  });

  it('uploads coverage and test results to Codecov in CI', () => {
    const ciWorkflow = readRepoFile('.github/workflows/ci.yml');

    expect(ciWorkflow).toContain('codecov/codecov-action@v5');
    expect(ciWorkflow).toContain('codecov/test-results-action@v1');
    expect(ciWorkflow).toContain('CODECOV_TOKEN');
    expect(ciWorkflow).toContain('test-report.junit.xml');
  });
});
