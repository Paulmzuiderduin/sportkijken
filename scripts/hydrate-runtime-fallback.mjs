import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const datasetPath = resolve(__dirname, '../src/data/events.nl.json');
const providerHealthPath = resolve(__dirname, '../src/data/provider-health.nl.json');
const sourceCheckPath = resolve(__dirname, '../src/data/source-check.nl.json');
const baseUrl = (process.env.RUNTIME_FALLBACK_BASE_URL || 'https://sportkijken.paulzuiderduin.com').replace(/\/$/, '');

function timestamp(value) {
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchJson(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${baseUrl}${path}?hydrate=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      throw new Error(`${path}: HTTP ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

try {
  const [deployedDataset, deployedMeta, deployedProviderHealth, bundledRaw] = await Promise.all([
    fetchJson('/events.nl.json'),
    fetchJson('/events.meta.json'),
    fetchJson('/provider-health.json').catch(() => null),
    readFile(datasetPath, 'utf8').catch(() => null)
  ]);
  const bundledDataset = bundledRaw ? JSON.parse(bundledRaw) : null;
  const deployedEvents = Array.isArray(deployedDataset?.events) ? deployedDataset.events : [];

  if (!deployedEvents.length) {
    throw new Error('deployed dataset contains no events');
  }

  if (timestamp(deployedDataset.generatedAt) < timestamp(bundledDataset?.generatedAt)) {
    console.log('Bundled dataset is newer than the deployed fallback; hydration skipped.');
    process.exit(0);
  }

  await writeFile(datasetPath, `${JSON.stringify(deployedDataset, null, 2)}\n`, 'utf8');

  if (deployedProviderHealth && typeof deployedProviderHealth === 'object') {
    await writeFile(providerHealthPath, `${JSON.stringify(deployedProviderHealth, null, 2)}\n`, 'utf8');
  }
  if (deployedMeta?.checkedAt) {
    await writeFile(sourceCheckPath, `${JSON.stringify({ checkedAt: deployedMeta.checkedAt }, null, 2)}\n`, 'utf8');
  }

  console.log(`Hydrated ${deployedEvents.length} events from the deployed site.`);
} catch (error) {
  console.warn(`Could not hydrate deployed fallback; using bundled data: ${error.message}`);
}
