import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

interface JsonObject {
  [key: string]: JsonValue;
}

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonArray | JsonObject | JsonPrimitive;
type JsonArray = JsonValue[];
type SupportedBrowser = 'chrome' | 'firefox' | 'safari';

const supportedBrowsers = new Set<SupportedBrowser>(['chrome', 'firefox', 'safari']);
const browserArgument = process.argv[2];
const outputFlagIndex = process.argv.indexOf('--out');
const outputPath = outputFlagIndex >= 0 ? (process.argv[outputFlagIndex + 1] ?? null) : null;

const isJsonObject = (value: JsonValue | undefined): value is JsonObject => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const mergeJson = (baseValue: JsonValue, overrideValue: JsonValue): JsonValue => {
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

const readJsonFile = async (filePath: string): Promise<JsonObject> => {
  const fileContent = await readFile(filePath, 'utf8');
  const parsedContent = JSON.parse(fileContent) as JsonValue;

  if (!isJsonObject(parsedContent)) {
    throw new TypeError(`Expected JSON object in ${filePath}`);
  }

  return parsedContent;
};

const main = async (): Promise<void> => {
  if (!browserArgument || !supportedBrowsers.has(browserArgument as SupportedBrowser)) {
    throw new Error('Usage: tsx scripts/merge-manifest.ts <chrome|firefox|safari> [--out <file>]');
  }

  const browser = browserArgument as SupportedBrowser;
  const projectRoot = process.cwd();
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

  const serializedManifest = `${JSON.stringify(mergedManifest, null, 2)}\n`;

  if (outputPath) {
    const absoluteOutputPath = resolve(projectRoot, outputPath);
    await mkdir(dirname(absoluteOutputPath), { recursive: true });
    await writeFile(absoluteOutputPath, serializedManifest, 'utf8');
    return;
  }

  process.stdout.write(serializedManifest);
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
