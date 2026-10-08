import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateRawSync } from 'node:zlib';

// Only explicitly included project files are archived: no .git, .env or dependency caches.
const rootFiles = ['.env.example', '.gitignore', 'README.md', 'OWNER.md', 'PHONE.md', 'index.html', 'package.json', 'package-lock.json', 'vite.config.js'];
const sourceDirs = ['src', 'server', 'scripts', 'test', 'public', '.github'];
async function listFiles(root, prefix = '') {
  const entries = [];
  for (const entry of await readdir(resolve(root, prefix), { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) entries.push(...await listFiles(root, path + '/'));
    else if (entry.isFile()) entries.push(path);
    else throw new Error('Cannot safely archive a non-file entry: ' + path);
  }
  return entries.sort();
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let bit = 0; bit < 8; bit++) n = (n & 1) ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
async function zip(root, paths, output, prefix = '') {
  const blocks = [], directory = [];
  let offset = 0;
  for (const path of paths) {
    const name = Buffer.from(prefix + path);
    const data = await readFile(resolve(root, path));
    const compressed = deflateRawSync(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6); // UTF-8 file names
    local.writeUInt16LE(8, 8); // DEFLATE
    local.writeUInt16LE(33, 12); // 1980-01-01, deterministic archive
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    local.copy(central, 6, 4, 30);
    central.writeUInt32LE(offset, 42);
    blocks.push(local, name, compressed);
    directory.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const directorySize = directory.reduce((size, block) => size + block.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(paths.length, 8);
  end.writeUInt16LE(paths.length, 10);
  end.writeUInt32LE(directorySize, 12);
  end.writeUInt32LE(offset, 16);
  await writeFile(output, Buffer.concat([...blocks, ...directory, end]));
}
const sourcePaths = [...rootFiles];
for (const directory of sourceDirs) sourcePaths.push(...await listFiles(resolve('.'), directory + '/'));
await zip(resolve('.'), sourcePaths.sort(), resolve('../belkovy-shef-source.zip'), 'belkovy-shef/');
await zip(resolve('dist'), await listFiles(resolve('dist')), resolve('../belkovy-shef-site.zip'));
console.log('Editable source and mobile website archives exported.');
