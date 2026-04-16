import { mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { firefox } from '@playwright/test';

const profileDir = await mkdtemp(join(tmpdir(), 'skeeditor-webext-firefox-'));
const webExtBin = resolve('node_modules/.bin/web-ext');
const sourceDir = resolve('dist/firefox');
const firefoxCandidates = [
  process.env['FIREFOX_BINARY'],
  '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox',
  firefox.executablePath(),
  'firefox',
].filter(Boolean);

const firefoxBinary = firefoxCandidates.find(candidate => {
  if (candidate === 'firefox') return true;
  return existsSync(candidate);
});

if (!firefoxBinary) {
  console.error('No Firefox binary found. Set FIREFOX_BINARY or install Firefox Developer Edition.');
  process.exit(1);
}

const args = [
  'run',
  '--source-dir',
  sourceDir,
  '--firefox',
  firefoxBinary,
  '--no-reload',
  '--profile-create-if-missing',
  '--firefox-profile',
  profileDir,
  '--arg=-headless',
  '--start-url',
  'https://bsky.app',
];

const child = spawn(webExtBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

let stderr = '';
let stdout = '';
let finished = false;

const onData = (chunk, target) => {
  const text = chunk.toString();
  if (target === 'stdout') stdout += text;
  if (target === 'stderr') stderr += text;
};

child.stdout?.on('data', chunk => onData(chunk, 'stdout'));
child.stderr?.on('data', chunk => onData(chunk, 'stderr'));

const fail = message => {
  if (!finished) {
    finished = true;
    child.kill('SIGTERM');
    console.error(message);
    if (stdout.trim().length > 0) console.error(`\n[web-ext stdout]\n${stdout}`);
    if (stderr.trim().length > 0) console.error(`\n[web-ext stderr]\n${stderr}`);
    process.exit(1);
  }
};

child.on('exit', code => {
  if (!finished) {
    fail(`web-ext exited early with code ${code ?? 'null'}`);
  }
});

setTimeout(() => {
  if (finished) return;
  finished = true;
  child.kill('SIGTERM');
  console.log('web-ext Firefox smoke launch succeeded.');
  process.exit(0);
}, 12_000);

setTimeout(() => {
  fail('Timed out waiting for web-ext Firefox smoke launch.');
}, 30_000);
