import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeDataset } from './dataset-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const datasetPath = resolve(__dirname, '../src/data/events.nl.json');

const raw = await readFile(datasetPath, 'utf8');
const parsed = JSON.parse(raw);
const normalized = normalizeDataset(parsed);

const normalizedDataset = {
  ...normalized,
  generatedAt: new Date().toISOString(),
};

await writeFile(datasetPath, `${JSON.stringify(normalizedDataset, null, 2)}\n`, 'utf8');
console.log(`Normalized ${normalizedDataset.events.length} events in ${datasetPath}`);
