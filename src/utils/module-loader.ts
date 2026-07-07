import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeExtension = path.extname(fileURLToPath(import.meta.url)) === '.ts' ? '.ts' : '.js';

function isLoadable(file: string): boolean {
  return file.endsWith(runtimeExtension) && !file.endsWith('.d.ts') && !file.endsWith('.map');
}

export async function walkModuleFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkModuleFiles(fullPath)));
      continue;
    }
    if (isLoadable(entry.name)) results.push(fullPath);
  }
  return results;
}
