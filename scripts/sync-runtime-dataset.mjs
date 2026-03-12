import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(__dirname, '../src/data/events.nl.json');
const targetPath = resolve(__dirname, '../public/events.nl.json');
const targetMetaPath = resolve(__dirname, '../public/events.meta.json');

const dataset = await readFile(sourcePath, 'utf8');
const parsed = JSON.parse(dataset);
const eventCount = Array.isArray(parsed?.events) ? parsed.events.length : 0;
const datasetMeta = {
  generatedAt: parsed?.generatedAt || null,
  eventCount
};

await mkdir(dirname(targetPath), { recursive: true });
await writeFile(targetPath, dataset, 'utf8');
await writeFile(targetMetaPath, `${JSON.stringify(datasetMeta, null, 2)}\n`, 'utf8');

console.log('Synced runtime dataset and metadata to public/.');
