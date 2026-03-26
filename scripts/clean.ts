import { rm } from 'node:fs/promises';

const CLEAN_TARGETS = ['coverage', 'dist', 'playwright-report', 'test-results'];

const main = async (): Promise<void> => {
  const results = await Promise.allSettled(CLEAN_TARGETS.map(path => rm(path, { force: true, recursive: true })));

  let failed = false;
  for (const [i, result] of results.entries()) {
    if (result.status === 'rejected') {
      console.error(`Failed to remove "${CLEAN_TARGETS[i]}":`, (result as PromiseRejectedResult).reason);
      failed = true;
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
