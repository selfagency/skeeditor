#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** @typedef {{
 * dryRun: boolean;
 * publishChrome: boolean;
 * publishFirefox: boolean;
 * publishEdge: boolean;
 * skipChecks: boolean;
 * skipTests: boolean;
 * skipSafari: boolean;
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

const taskExecutable = process.platform === 'win32' ? resolve(rootDir, 'node_modules/.bin/task.cmd') : resolve(rootDir, 'node_modules/.bin/task');

function logStep(message) {
  process.stdout.write(`\n[release] ${message}\n`);
}

async function run(command, args, extraEnv = {}) {
  process.stdout.write(`[run] ${command} ${args.join(' ')}\n`);
  await execFileAsync(command, args, {
    cwd: rootDir,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
  });
}

async function runTask(taskName, args = [], extraEnv = {}) {
  const taskPath = await stat(taskExecutable).then(() => taskExecutable).catch(() => 'task');
  await run(taskPath, [taskName, ...args], extraEnv);
}

async function zipDir(inputDir, outputZip) {
  await rm(outputZip, { force: true });
  await execFileAsync('zip', ['-r', outputZip, '.'], {
    cwd: inputDir,
    env: process.env,
    stdio: 'inherit',
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
  logStep('Building browser targets');
  await runTask('build:chrome');
  await runTask('build:firefox');
  if (!options.skipSafari) {
    await runTask('build:safari');
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

  const artifacts = [chromeZip, firefoxZip, edgeZip];
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

  await writeFile(join(artifactsDir, 'release-manifest.json'), JSON.stringify({ version, artifacts: manifest }, null, 2));
  process.stdout.write(`[release] Artifacts written to ${artifactsDir}\n`);

  return { chromeZip, firefoxZip, edgeZip };
}

async function publishChrome(chromeZip) {
  if (!options.publishChrome) return;
  if (options.dryRun) {
    process.stdout.write('[release] Dry run: skipping Chrome publish\n');
    return;
  }

  const extensionId = process.env['CHROME_EXTENSION_ID'];
  const clientId = process.env['CHROME_CLIENT_ID'];
  const clientSecret = process.env['CHROME_CLIENT_SECRET'];
  const refreshToken = process.env['CHROME_REFRESH_TOKEN'];

  if (!extensionId || !clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Chrome credentials. Required: CHROME_EXTENSION_ID, CHROME_CLIENT_ID, CHROME_CLIENT_SECRET, CHROME_REFRESH_TOKEN');
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

  const zipBytes = await readFile(chromeZip);
  const uploadRes = await fetch(`https://www.googleapis.com/upload/chromewebstore/v1.1/items/${extensionId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-goog-api-version': '2',
      'Content-Type': 'application/zip',
    },
    body: zipBytes,
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

  logStep('Signing Firefox build via web-ext');
  await run('pnpm', ['exec', 'web-ext', 'sign', '--source-dir', 'dist/firefox', '--api-key', apiKey, '--api-secret', apiSecret, '--channel', 'listed', '--artifacts-dir', join(options.artifactsDir, 'amo-signed')]);
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
  const { chromeZip, firefoxZip, edgeZip } = await buildArtifacts(version);

  await publishChrome(chromeZip);
  await publishFirefox();
  await publishEdge(edgeZip);

  const files = await readdir(artifactsDir);
  process.stdout.write(`\n[release] Done. Artifacts:\n${files.map(f => `  - ${join(options.artifactsDir, f)}`).join('\n')}\n`);
  process.stdout.write(`[release] Firefox package prepared at ${firefoxZip}\n`);
}

main().catch(error => {
  console.error('[release] Failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
