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
const MAX_EVENTS = 360;

const CHANNEL_PRESETS = {
  espn: [
    { name: 'ESPN', platform: 'tv', access: 'paid' },
    { name: 'ESPN Watch', platform: 'stream', access: 'paid' }
  ],
  ziggo: [
    { name: 'Ziggo Sport', platform: 'tv', access: 'paid' },
    { name: 'Ziggo GO', platform: 'stream', access: 'paid' }
  ],
  viaplay: [
    { name: 'Viaplay TV', platform: 'tv', access: 'paid' },
    { name: 'Viaplay', platform: 'stream', access: 'paid' }
  ],
  eurosport: [
    { name: 'Eurosport', platform: 'tv', access: 'paid' },
    { name: 'HBO Max', platform: 'stream', access: 'paid' }
  ],
  nos: [
    { name: 'NOS.nl Live', platform: 'stream', access: 'free' },
    { name: 'NPO Start', platform: 'stream', access: 'free' }
  ],
  npoTv: [
    { name: 'NPO 1', platform: 'tv', access: 'free' },
    { name: 'NPO 3', platform: 'tv', access: 'free' },
    { name: 'NPO Start', platform: 'stream', access: 'free' }
  ],
  mlb: [
    { name: 'ESPN 4', platform: 'tv', access: 'paid' },
    { name: 'MLB.TV', platform: 'stream', access: 'paid' }
  ],
  nhl: [
    { name: 'Viaplay TV', platform: 'tv', access: 'paid' },
    { name: 'NHL.TV', platform: 'stream', access: 'paid' }
  ],
  ufc: [
    { name: 'UFC Fight Pass', platform: 'stream', access: 'paid' },
    { name: 'Discovery+', platform: 'stream', access: 'paid' }
  ]
};

const MAJOR_FREE_KEYWORDS = [
  'olympic',
  'olympisch',
  'wereldkampioenschap',
  'world cup',
  'wk',
  'europees kampioenschap',
  'european championship',
  'ek',
  'davis cup',
  'billie jean king',
  'nederland',
  'team nl',
  'teamnl'
];

const soccerFeeds = [
  {
    slug: 'ned.1',
    sport: 'voetbal',
    competition: 'Eredivisie',
    channels: CHANNEL_PRESETS.espn,
    note: 'Automatisch opgehaald. Controleer exacte zenderindeling op wedstrijddag.'
  },
  {
    slug: 'ned.cup',
    sport: 'voetbal',
    competition: 'KNVB Beker',
    channels: CHANNEL_PRESETS.espn,
    note: 'Automatisch opgehaald. Bekerrechten kunnen per ronde verschillen.'
  },
  {
    slug: 'uefa.champions',
    sport: 'voetbal',
    competition: 'UEFA Champions League',
    channels: CHANNEL_PRESETS.ziggo,
    note: 'Automatisch opgehaald. Nederlandse rechten kunnen wijzigen.'
  },
  {
    slug: 'uefa.europa',
    sport: 'voetbal',
    competition: 'UEFA Europa League',
    channels: CHANNEL_PRESETS.ziggo,
    note: 'Automatisch opgehaald. Nederlandse rechten kunnen wijzigen.'
  },
  {
    slug: 'fifa.worldq.uefa',
    sport: 'voetbal',
    competition: 'WK kwalificatie UEFA',
    channels: mergeChannels(CHANNEL_PRESETS.npoTv, CHANNEL_PRESETS.ziggo),
    note: 'Automatisch opgehaald. Uitzendrechten verschillen per wedstrijd en land.',
    forceNos: true
  }
];

const f1Feeds = [
  {
    slug: 'f1',
    sport: 'formule-1',
    competition: 'FIA Formula 1 World Championship',
    channels: CHANNEL_PRESETS.viaplay,
    note: 'Automatisch opgehaald. Controleer de uitzending voor race/kwalificatie/sprint.'
  }
];

const tennisFeeds = [
  {
    slug: 'atp',
    sport: 'tennis',
    competition: 'ATP',
    channels: CHANNEL_PRESETS.eurosport,
    note: 'Automatisch opgehaald. Beschikbaarheid verschilt per toernooi.',
    forceNos: true
  },
  {
    slug: 'wta',
    sport: 'tennis',
    competition: 'WTA',
    channels: CHANNEL_PRESETS.eurosport,
    note: 'Automatisch opgehaald. Beschikbaarheid verschilt per toernooi.',
    forceNos: true
  }
];

const teamSportFeeds = [
  {
    sport: 'basketbal',
    path: 'basketball/nba',
    feedSlug: 'nba',
    competition: 'NBA',
    channels: CHANNEL_PRESETS.ziggo,
    note: 'Automatisch opgehaald. Nederlandse tv/streamrechten kunnen wijzigen.'
  },
  {
    sport: 'honkbal',
    path: 'baseball/mlb',
    feedSlug: 'mlb',
    competition: 'MLB',
    channels: CHANNEL_PRESETS.mlb,
    note: 'Automatisch opgehaald. Nederlandse tv/streamrechten kunnen wijzigen.'
  },
  {
    sport: 'ijshockey',
    path: 'hockey/nhl',
    feedSlug: 'nhl',
    competition: 'NHL',
    channels: CHANNEL_PRESETS.nhl,
    note: 'Automatisch opgehaald. Nederlandse tv/streamrechten kunnen wijzigen.'
  }
];

const namedFeeds = [
  {
    sport: 'golf',
    path: 'golf/pga',
    feedSlug: 'pga',
    competition: 'PGA Tour',
    channels: CHANNEL_PRESETS.ziggo,
    note: 'Automatisch opgehaald. Nederlandse tv/streamrechten kunnen wijzigen.',
    forceNos: true
  },
  {
    sport: 'golf',
    path: 'golf/lpga',
    feedSlug: 'lpga',
    competition: 'LPGA',
    channels: CHANNEL_PRESETS.ziggo,
    note: 'Automatisch opgehaald. Nederlandse tv/streamrechten kunnen wijzigen.',
    forceNos: true
  },
  {
    sport: 'vechtsport',
    path: 'mma/ufc',
    feedSlug: 'ufc',
    competition: 'UFC',
    channels: CHANNEL_PRESETS.ufc,
    note: 'Automatisch opgehaald. Nederlandse tv/streamrechten kunnen wijzigen.'
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

function mergeChannels(...channelLists) {
  const seen = new Set();
  const merged = [];

  channelLists.flat().forEach((channel) => {
    const key = `${channel.name}|${channel.platform}|${channel.access}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(channel);
    }
  });

  return merged;
}

function shouldAddNosChannels(feed, title, competition) {
  if (feed.forceNos) {
    return true;
  }

  if (!feed.addNosForMajors) {
    return false;
  }

  const haystack = `${title} ${competition}`.toLowerCase();
  return MAJOR_FREE_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function channelsForEvent(feed, title, competition) {
  if (shouldAddNosChannels(feed, title, competition)) {
    return mergeChannels(feed.channels, CHANNEL_PRESETS.nos);
  }
  return feed.channels;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'sportkijken-data-updater',
        Accept: 'application/json'
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

function parseTeamEvent(event, feed, idPrefix) {
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
  const channels = channelsForEvent(feed, title, feed.competition);

  return {
    id: `${idPrefix}-${feed.feedSlug || feed.slug}-${event.id}`,
    sport: feed.sport,
    title,
    competition: feed.competition,
    start: isoStart,
    durationMinutes: feed.durationMinutes || 130,
    location,
    channels,
    notes: feed.note
  };
}

function parseF1Event(event, feed) {
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

  const title = event.shortName || event.name || feed.competition;
  const channels = channelsForEvent(feed, title, feed.competition);

  return {
    id: `${feed.sport}-${event.id}`,
    sport: feed.sport,
    title,
    competition: feed.competition,
    start: isoStart,
    durationMinutes,
    location,
    channels,
    notes: feed.note
  };
}

function extractNamedVenue(event) {
  if (event.venue?.displayName) {
    return event.venue.displayName;
  }

  if (event.venues?.[0]) {
    return locationFromAddress(event.venues[0].address, event.venues[0].fullName || event.venues[0].displayName);
  }

  const competition = event.competitions?.[0];
  if (competition?.venue) {
    return locationFromAddress(competition.venue.address, competition.venue.fullName || competition.venue.displayName);
  }

  return 'Onbekend';
}

function parseNamedEvent(event, feed) {
  const isoStart = tryIso(event.date);
  if (!isoStart || !isWithinWindow(isoStart)) {
    return null;
  }

  const statusState = event.status?.type?.state;
  if (statusState === 'post') {
    return null;
  }

  const title = event.shortName || event.name || feed.competition;
  const channels = channelsForEvent(feed, title, feed.competition);

  return {
    id: `${feed.sport}-${feed.feedSlug}-${event.id}`,
    sport: feed.sport,
    title,
    competition: feed.competition,
    start: isoStart,
    durationMinutes: feed.durationMinutes || 180,
    location: extractNamedVenue(event),
    channels,
    notes: feed.note
  };
}

async function fetchByFeeds(feeds, urlBuilder, parser, errorPrefix, idPrefix) {
  const allEvents = [];
  const sources = [];
  const errors = [];

  for (const feed of feeds) {
    const url = urlBuilder(feed);
    sources.push(url);
    try {
      const data = await fetchJson(url);
      const parsed = (data.events || [])
        .map((event) => parser(event, feed, idPrefix))
        .filter(Boolean);
      allEvents.push(...parsed);
    } catch (error) {
      errors.push(`${errorPrefix} ${feed.feedSlug || feed.slug}: ${error.message}`);
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

const football = await fetchByFeeds(
  soccerFeeds,
  (feed) => `https://site.api.espn.com/apis/site/v2/sports/soccer/${feed.slug}/scoreboard?dates=${DATE_RANGE}`,
  parseTeamEvent,
  'Voetbal',
  'voetbal'
);

const f1 = await fetchByFeeds(
  f1Feeds,
  (feed) => `https://site.api.espn.com/apis/site/v2/sports/racing/${feed.slug}/scoreboard?dates=${DATE_RANGE}`,
  parseF1Event,
  'Formule 1',
  'formule-1'
);

const tennis = await fetchByFeeds(
  tennisFeeds,
  (feed) => `https://site.api.espn.com/apis/site/v2/sports/tennis/${feed.slug}/scoreboard?dates=${DATE_RANGE}`,
  parseNamedEvent,
  'Tennis',
  'tennis'
);

const teamSports = await fetchByFeeds(
  teamSportFeeds,
  (feed) => `https://site.api.espn.com/apis/site/v2/sports/${feed.path}/scoreboard?dates=${DATE_RANGE}`,
  parseTeamEvent,
  'Teamsport',
  'teamsport'
);

const namedSports = await fetchByFeeds(
  namedFeeds,
  (feed) => `https://site.api.espn.com/apis/site/v2/sports/${feed.path}/scoreboard?dates=${DATE_RANGE}`,
  parseNamedEvent,
  'Evenement',
  'event'
);

const fetchErrors = [
  ...football.errors,
  ...f1.errors,
  ...tennis.errors,
  ...teamSports.errors,
  ...namedSports.errors
];

if (fetchErrors.length) {
  console.warn(`Partial fetch issues: ${fetchErrors.join(' | ')}`);
}

const mergedEvents = dedupeEvents([
  ...football.events,
  ...f1.events,
  ...tennis.events,
  ...teamSports.events,
  ...namedSports.events
]).slice(0, MAX_EVENTS);

if (!mergedEvents.length) {
  throw new Error('No events fetched; aborting dataset overwrite.');
}

const nextDataset = normalizeDataset({
  generatedAt: new Date().toISOString(),
  region: 'NL',
  isDemo: false,
  sources: [...football.sources, ...f1.sources, ...tennis.sources, ...teamSports.sources, ...namedSports.sources],
  events: mergedEvents
});

const previousEvents = previous && Array.isArray(previous.events) ? previous.events : null;
if (previousEvents && JSON.stringify(previousEvents) === JSON.stringify(nextDataset.events)) {
  console.log('No event changes detected; keeping current dataset.');
  process.exit(0);
}

await writeFile(datasetPath, `${JSON.stringify(nextDataset, null, 2)}\n`, 'utf8');
console.log(`Updated dataset with ${nextDataset.events.length} events.`);
