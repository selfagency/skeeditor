/**
 * test/e2e/setup/devnet-global-setup.ts
 *
 * Playwright globalSetup for the devnet E2E projects.
 *
 * Reads `devnet/data/accounts.env` produced by the atproto-devnet init
 * container and exports PDS URL + account credentials as process.env
 * variables that fixture files and tests can access.
 *
 * Requires the devnet stack to already be running:
 *   pnpm devnet:up   (or scripts/devnet-up.sh)
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ACCOUNTS_ENV_PATH = resolve(process.cwd(), 'devnet', 'data', 'accounts.env');

/**
 * Parse a dotenv-style file (KEY=value, one per line, no quoting) into a map.
 * Lines starting with # or empty lines are ignored.
 */
function parseDotenv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    result[key] = value;
  }
  return result;
}

export default async function devnetGlobalSetup(): Promise<void> {
  let envContent: string;

  try {
    envContent = await readFile(ACCOUNTS_ENV_PATH, 'utf8');
  } catch {
    // Devnet is not running — skip silently so non-devnet test runs are unaffected.
    // Devnet-specific tests will fail on their own if the stack is unavailable.
    console.warn(`[devnet] accounts.env not found at ${ACCOUNTS_ENV_PATH} — devnet env skipped.`);
    return;
  }

  const env = parseDotenv(envContent);

  // PDS base URL — use DEVNET_PDS_PORT env var to match docker-compose default
  const pdsPort = process.env['DEVNET_PDS_PORT'] ?? '3000';
  process.env['DEVNET_PDS_URL'] = `http://localhost:${pdsPort}`;

  // Alice credentials
  process.env['DEVNET_ALICE_HANDLE'] = env['ALICE_HANDLE'] ?? 'alice.devnet.test';
  process.env['DEVNET_ALICE_DID'] = env['ALICE_DID'] ?? '';
  process.env['DEVNET_ALICE_PASSWORD'] = env['ALICE_PASSWORD'] ?? 'alice-devnet-pass';

  // Bob credentials
  process.env['DEVNET_BOB_HANDLE'] = env['BOB_HANDLE'] ?? 'bob.devnet.test';
  process.env['DEVNET_BOB_DID'] = env['BOB_DID'] ?? '';
  process.env['DEVNET_BOB_PASSWORD'] = env['BOB_PASSWORD'] ?? 'bob-devnet-pass';

  console.log(`[devnet] PDS URL: ${process.env['DEVNET_PDS_URL']}`);
  console.log(`[devnet] Alice: ${process.env['DEVNET_ALICE_HANDLE']} (${process.env['DEVNET_ALICE_DID']})`);
  console.log(`[devnet] Bob:   ${process.env['DEVNET_BOB_HANDLE']} (${process.env['DEVNET_BOB_DID']}`);
}
