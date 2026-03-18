import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const projectRoot = process.cwd();
const generatedLexiconRoot = join(projectRoot, 'src/lexicons');
const tsNoCheckDirective = '// @ts-nocheck';

const collectTypeScriptFiles = async (directoryPath: string): Promise<string[]> => {
  const directoryEntries = await readdir(directoryPath, { withFileTypes: true });

  const nestedFileGroups = await Promise.all(
    directoryEntries.map(async entry => {
      const entryPath = join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        return collectTypeScriptFiles(entryPath);
      }

      if (entry.isFile() && entry.name.endsWith('.ts')) {
        return [entryPath];
      }

      return [];
    }),
  );

  return nestedFileGroups.flat();
};

const GENERATED_HEADER = 'THIS FILE WAS GENERATED';

const annotateGeneratedFile = async (filePath: string): Promise<void> => {
  const existingContent = await readFile(filePath, 'utf8');

  if (existingContent.startsWith(tsNoCheckDirective)) {
    return;
  }

  // Only annotate files that carry the generator header; skip hand-written files.
  if (!existingContent.includes(GENERATED_HEADER)) {
    return;
  }

  await writeFile(filePath, `${tsNoCheckDirective}\n${existingContent}`);
};

const main = async (): Promise<void> => {
  const generatedFiles = await collectTypeScriptFiles(generatedLexiconRoot);

  await Promise.all(generatedFiles.map(filePath => annotateGeneratedFile(filePath)));
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
