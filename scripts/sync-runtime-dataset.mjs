import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(__dirname, '../src/data/events.nl.json');
const targetPath = resolve(__dirname, '../public/events.nl.json');
const targetMetaPath = resolve(__dirname, '../public/events.meta.json');
const targetSitemapPath = resolve(__dirname, '../public/sitemap.xml');
const datasetDir = resolve(__dirname, '../public/datasets');
const datasetIndexPath = resolve(datasetDir, 'index.json');

const SITEMAP_URLS = [
  'https://sportkijken.paulzuiderduin.com/',
  'https://sportkijken.paulzuiderduin.com/?q=waar%20kan%20ik%20voetbal%20kijken',
  'https://sportkijken.paulzuiderduin.com/?q=waar%20kan%20ik%20formule%201%20kijken',
  'https://sportkijken.paulzuiderduin.com/?q=waar%20kan%20ik%20tennis%20kijken',
  'https://sportkijken.paulzuiderduin.com/?q=waar%20kan%20ik%20eredivisie%20kijken',
  'https://sportkijken.paulzuiderduin.com/?q=waar%20kan%20ik%20premier%20league%20kijken',
  'https://sportkijken.paulzuiderduin.com/?q=waar%20kan%20ik%20champions%20league%20kijken',
  'https://sportkijken.paulzuiderduin.com/?q=nos%20livestream%20sport',
  'https://sportkijken.paulzuiderduin.com/?q=ziggo%20sport%20gratis%20kijken'
];

function normalizeIso(value) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= 0) {
    return null;
  }
  return date.toISOString();
}

function ymdFromIso(value) {
  const date = new Date(value || Date.now());
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthKeyFromStart(startIso) {
  const date = new Date(startIso || 0);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= 0) {
    return null;
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSitemapXml(lastmodDate) {
  const rows = SITEMAP_URLS.map((url, index) => {
    const priority = index === 0 ? '1.0' : (index < 4 ? '0.9' : (index < 7 ? '0.85' : '0.75'));
    return [
      '  <url>',
      `    <loc>${escapeXml(url)}</loc>`,
      `    <lastmod>${lastmodDate}</lastmod>`,
      '    <changefreq>daily</changefreq>',
      `    <priority>${priority}</priority>`,
      '  </url>'
    ].join('\n');
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}

const dataset = await readFile(sourcePath, 'utf8');
const parsed = JSON.parse(dataset);
const events = Array.isArray(parsed?.events) ? parsed.events : [];
const eventCount = events.length;
const checkedAt = new Date().toISOString();
const lastChangedAt = normalizeIso(parsed?.generatedAt);
const lastmodDate = ymdFromIso(lastChangedAt || checkedAt);
const datasetMeta = {
  generatedAt: lastChangedAt,
  lastChangedAt,
  checkedAt,
  eventCount,
  shardStrategy: 'month'
};

await mkdir(dirname(targetPath), { recursive: true });
await writeFile(targetPath, dataset, 'utf8');
await writeFile(targetMetaPath, `${JSON.stringify(datasetMeta, null, 2)}\n`, 'utf8');
await writeFile(targetSitemapPath, buildSitemapXml(lastmodDate), 'utf8');

const buckets = new Map();
events.forEach((event) => {
  const bucketId = monthKeyFromStart(event?.start);
  if (!bucketId) {
    return;
  }

  const existing = buckets.get(bucketId);
  if (!existing) {
    buckets.set(bucketId, {
      id: bucketId,
      start: event.start,
      end: event.start,
      events: [event]
    });
    return;
  }

  existing.events.push(event);
  if (new Date(event.start).getTime() < new Date(existing.start).getTime()) {
    existing.start = event.start;
  }
  if (new Date(event.start).getTime() > new Date(existing.end).getTime()) {
    existing.end = event.start;
  }
});

await rm(datasetDir, { recursive: true, force: true });
await mkdir(datasetDir, { recursive: true });

const sortedBuckets = [...buckets.values()].sort((a, b) => a.id.localeCompare(b.id));
for (const bucket of sortedBuckets) {
  const filename = `events-${bucket.id}.json`;
  const bucketDataset = {
    generatedAt: lastChangedAt,
    region: parsed?.region || 'NL',
    isDemo: Boolean(parsed?.isDemo),
    sources: [],
    events: bucket.events
  };
  await writeFile(resolve(datasetDir, filename), `${JSON.stringify(bucketDataset)}\n`, 'utf8');
}

const indexPayload = {
  generatedAt: lastChangedAt,
  checkedAt,
  eventCount,
  buckets: sortedBuckets.map((bucket) => ({
    id: bucket.id,
    path: `/datasets/events-${bucket.id}.json`,
    start: bucket.start,
    end: bucket.end,
    eventCount: bucket.events.length
  }))
};
await writeFile(datasetIndexPath, `${JSON.stringify(indexPayload, null, 2)}\n`, 'utf8');

console.log('Synced runtime dataset and metadata to public/.');
