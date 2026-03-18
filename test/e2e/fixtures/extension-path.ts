import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

export const resolveBuiltExtensionPath = async (): Promise<string> => {
  const extensionPath = resolve(process.cwd(), 'dist');

  await Promise.all([
    access(resolve(extensionPath, 'background/service-worker.js')),
    access(resolve(extensionPath, 'manifest.json')),
    access(resolve(extensionPath, 'popup/popup.html')),
  ]);

  return extensionPath;
};
