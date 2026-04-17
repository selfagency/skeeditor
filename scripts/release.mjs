#!/usr/bin/env node

import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** 1Password item ID for the Chrome extension RSA signing key. */
const OP_CHROME_SIGNING_ITEM_ID = 'k2e6zzyibs5elf67v7pptdwa24';

/** Flag names whose immediately-following argument must not appear in logs. */
const SENSITIVE_FLAGS = new Set(['--api-key', '--api-secret', '--client-secret', '--refresh-token']);

/** @param {string[]} args */
function redactArgs(args) {
  return args.map((arg, i) => (i > 0 && SENSITIVE_FLAGS.has(args[i - 1] ?? '') ? '[REDACTED]' : arg));
}

/** @typedef {{
 * dryRun: boolean;
 * publishChrome: boolean;
 * publishFirefox: boolean;
 * publishEdge: boolean;
 * skipChecks: boolean;
 * skipTests: boolean;
 * skipSafari: boolean;
 * skipChromePublish: boolean;
 * preBuilt: boolean;
 * artifactsDir: string;
 * versionOverride?: string;
 * }} ReleaseOptions */

/** @type {ReleaseOptions} */
const options = {
  dryRun: false,
  publishChrome: false,
  publishFirefox: false,
  publishEdge: false,
  skipChecks: false,
  skipTests: false,
  skipSafari: false,
  skipChromePublish: false,
  preBuilt: false,
  artifactsDir: 'release-artifacts',
};

for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg) continue;
  if (arg === '--dry-run') options.dryRun = true;
  else if (arg === '--publish-chrome') options.publishChrome = true;
  else if (arg === '--publish-firefox') options.publishFirefox = true;
  else if (arg === '--publish-edge') options.publishEdge = true;
  else if (arg === '--skip-checks') options.skipChecks = true;
  else if (arg === '--skip-tests') options.skipTests = true;
  else if (arg === '--skip-safari') options.skipSafari = true;
  else if (arg === '--skip-chrome-publish') options.skipChromePublish = true;
  else if (arg === '--pre-built') options.preBuilt = true;
  else if (arg === '--artifacts-dir') {
    const next = process.argv[i + 1];
    if (!next) throw new Error('--artifacts-dir requires a value');
    options.artifactsDir = next;
    i += 1;
  } else if (arg === '--version') {
    const next = process.argv[i + 1];
    if (!next) throw new Error('--version requires a value');
    options.versionOverride = next;
    i += 1;
  } else {
    throw new Error(`Unknown argument: ${arg}`);
  }
}

const rootDir = process.cwd();
const artifactsDir = resolve(rootDir, options.artifactsDir);

const taskExecutable =
  process.platform === 'win32'
    ? resolve(rootDir, 'node_modules/.bin/task.cmd')
    : resolve(rootDir, 'node_modules/.bin/task');

function logStep(message) {
  process.stdout.write(`\n[release] ${message}\n`);
}

/** @returns {Promise<void>} */
function run(command, args, extraEnv = {}) {
  process.stdout.write(`[run] ${command} ${redactArgs(args).join(' ')}\n`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: { ...process.env, ...extraEnv },
      stdio: 'inherit',
    });
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Command exited with code ${code}: ${command} ${redactArgs(args).join(' ')}`));
    });
    child.on('error', reject);
  });
}

async function runTask(taskName, args = [], extraEnv = {}) {
  const taskPath = await stat(taskExecutable)
    .then(() => taskExecutable)
    .catch(() => 'task');
  await run(taskPath, [taskName, ...args], extraEnv);
}

/**
 * Retrieves the Chrome extension RSA private key PEM.
 * Supports two methods in order of precedence:
 * 1. CHROME_SIGNING_KEY_PATH: path to a .pem file
 * 2. CHROME_SIGNING_KEY_PEM: base64-encoded PEM content
 * 3. 1Password CLI: run `op item get k2e6zzyibs5elf67v7pptdwa24 --fields notesPlain`
 * @returns {Promise<string>} PEM-encoded RSA private key
 */
async function fetchChromeSigningKey() {
  /** @param {string} raw */
  const normalizePem = raw => {
    const trimmed = raw.trim();

    // Some `op item get ... --fields notesPlain` outputs can be JSON-quoted,
    // e.g. "-----BEGIN...\\n...". Parse/unquote when possible.
    let unquoted = trimmed;
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'string') {
          unquoted = parsed;
        }
      } catch {
        unquoted = trimmed.slice(1, -1);
      }
    }

    // Handle escaped newlines from quoted outputs.
    const normalized = unquoted.includes('\n') ? unquoted.replace(/\\n/g, '\n') : unquoted;
    return normalized.trim();
  };

  // Method 1: Direct file path
  if (process.env['CHROME_SIGNING_KEY_PATH']) {
    const pemPath = process.env['CHROME_SIGNING_KEY_PATH'];
    try {
      return normalizePem(await readFile(pemPath, 'utf8'));
    } catch (err) {
      throw new Error(`Failed to read CHROME_SIGNING_KEY_PATH: ${pemPath}\n${err.message}`);
    }
  }

  // Method 2: Base64-encoded PEM
  if (process.env['CHROME_SIGNING_KEY_PEM']) {
    try {
      return normalizePem(Buffer.from(process.env['CHROME_SIGNING_KEY_PEM'], 'base64').toString('utf8'));
    } catch (err) {
      throw new Error(`Failed to decode CHROME_SIGNING_KEY_PEM from base64\n${err.message}`);
    }
  }

  // Method 3: 1Password CLI
  try {
    const { stdout } = await execFileAsync('op', ['item', 'get', OP_CHROME_SIGNING_ITEM_ID, '--fields', 'notesPlain']);
    return normalizePem(stdout);
  } catch (err) {
    throw new Error(
      `Failed to retrieve Chrome signing key from 1Password CLI:\n${err.message}\n\n` +
        'Provide one of:\n' +
        '  1. CHROME_SIGNING_KEY_PATH=/path/to/key.pem\n' +
        '  2. CHROME_SIGNING_KEY_PEM=<base64-encoded-pem>\n' +
        '  3. Install 1Password CLI (op) and run: op signin',
    );
  }
}

/**
 * Packs dist/chrome as a signed CRX using the Chrome binary and the provided PEM key.
 * @param {string} version - Release version string used to name the output file
 * @param {string} pemContent - RSA private key in PEM format
 * @returns {Promise<string>} Absolute path to the generated .crx artifact
 */
async function packAsCrx(version, pemContent) {
  const extDir = resolve(rootDir, 'dist/chrome');

  // Verify the extension directory exists
  try {
    await stat(extDir);
  } catch {
    throw new Error(`Extension directory not found: ${extDir}\nEnsure 'task build:chrome' completed successfully.`);
  }

  const chromeBin = process.env['CHROME_EXECUTABLE'] ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  const tmpDir = await mkdtemp(join(tmpdir(), 'skeeditor-crx-'));
  const pemPath = join(tmpDir, 'key.pem');
  try {
    await writeFile(pemPath, pemContent, { mode: 0o600 });

    await execFileAsync(chromeBin, [`--pack-extension=${extDir}`, `--pack-extension-key=${pemPath}`]);

    // Chrome outputs dist/chrome.crx as a sibling to the dist/chrome directory
    const generatedCrx = resolve(rootDir, 'dist/chrome.crx');
    const outputCrx = join(artifactsDir, `skeeditor-${version}-chrome.crx`);
    await writeFile(outputCrx, await readFile(generatedCrx));
    await rm(generatedCrx, { force: true });

    return outputCrx;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function zipDir(inputDir, outputZip) {
  await rm(outputZip, { force: true });
  await execFileAsync('zip', ['-r', outputZip, '.'], {
    cwd: inputDir,
    env: process.env,
  });
}

async function fileSha256(filePath) {
  return new Promise((resolveSha, rejectSha) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', rejectSha);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolveSha(hash.digest('hex')));
  });
}

async function buildArtifacts(version) {
  if (options.preBuilt) {
    logStep('Using pre-built browser targets (--pre-built)');
  } else {
    logStep('Building browser targets');
    await runTask('build:chrome');
    await runTask('build:firefox');
    if (!options.skipSafari) {
      await runTask('build:safari');
    }
  }

  await runTask('webext:lint:firefox');

  logStep('Packaging release artifacts');
  await mkdir(artifactsDir, { recursive: true });

  const chromeZip = join(artifactsDir, `skeeditor-${version}-chrome.zip`);
  const firefoxZip = join(artifactsDir, `skeeditor-${version}-firefox.zip`);
  const edgeZip = join(artifactsDir, `skeeditor-${version}-edge.zip`);

  await zipDir(resolve(rootDir, 'dist/chrome'), chromeZip);
  await zipDir(resolve(rootDir, 'dist/firefox'), firefoxZip);
  await writeFile(edgeZip, await readFile(chromeZip));

  // Sign Chrome extension as CRX (required for Chrome Web Store protected updates)
  let chromeCrx = null;
  if (!options.dryRun && (options.publishChrome || options.skipChromePublish)) {
    logStep('Signing Chrome extension as CRX');
    const pemContent = await fetchChromeSigningKey();
    chromeCrx = await packAsCrx(version, pemContent);
  }

  const artifacts = [chromeZip, firefoxZip, edgeZip, ...(chromeCrx ? [chromeCrx] : [])];
  const manifest = [];
  for (const artifact of artifacts) {
    const stats = await stat(artifact);
    const sha = await fileSha256(artifact);
    manifest.push({
      file: basename(artifact),
      size: stats.size,
      sha256: sha,
    });
  }

  await writeFile(
    join(artifactsDir, 'release-manifest.json'),
    JSON.stringify({ version, artifacts: manifest }, null, 2),
  );
  process.stdout.write(`[release] Artifacts written to ${artifactsDir}\n`);

  return { chromeZip, chromeCrx, firefoxZip, edgeZip };
}

async function publishChrome(chromeZip, chromeCrx) {
  if (!options.publishChrome || options.skipChromePublish) return;
  if (options.dryRun) {
    process.stdout.write('[release] Dry run: skipping Chrome publish\n');
    return;
  }

  const extensionId = process.env['CHROME_EXTENSION_ID'];
  const clientId = process.env['CHROME_CLIENT_ID'];
  const clientSecret = process.env['CHROME_CLIENT_SECRET'];
  const refreshToken = process.env['CHROME_REFRESH_TOKEN'];

  if (!extensionId || !clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing Chrome credentials. Required: CHROME_EXTENSION_ID, CHROME_CLIENT_ID, CHROME_CLIENT_SECRET, CHROME_REFRESH_TOKEN',
    );
  }

  logStep('Publishing to Chrome Web Store');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Failed to get Chrome OAuth token: ${tokenRes.status} ${await tokenRes.text()}`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData['access_token'];
  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error('Chrome OAuth token missing access_token');
  }

  // Prefer signed CRX upload (required for Chrome Web Store protected updates).
  // Fall back to ZIP if CRX was not produced (e.g. dry-run or skipped signing).
  const uploadFile = chromeCrx ?? chromeZip;
  const uploadFileBytes = await readFile(uploadFile);
  const uploadHeaders = chromeCrx
    ? {
        Authorization: `Bearer ${accessToken}`,
        'x-goog-api-version': '2',
        'X-Goog-Upload-Protocol': 'raw',
        'X-Goog-Upload-File-Name': basename(chromeCrx),
        'Content-Type': 'application/octet-stream',
      }
    : {
        Authorization: `Bearer ${accessToken}`,
        'x-goog-api-version': '2',
        'Content-Type': 'application/zip',
      };

  const uploadRes = await fetch(`https://www.googleapis.com/upload/chromewebstore/v1.1/items/${extensionId}`, {
    method: 'PUT',
    headers: uploadHeaders,
    body: uploadFileBytes,
  });

  if (!uploadRes.ok) {
    throw new Error(`Chrome upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }

  const publishRes = await fetch(
    `https://www.googleapis.com/chromewebstore/v1.1/items/${extensionId}/publish?publishTarget=default`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-goog-api-version': '2',
      },
    },
  );

  if (!publishRes.ok) {
    throw new Error(`Chrome publish failed: ${publishRes.status} ${await publishRes.text()}`);
  }

  process.stdout.write('[release] Chrome publish completed\n');
}

async function publishFirefox() {
  if (!options.publishFirefox) return;
  if (options.dryRun) {
    process.stdout.write('[release] Dry run: skipping Firefox publish\n');
    return;
  }

  const apiKey = process.env['FIREFOX_API_KEY'];
  const apiSecret = process.env['FIREFOX_API_SECRET'];
  if (!apiKey || !apiSecret) {
    throw new Error('Missing Firefox credentials. Required: FIREFOX_API_KEY, FIREFOX_API_SECRET');
  }

  const webExtBin =
    process.platform === 'win32'
      ? resolve(rootDir, 'node_modules/.bin/web-ext.cmd')
      : resolve(rootDir, 'node_modules/.bin/web-ext');

  logStep('Signing Firefox build via web-ext');
  await run(webExtBin, [
    'sign',
    '--source-dir',
    'dist/firefox',
    '--api-key',
    apiKey,
    '--api-secret',
    apiSecret,
    '--channel',
    'listed',
    '--artifacts-dir',
    join(options.artifactsDir, 'amo-signed'),
  ]);
  process.stdout.write('[release] Firefox signing completed\n');
}

async function publishEdge(edgeZip) {
  if (!options.publishEdge) return;
  if (options.dryRun) {
    process.stdout.write('[release] Dry run: skipping Edge publish\n');
    return;
  }

  const edgePublishCommand = process.env['EDGE_PUBLISH_COMMAND'];
  if (!edgePublishCommand) {
    throw new Error(
      `Edge publish requested but EDGE_PUBLISH_COMMAND is not set. Artifact ready: ${edgeZip}. ` +
        'Set EDGE_PUBLISH_COMMAND to your Partner Center publish command.',
    );
  }

  logStep('Publishing to Edge Add-ons via EDGE_PUBLISH_COMMAND');
  await run('sh', ['-lc', edgePublishCommand], {
    EDGE_PACKAGE_PATH: edgeZip,
  });
}

async function verifyReleaseChecks() {
  if (options.skipChecks) {
    process.stdout.write('[release] Skipping quality gates (--skip-checks)\n');
    return;
  }

  logStep('Running quality gates');
  await runTask('lint');
  await runTask('typecheck');

  if (!options.skipTests) {
    await runTask('test');
    await runTask('test:e2e:chromium:devnet');
  } else {
    process.stdout.write('[release] Skipping tests (--skip-tests)\n');
  }
}

async function main() {
  const packageJson = JSON.parse(await readFile(resolve(rootDir, 'package.json'), 'utf8'));
  const version = options.versionOverride ?? packageJson['version'];
  if (!version || typeof version !== 'string') {
    throw new Error('Unable to resolve version from package.json');
  }

  logStep(`Starting release for version ${version}${options.dryRun ? ' (dry-run)' : ''}`);
  await verifyReleaseChecks();
  const { chromeZip, chromeCrx, firefoxZip, edgeZip } = await buildArtifacts(version);

  await publishChrome(chromeZip, chromeCrx);
  await publishFirefox();
  await publishEdge(edgeZip);

  const files = await readdir(artifactsDir);
  process.stdout.write(
    `\n[release] Done. Artifacts:\n${files.map(f => `  - ${join(options.artifactsDir, f)}`).join('\n')}\n`,
  );
  process.stdout.write(`[release] Firefox package prepared at ${firefoxZip}\n`);
}

main().catch(error => {
  console.error('[release] Failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
