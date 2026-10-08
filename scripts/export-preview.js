import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { standaloneHtml } from './standalone.js';

const html = await standaloneHtml(resolve('dist'));
const outputs = process.argv[2]
  ? [resolve(process.argv[2])]
  : [resolve('../belkovy-shef-preview.html'), resolve('../belkovy-shef-mobile.html')];
for (const output of outputs) await writeFile(output, html);
console.log('Standalone application exported.');
