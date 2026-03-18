import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface JsonObject {
  [key: string]: JsonValue;
}

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonArray | JsonObject | JsonPrimitive;
type JsonArray = JsonValue[];
export type SupportedBrowser = 'chrome' | 'firefox' | 'safari';

const supportedBrowsers = new Set<SupportedBrowser>(['chrome', 'firefox', 'safari']);

const isJsonObject = (value: JsonValue | undefined): value is JsonObject => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const mergeJson = (baseValue: JsonValue, overrideValue: JsonValue): JsonValue => {
  if (Array.isArray(baseValue) || Array.isArray(overrideValue)) {
    return overrideValue;
  }

  if (isJsonObject(baseValue) && isJsonObject(overrideValue)) {
    const mergedObject: JsonObject = { ...baseValue };

    for (const [key, value] of Object.entries(overrideValue)) {
      const existingValue = mergedObject[key];
      mergedObject[key] = existingValue === undefined ? value : mergeJson(existingValue, value);
    }

    return mergedObject;
  }

  return overrideValue;
};

export const readJsonFile = async (filePath: string): Promise<JsonObject> => {
  const fileContent = await readFile(filePath, 'utf8');
  const parsedContent = JSON.parse(fileContent) as JsonValue;

  if (!isJsonObject(parsedContent)) {
    throw new TypeError(`Expected JSON object in ${filePath}`);
  }

  return parsedContent;
};

export const buildMergedManifest = async (
  browser: SupportedBrowser,
  projectRoot = process.cwd(),
): Promise<JsonObject> => {
  if (!supportedBrowsers.has(browser)) {
    throw new Error('Usage: tsx scripts/merge-manifest.ts <chrome|firefox|safari> [--out <file>]');
  }

  const baseManifestPath = resolve(projectRoot, 'manifests/base.json');
  const browserManifestPath = resolve(projectRoot, `manifests/${browser}/manifest.json`);
  const packageJsonPath = resolve(projectRoot, 'package.json');

  const [baseManifest, browserManifest, packageJson] = await Promise.all([
    readJsonFile(baseManifestPath),
    readJsonFile(browserManifestPath),
    readJsonFile(packageJsonPath),
  ]);

  const mergedManifest = mergeJson(baseManifest, browserManifest);

  if (!isJsonObject(mergedManifest)) {
    throw new TypeError('Merged manifest must be a JSON object');
  }

  if (typeof packageJson.version === 'string') {
    mergedManifest.version = packageJson.version;
  }

  return mergedManifest;
};

export const writeMergedManifest = async (
  browser: SupportedBrowser,
  outputPath: string,
  projectRoot = process.cwd(),
): Promise<void> => {
  const mergedManifest = await buildMergedManifest(browser, projectRoot);
  const serializedManifest = `${JSON.stringify(mergedManifest, null, 2)}\n`;
  const absoluteOutputPath = resolve(projectRoot, outputPath);

  await mkdir(dirname(absoluteOutputPath), { recursive: true });
  await writeFile(absoluteOutputPath, serializedManifest, 'utf8');
};

const main = async (): Promise<void> => {
  const browserArgument = process.argv[2];
  const outputFlagIndex = process.argv.indexOf('--out');
  const outputPath = outputFlagIndex >= 0 ? (process.argv[outputFlagIndex + 1] ?? null) : null;

  if (!browserArgument || !supportedBrowsers.has(browserArgument as SupportedBrowser)) {
    throw new Error('Usage: tsx scripts/merge-manifest.ts <chrome|firefox|safari> [--out <file>]');
  }

  const browser = browserArgument as SupportedBrowser;
  const projectRoot = process.cwd();
  const mergedManifest = await buildMergedManifest(browser, projectRoot);

  const serializedManifest = `${JSON.stringify(mergedManifest, null, 2)}\n`;

  if (outputPath) {
    await writeMergedManifest(browser, outputPath, projectRoot);
    return;
  }

  process.stdout.write(serializedManifest);
};

const scriptPath = process.argv[1];

if (scriptPath && resolve(scriptPath) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
