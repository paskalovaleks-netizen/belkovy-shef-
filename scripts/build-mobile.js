import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { standaloneHtml } from './standalone.js';

const root = resolve('dist');
await writeFile(resolve(root, 'belkovy-shef.html'), await standaloneHtml(root));
async function listFiles(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await listFiles(resolve(directory, entry.name), name + '/'));
    else if (entry.isFile() && name !== 'sw.js') result.push(name);
  }
  return result.sort();
}
const files = await listFiles(root);
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(await readFile(resolve(root, file)));
const worker = await readFile(resolve('src/offline-worker.js'), 'utf8');
const configuration = `const APP_CACHE = 'belkovy-chef-app-${hash.digest('hex').slice(0, 16)}';\nconst APP_FILES = ${JSON.stringify(['./', ...files.map(file => './' + file)])};\n`;
await writeFile(resolve(root, 'sw.js'), configuration + worker);
console.log('Mobile installation and offline cache prepared.');
