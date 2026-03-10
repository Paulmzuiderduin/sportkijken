import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeDataset } from './dataset-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const datasetPath = resolve(__dirname, '../src/data/events.nl.json');

const NOW = new Date();
const windowStart = new Date(NOW.getTime() - 4 * 60 * 60 * 1000);
const windowEnd = new Date(NOW.getTime() + 75 * 24 * 60 * 60 * 1000);
const RANGE_START = formatDateForApi(windowStart);
const RANGE_END = formatDateForApi(windowEnd);
const DATE_RANGE = `${RANGE_START}-${RANGE_END}`;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_EVENTS = 220;

const footballFeeds = [
  {
    slug: 'ned.1',
    competition: 'Eredivisie',
    channels: [
      { name: 'ESPN', platform: 'tv', access: 'paid' },
      { name: 'ESPN Watch', platform: 'stream', access: 'paid' }
    ],
    note: 'Automatisch opgehaald. Controleer exacte zenderindeling op wedstrijddag.'
  },
  {
    slug: 'ned.cup',
    competition: 'KNVB Beker',
    channels: [
      { name: 'ESPN', platform: 'tv', access: 'paid' },
      { name: 'ESPN Watch', platform: 'stream', access: 'paid' }
    ],
    note: 'Automatisch opgehaald. Bekerrechten kunnen per ronde verschillen.'
  },
  {
    slug: 'uefa.champions',
    competition: 'UEFA Champions League',
    channels: [
      { name: 'Ziggo Sport', platform: 'tv', access: 'paid' },
      { name: 'Ziggo GO', platform: 'stream', access: 'paid' }
    ],
    note: 'Automatisch opgehaald. Nederlandse rechten kunnen wijzigen.'
  },
  {
    slug: 'uefa.europa',
    competition: 'UEFA Europa League',
    channels: [
      { name: 'Ziggo Sport', platform: 'tv', access: 'paid' },
      { name: 'Ziggo GO', platform: 'stream', access: 'paid' }
    ],
    note: 'Automatisch opgehaald. Nederlandse rechten kunnen wijzigen.'
  },
  {
    slug: 'fifa.worldq.uefa',
    competition: 'WK kwalificatie UEFA',
    channels: [
      { name: 'NPO 3', platform: 'tv', access: 'free' },
      { name: 'NPO Start', platform: 'stream', access: 'free' },
      { name: 'Ziggo Sport', platform: 'tv', access: 'paid' }
    ],
    note: 'Automatisch opgehaald. Uitzendrechten verschillen per wedstrijd en land.'
  }
];

const f1Feed = {
  slug: 'f1',
  competition: 'FIA Formula 1 World Championship',
  channels: [
    { name: 'Viaplay TV', platform: 'tv', access: 'paid' },
    { name: 'Viaplay', platform: 'stream', access: 'paid' }
  ],
  note: 'Automatisch opgehaald. Controleer de uitzending voor race/kwalificatie/sprint.'
};

const tennisFeeds = [
  {
    slug: 'atp',
    competition: 'ATP',
    channels: [
      { name: 'Eurosport', platform: 'tv', access: 'paid' },
      { name: 'HBO Max', platform: 'stream', access: 'paid' }
    ],
    note: 'Automatisch opgehaald. Beschikbaarheid verschilt per toernooi.'
  },
  {
    slug: 'wta',
    competition: 'WTA',
    channels: [
      { name: 'Eurosport', platform: 'tv', access: 'paid' },
      { name: 'HBO Max', platform: 'stream', access: 'paid' }
    ],
    note: 'Automatisch opgehaald. Beschikbaarheid verschilt per toernooi.'
  }
];

function formatDateForApi(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function isWithinWindow(dateValue) {
  const date = new Date(dateValue);
  return date >= windowStart && date <= windowEnd;
}

function tryIso(dateValue) {
  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function locationFromAddress(address, fallbackVenue) {
  if (!address && !fallbackVenue) {
    return 'Onbekend';
  }

  const parts = [];
  if (fallbackVenue) {
    parts.push(fallbackVenue);
  }
  if (address?.city && !parts.includes(address.city)) {
    parts.push(address.city);
  }
  if (address?.country && !parts.includes(address.country)) {
    parts.push(address.country);
  }
  return parts.join(', ');
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'sportkijken-data-updater'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function dedupeEvents(events) {
  const byId = new Map();
  events.forEach((event) => {
    byId.set(event.id, event);
  });
  return [...byId.values()].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

function parseSoccerEvent(event, feed) {
  const isoStart = tryIso(event.date);
  if (!isoStart || !isWithinWindow(isoStart)) {
    return null;
  }

  const statusState = event.status?.type?.state;
  if (statusState === 'post') {
    return null;
  }

  const competition = event.competitions?.[0];
  const competitors = competition?.competitors || [];
  const home = competitors.find((competitor) => competitor.homeAway === 'home')?.team?.displayName;
  const away = competitors.find((competitor) => competitor.homeAway === 'away')?.team?.displayName;
  const title = home && away ? `${home} - ${away}` : event.name || event.shortName || feed.competition;
  const location = locationFromAddress(competition?.venue?.address, competition?.venue?.fullName);

  return {
    id: `voetbal-${feed.slug}-${event.id}`,
    sport: 'voetbal',
    title,
    competition: feed.competition,
    start: isoStart,
    durationMinutes: 125,
    location,
    channels: feed.channels,
    notes: feed.note
  };
}

function parseF1Event(event) {
  const isoStart = tryIso(event.date);
  if (!isoStart || !isWithinWindow(isoStart)) {
    return null;
  }

  const statusState = event.status?.type?.state;
  if (statusState === 'post') {
    return null;
  }

  const location = locationFromAddress(event.circuit?.address, event.circuit?.fullName);
  const endIso = tryIso(event.endDate);
  let durationMinutes = 150;

  if (endIso) {
    const diffMinutes = Math.round((new Date(endIso).getTime() - new Date(isoStart).getTime()) / 60000);
    if (diffMinutes > 10) {
      durationMinutes = diffMinutes;
    }
  }

  return {
    id: `formule-1-${event.id}`,
    sport: 'formule-1',
    title: event.shortName || event.name || 'Formule 1',
    competition: f1Feed.competition,
    start: isoStart,
    durationMinutes,
    location,
    channels: f1Feed.channels,
    notes: f1Feed.note
  };
}

function parseTennisEvent(event, feed) {
  const isoStart = tryIso(event.date);
  if (!isoStart || !isWithinWindow(isoStart)) {
    return null;
  }

  const statusState = event.status?.type?.state;
  if (statusState === 'post') {
    return null;
  }

  return {
    id: `tennis-${feed.slug}-${event.id}`,
    sport: 'tennis',
    title: event.shortName || event.name || feed.competition,
    competition: feed.competition,
    start: isoStart,
    durationMinutes: 180,
    location: event.venue?.displayName || 'Onbekend',
    channels: feed.channels,
    notes: feed.note
  };
}

async function fetchFootballEvents() {
  const allEvents = [];
  const sources = [];
  const errors = [];

  for (const feed of footballFeeds) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${feed.slug}/scoreboard?dates=${DATE_RANGE}`;
    sources.push(url);
    try {
      const data = await fetchJson(url);
      const parsed = (data.events || [])
        .map((event) => parseSoccerEvent(event, feed))
        .filter(Boolean);
      allEvents.push(...parsed);
    } catch (error) {
      errors.push(`Voetbal ${feed.slug}: ${error.message}`);
    }
  }

  return { events: allEvents, sources, errors };
}

async function fetchF1Events() {
  const url = `https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard?dates=${DATE_RANGE}`;
  const data = await fetchJson(url);
  return {
    events: (data.events || []).map(parseF1Event).filter(Boolean),
    sources: [url]
  };
}

async function fetchTennisEvents() {
  const allEvents = [];
  const sources = [];
  const errors = [];

  for (const feed of tennisFeeds) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/tennis/${feed.slug}/scoreboard?dates=${DATE_RANGE}`;
    sources.push(url);
    try {
      const data = await fetchJson(url);
      const parsed = (data.events || [])
        .map((event) => parseTennisEvent(event, feed))
        .filter(Boolean);
      allEvents.push(...parsed);
    } catch (error) {
      errors.push(`Tennis ${feed.slug}: ${error.message}`);
    }
  }

  return { events: allEvents, sources, errors };
}

function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const previousRaw = await readFile(datasetPath, 'utf8').catch(() => null);
const previous = previousRaw ? safeParseJson(previousRaw) : null;

const football = await fetchFootballEvents();
const f1 = await fetchF1Events().catch((error) => ({
  events: [],
  sources: [`https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard?dates=${DATE_RANGE}`],
  errors: [`Formule 1: ${error.message}`]
}));
const tennis = await fetchTennisEvents();

const fetchErrors = [...football.errors, ...(f1.errors || []), ...tennis.errors];
if (fetchErrors.length) {
  console.warn(`Partial fetch issues: ${fetchErrors.join(' | ')}`);
}

const mergedEvents = dedupeEvents([...football.events, ...f1.events, ...tennis.events]).slice(0, MAX_EVENTS);
if (!mergedEvents.length) {
  throw new Error('No events fetched; aborting dataset overwrite.');
}

const nextDataset = normalizeDataset({
  generatedAt: new Date().toISOString(),
  region: 'NL',
  isDemo: false,
  sources: [...football.sources, ...f1.sources, ...tennis.sources],
  events: mergedEvents
});

const previousEvents = previous && Array.isArray(previous.events) ? previous.events : null;
if (previousEvents && JSON.stringify(previousEvents) === JSON.stringify(nextDataset.events)) {
  console.log('No event changes detected; keeping current dataset.');
  process.exit(0);
}

await writeFile(datasetPath, `${JSON.stringify(nextDataset, null, 2)}\n`, 'utf8');
console.log(`Updated dataset with ${nextDataset.events.length} events.`);
