import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const datasetPath = resolve(__dirname, '../src/data/events.nl.json');

function assertValidChannel(channel, eventId) {
  if (!channel.name || typeof channel.name !== 'string') {
    throw new Error(`Channel name missing for event ${eventId}`);
  }

  if (!['tv', 'stream'].includes(channel.platform)) {
    throw new Error(`Invalid channel platform for event ${eventId}: ${channel.platform}`);
  }

  if (!['free', 'paid'].includes(channel.access)) {
    throw new Error(`Invalid channel access for event ${eventId}: ${channel.access}`);
  }
}

function normalizeEvent(event) {
  if (!event.id || !event.start || !event.sport || !Array.isArray(event.channels) || !event.channels.length) {
    throw new Error(`Event missing required fields: ${JSON.stringify(event)}`);
  }

  event.channels.forEach((channel) => assertValidChannel(channel, event.id));

  return {
    ...event,
    sport: String(event.sport).toLowerCase(),
    channels: event.channels.map((channel) => ({
      name: channel.name.trim(),
      platform: channel.platform,
      access: channel.access
    }))
  };
}

const raw = await readFile(datasetPath, 'utf8');
const parsed = JSON.parse(raw);

if (!Array.isArray(parsed.events)) {
  throw new Error('Dataset must contain an events array');
}

const normalizedEvents = parsed.events
  .map(normalizeEvent)
  .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

const normalizedDataset = {
  ...parsed,
  generatedAt: new Date().toISOString(),
  events: normalizedEvents
};

await writeFile(datasetPath, `${JSON.stringify(normalizedDataset, null, 2)}\n`, 'utf8');
console.log(`Normalized ${normalizedEvents.length} events in ${datasetPath}`);
