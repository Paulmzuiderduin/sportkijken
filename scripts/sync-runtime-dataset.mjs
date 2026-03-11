import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(__dirname, '../src/data/events.nl.json');
const targetPath = resolve(__dirname, '../public/events.nl.json');

const dataset = await readFile(sourcePath, 'utf8');
await mkdir(dirname(targetPath), { recursive: true });
await writeFile(targetPath, dataset, 'utf8');

console.log('Synced runtime dataset to public/events.nl.json');
