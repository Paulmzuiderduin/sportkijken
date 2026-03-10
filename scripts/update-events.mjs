import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeDataset } from './dataset-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const datasetPath = resolve(__dirname, '../src/data/events.nl.json');
const majorEventsPath = resolve(__dirname, '../src/data/major-events.nl.json');
const overridesPath = resolve(__dirname, '../src/data/event-overrides.nl.json');

const NOW = new Date();
const windowStart = new Date(NOW.getTime() - 4 * 60 * 60 * 1000);
const windowEnd = new Date(NOW.getTime() + 75 * 24 * 60 * 60 * 1000);
const RANGE_START = formatDateForApi(windowStart);
const RANGE_END = formatDateForApi(windowEnd);
const DATE_RANGE = `${RANGE_START}-${RANGE_END}`;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_EVENTS = 360;
const NOS_SPORT_URL = 'https://nos.nl/sport';
const VERIFY_LEVELS = ['confirmed', 'likely', 'unverified'];

const CHANNEL_PRESETS = {
  espn: [
    {
      name: 'ESPN',
      platform: 'tv',
      access: 'free',
      url: 'https://www.espn.nl/',
      conditions: 'Gratis voor KPN-klanten met geschikt tv-pakket.'
    },
    { name: 'ESPN Watch', platform: 'stream', access: 'paid', url: 'https://www.espn.nl/watch/' }
  ],
  ziggo: [
    {
      name: 'Ziggo Sport',
      platform: 'tv',
      access: 'free',
      url: 'https://www.ziggosport.nl/',
      conditions: 'Gratis voor Ziggo-klanten met geschikt tv-pakket.'
    },
    {
      name: 'Ziggo GO',
      platform: 'stream',
      access: 'paid',
      url: 'https://www.ziggogo.tv/nl/home',
      conditions: 'Inloggen met Ziggo-account vereist.'
    }
  ],
  viaplay: [
    { name: 'Viaplay TV', platform: 'tv', access: 'paid', url: 'https://viaplay.com/nl-nl/' },
    { name: 'Viaplay', platform: 'stream', access: 'paid', url: 'https://viaplay.com/nl-nl/sport' }
  ],
  eurosport: [
    { name: 'Eurosport', platform: 'tv', access: 'paid', url: 'https://www.eurosport.nl/' },
    { name: 'HBO Max', platform: 'stream', access: 'paid', url: 'https://www.max.com/nl/' }
  ],
  nos: [
    { name: 'NOS.nl Live', platform: 'stream', access: 'free', url: 'https://nos.nl/live' },
    { name: 'NPO Start', platform: 'stream', access: 'free', url: 'https://www.npostart.nl/live' }
  ],
  npoTv: [
    { name: 'NPO 1', platform: 'tv', access: 'free', url: 'https://www.npostart.nl/live/npo-1' },
    { name: 'NPO 2', platform: 'tv', access: 'free', url: 'https://www.npostart.nl/live/npo-2' },
    { name: 'NPO 3', platform: 'tv', access: 'free', url: 'https://www.npostart.nl/live/npo-3' },
    { name: 'NPO Start', platform: 'stream', access: 'free', url: 'https://www.npostart.nl/live' }
  ],
  npoNosFull: [
    { name: 'NPO 1', platform: 'tv', access: 'free', url: 'https://www.npostart.nl/live/npo-1' },
    { name: 'NPO 2', platform: 'tv', access: 'free', url: 'https://www.npostart.nl/live/npo-2' },
    { name: 'NPO 3', platform: 'tv', access: 'free', url: 'https://www.npostart.nl/live/npo-3' },
    { name: 'NPO Start', platform: 'stream', access: 'free', url: 'https://www.npostart.nl/live' },
    { name: 'NOS.nl Live', platform: 'stream', access: 'free', url: 'https://nos.nl/live' }
  ],
  mlb: [
    { name: 'ESPN 4', platform: 'tv', access: 'paid', url: 'https://www.espn.nl/' },
    { name: 'MLB.TV', platform: 'stream', access: 'paid', url: 'https://www.mlb.com/live-stream-games' }
  ],
  nfl: [
    { name: 'NFL Game Pass', platform: 'stream', access: 'paid', url: 'https://www.dazn.com/nl-NL/competition/Competition:1yf5v6n6j5ok3x5s6xqq6v9ha' },
    { name: 'ESPN 4', platform: 'tv', access: 'paid', url: 'https://www.espn.nl/' },
    { name: 'DAZN', platform: 'stream', access: 'paid', url: 'https://www.dazn.com/nl-NL/home' }
  ],
  wnba: [
    { name: 'Ziggo Sport', platform: 'tv', access: 'paid', url: 'https://www.ziggosport.nl/' },
    { name: 'WNBA League Pass', platform: 'stream', access: 'paid', url: 'https://www.wnba.com/leaguepass/' },
    { name: 'ESPN Watch', platform: 'stream', access: 'paid', url: 'https://www.espn.nl/watch/' }
  ],
  nhl: [
    { name: 'Viaplay TV', platform: 'tv', access: 'paid', url: 'https://viaplay.com/nl-nl/' },
    { name: 'NHL.TV', platform: 'stream', access: 'paid', url: 'https://www.nhl.com/info/where-to-stream' }
  ],
  ufc: [
    { name: 'UFC Fight Pass', platform: 'stream', access: 'paid', url: 'https://ufcfightpass.com/' },
    { name: 'Discovery+', platform: 'stream', access: 'paid', url: 'https://www.discoveryplus.com/nl/' }
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

const DUTCH_CLUB_KEYWORDS = [
  'ajax',
  'psv',
  'feyenoord',
  'az alkmaar',
  'az ',
  'fc twente',
  'twente',
  'fc utrecht',
  'utrecht',
  'go ahead eagles',
  'nec',
  'vitesse',
  'willem ii'
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
    note: 'Automatisch opgehaald. Europese wedstrijden van Nederlandse clubs zijn via Ziggo GO te volgen.',
    allowDutchClubZiggoGoFree: true
  },
  {
    slug: 'uefa.europa',
    sport: 'voetbal',
    competition: 'UEFA Europa League',
    channels: CHANNEL_PRESETS.ziggo,
    note: 'Automatisch opgehaald. Europese wedstrijden van Nederlandse clubs zijn via Ziggo GO te volgen.',
    allowDutchClubZiggoGoFree: true
  },
  {
    slug: 'uefa.europa.conf',
    sport: 'voetbal',
    competition: 'UEFA Conference League',
    channels: CHANNEL_PRESETS.ziggo,
    note: 'Automatisch opgehaald. Europese wedstrijden van Nederlandse clubs zijn via Ziggo GO te volgen.',
    allowDutchClubZiggoGoFree: true
  },
  {
    slug: 'uefa.nations',
    sport: 'voetbal',
    competition: 'UEFA Nations League',
    channels: mergeChannels(CHANNEL_PRESETS.ziggo, CHANNEL_PRESETS.npoTv),
    note: 'Automatisch opgehaald. Uitzendrechten kunnen per wedstrijd verschillen.',
    addNosForMajors: true
  },
  {
    slug: 'fifa.worldq.uefa',
    sport: 'voetbal',
    competition: 'WK kwalificatie UEFA',
    channels: mergeChannels(CHANNEL_PRESETS.npoNosFull, CHANNEL_PRESETS.ziggo),
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
    addNosForMajors: true
  },
  {
    slug: 'wta',
    sport: 'tennis',
    competition: 'WTA',
    channels: CHANNEL_PRESETS.eurosport,
    note: 'Automatisch opgehaald. Beschikbaarheid verschilt per toernooi.',
    addNosForMajors: true
  }
];

const teamSportFeeds = [
  {
    sport: 'basketbal',
    path: 'basketball/nba',
    feedSlug: 'nba',
    competition: 'NBA',
    channels: mergeChannels(CHANNEL_PRESETS.ziggo, [{ name: 'NBA League Pass', platform: 'stream', access: 'paid' }]),
    note: 'Automatisch opgehaald. Nederlandse tv/streamrechten kunnen wijzigen.'
  },
  {
    sport: 'basketbal',
    path: 'basketball/wnba',
    feedSlug: 'wnba',
    competition: 'WNBA',
    channels: CHANNEL_PRESETS.wnba,
    note: 'Automatisch opgehaald. Nederlandse tv/streamrechten kunnen wijzigen.'
  },
  {
    sport: 'american-football',
    path: 'football/nfl',
    feedSlug: 'nfl',
    competition: 'NFL',
    channels: CHANNEL_PRESETS.nfl,
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
    note: 'Automatisch opgehaald. Nederlandse tv/streamrechten kunnen wijzigen.'
  },
  {
    sport: 'golf',
    path: 'golf/lpga',
    feedSlug: 'lpga',
    competition: 'LPGA',
    channels: CHANNEL_PRESETS.ziggo,
    note: 'Automatisch opgehaald. Nederlandse tv/streamrechten kunnen wijzigen.'
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

function shouldMarkDutchClubUefaMatchOnZiggoGo(feed, title, competition) {
  if (!feed.allowDutchClubZiggoGoFree) {
    return false;
  }

  const haystack = `${title} ${competition}`.toLowerCase();
  return DUTCH_CLUB_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function markZiggoGoFreeForDutchClubs(channels) {
  return channels.map((channel) => {
    if (channel.name !== 'Ziggo GO') {
      return channel;
    }

    return {
      ...channel,
      access: 'free',
      conditions: 'Europese wedstrijden van Nederlandse clubs zijn vrij te volgen via Ziggo GO.'
    };
  });
}

function channelsForEvent(feed, title, competition) {
  let channels = feed.channels;

  if (shouldMarkDutchClubUefaMatchOnZiggoGo(feed, title, competition)) {
    channels = markZiggoGoFreeForDutchClubs(channels);
  }

  if (shouldAddNosChannels(feed, title, competition)) {
    return mergeChannels(channels, CHANNEL_PRESETS.npoNosFull);
  }

  return channels;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'sportkijken-data-updater',
        Accept: 'text/html,application/xhtml+xml'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
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

function createSourceRef(label, url, type) {
  if (!url) {
    return null;
  }
  return { label, url, type };
}

function mergeSourceRefs(...lists) {
  const merged = [];
  const seen = new Set();

  lists
    .flat()
    .filter(Boolean)
    .forEach((ref) => {
      const key = `${ref.type || 'unknown'}|${ref.url}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      merged.push(ref);
    });

  return merged;
}

function dedupeEvents(events) {
  const byId = new Map();
  events.forEach((event) => {
    const existing = byId.get(event.id);
    if (!existing) {
      byId.set(event.id, event);
      return;
    }

    byId.set(event.id, {
      ...existing,
      ...event,
      channels: mergeChannels(existing.channels || [], event.channels || []),
      sourceRefs: mergeSourceRefs(existing.sourceRefs || [], event.sourceRefs || []),
      sourceType: existing.sourceType === event.sourceType ? existing.sourceType : (event.sourceType || existing.sourceType || 'mixed')
    });
  });
  return [...byId.values()].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' en ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mapNosSport(item) {
  const categories = Array.isArray(item.categories) ? item.categories : [];
  const categoryLabels = categories
    .map((category) => category?.label || category?.name)
    .filter(Boolean);

  const haystack = `${item.title || ''} ${categoryLabels.join(' ')}`.toLowerCase();

  if (haystack.includes('formule 1') || haystack.includes('f1')) return 'formule-1';
  if (haystack.includes('voetbal')) return 'voetbal';
  if (haystack.includes('tennis')) return 'tennis';
  if (haystack.includes('basketbal')) return 'basketbal';
  if (haystack.includes('american football') || haystack.includes('nfl')) return 'american-football';
  if (haystack.includes('honkbal') || haystack.includes('baseball')) return 'honkbal';
  if (haystack.includes('ijshockey') || haystack.includes('ice hockey')) return 'ijshockey';
  if (haystack.includes('golf')) return 'golf';
  if (haystack.includes('ufc') || haystack.includes('mma') || haystack.includes('boksen')) return 'vechtsport';

  const fallback = categoryLabels[0] || item.title || 'sport';
  return slugify(fallback) || 'sport';
}

function parseNosNextData(rawHtml) {
  const match = rawHtml.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    return null;
  }
  return safeParseJson(match[1]);
}

function parseNosLivestreamEvent(item, fallbackUrl) {
  if (!item || item.type !== 'livestream') {
    return null;
  }

  const isSportOwner = item.owner === 'sport';
  const hasSportCategory = Array.isArray(item.categories)
    && item.categories.some((category) => category?.mainCategory === 'sport');
  if (!isSportOwner && !hasSportCategory) {
    return null;
  }

  const start = tryIso(item.livestream?.startAt || item.publishedAt);
  if (!start || !isWithinWindow(start)) {
    return null;
  }

  const end = tryIso(item.livestream?.endAt);
  let durationMinutes = 150;
  if (end) {
    const diffMinutes = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    if (diffMinutes > 10) {
      durationMinutes = diffMinutes;
    }
  }

  const title = item.title || 'NOS Sport livestream';
  const competition = title.includes(':') ? title.split(':')[0].trim() : 'NOS Sport';
  const url = item.url || fallbackUrl;

  return {
    id: `nos-livestream-${item.id}`,
    sport: mapNosSport(item),
    title,
    competition,
    start,
    durationMinutes,
    location: 'Online (NOS)',
    channels: [
      { name: 'NOS.nl Live', platform: 'stream', access: 'free', url },
      { name: 'NPO Start', platform: 'stream', access: 'free', url: 'https://www.npostart.nl/live' }
    ],
    notes: 'Automatisch opgehaald van NOS sport-livestreams.',
    sourceType: 'nos',
    sourceRefs: [createSourceRef('NOS livestream', url, 'nos')].filter(Boolean)
  };
}

async function fetchNosSportLivestreams() {
  const sources = [NOS_SPORT_URL];
  const errors = [];
  const events = [];

  let sportHtml = null;
  try {
    sportHtml = await fetchText(NOS_SPORT_URL);
  } catch (error) {
    return {
      events,
      sources,
      errors: [`NOS sport: ${error.message}`]
    };
  }

  const livestreamPaths = [...new Set(sportHtml.match(/\/livestream\/[0-9][^"' <]*/g) || [])].slice(0, 24);

  for (const path of livestreamPaths) {
    const url = path.startsWith('http') ? path : `https://nos.nl${path}`;
    sources.push(url);

    try {
      const html = await fetchText(url);
      const nextData = parseNosNextData(html);
      const item = nextData?.props?.pageProps?.data;
      const parsed = parseNosLivestreamEvent(item, url);
      if (parsed) {
        events.push(parsed);
      }
    } catch (error) {
      errors.push(`NOS livestream ${path}: ${error.message}`);
    }
  }

  return { events, sources, errors };
}

function parseTeamEvent(event, feed, idPrefix, sourceUrl) {
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
    notes: feed.note,
    sourceType: 'espn',
    sourceRefs: [createSourceRef('ESPN scoreboard', sourceUrl, 'espn')].filter(Boolean)
  };
}

function parseF1Event(event, feed, _idPrefix, sourceUrl) {
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
    notes: feed.note,
    sourceType: 'espn',
    sourceRefs: [createSourceRef('ESPN scoreboard', sourceUrl, 'espn')].filter(Boolean)
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

function parseNamedEvent(event, feed, _idPrefix, sourceUrl) {
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
    notes: feed.note,
    sourceType: 'espn',
    sourceRefs: [createSourceRef('ESPN scoreboard', sourceUrl, 'espn')].filter(Boolean)
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
        .map((event) => parser(event, feed, idPrefix, url))
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

function normalizeManualEvents(events) {
  return (Array.isArray(events) ? events : [])
    .filter((event) => {
      const isoStart = tryIso(event.start);
      return isoStart && isWithinWindow(isoStart);
    })
    .map((event) => ({
      ...event,
      sourceType: event.sourceType || 'manual',
      sourceRefs: mergeSourceRefs(
        event.sourceRefs || [],
        [createSourceRef('Handmatige invoer', 'src/data/major-events.nl.json', 'manual')]
      )
    }));
}

function normalizeOverrideRules(parsed) {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && Array.isArray(parsed.rules)) {
    return parsed.rules;
  }
  return [];
}

function includesAnyNeedle(value, needles) {
  const haystack = String(value || '').toLowerCase();
  const list = Array.isArray(needles) ? needles : [needles];
  return list.some((needle) => haystack.includes(String(needle || '').toLowerCase()));
}

function matchesOverrideRule(event, rule) {
  const match = rule?.match || {};

  if (match.id && event.id !== match.id) return false;
  if (match.sport && event.sport !== match.sport) return false;
  if (match.sourceType && event.sourceType !== match.sourceType) return false;
  if (match.provider && !event.channels?.some((channel) => channel.name === match.provider)) return false;
  if (match.competitionIncludes && !includesAnyNeedle(event.competition, match.competitionIncludes)) return false;
  if (match.titleIncludes && !includesAnyNeedle(event.title, match.titleIncludes)) return false;

  return true;
}

function applyOverrideToEvent(event, rule) {
  const set = rule?.set || {};
  const next = { ...event };

  if (set.channels) {
    next.channels = set.channels;
  }
  if (set.appendChannels) {
    next.channels = mergeChannels(next.channels || [], set.appendChannels);
  }
  if (typeof set.notes === 'string') {
    next.notes = set.notes;
  }
  if (typeof set.competition === 'string') {
    next.competition = set.competition;
  }
  if (typeof set.location === 'string') {
    next.location = set.location;
  }
  if (set.sourceType) {
    next.sourceType = set.sourceType;
  }
  if (set.sourceRefs) {
    next.sourceRefs = mergeSourceRefs(next.sourceRefs || [], set.sourceRefs);
  }
  if (set.verification) {
    next.verification = {
      ...(next.verification || {}),
      ...set.verification
    };
  }

  return next;
}

function applyOverrides(events, rules) {
  if (!rules.length) {
    return events;
  }

  return events.map((event) => {
    let next = event;
    rules.forEach((rule) => {
      if (matchesOverrideRule(next, rule)) {
        next = applyOverrideToEvent(next, rule);
      }
    });
    return next;
  });
}

function sourcePriorityForEvent(event) {
  const baseByType = {
    manual: 100,
    nos: 92,
    mixed: 85,
    espn: 70,
    unknown: 60
  };

  const base = baseByType[event.sourceType] || baseByType.unknown;
  const competition = String(event.competition || '').toLowerCase();
  const hasConditionalRule = (event.channels || []).some((channel) => channel.conditions);

  if (competition.includes('uefa') && hasConditionalRule) {
    return Math.min(100, base + 4);
  }

  return base;
}

function inferVerification(event, generatedAt) {
  const provided = event.verification || {};
  if (VERIFY_LEVELS.includes(provided.confidence)) {
    return {
      confidence: provided.confidence,
      reason: provided.reason || 'Handmatig geverifieerd.',
      lastVerified: generatedAt,
      priority: sourcePriorityForEvent(event)
    };
  }

  const sourceTypes = new Set([
    event.sourceType,
    ...(event.sourceRefs || []).map((ref) => ref.type).filter(Boolean)
  ]);
  const hasConditions = (event.channels || []).some((channel) => channel.conditions);

  if (sourceTypes.has('manual')) {
    return {
      confidence: 'confirmed',
      reason: 'Handmatig toegevoegd of bevestigd.',
      lastVerified: generatedAt,
      priority: sourcePriorityForEvent(event)
    };
  }

  if (sourceTypes.has('nos') && sourceTypes.has('espn')) {
    return {
      confidence: 'confirmed',
      reason: 'Gecontroleerd via meerdere bronnen (NOS + externe feed).',
      lastVerified: generatedAt,
      priority: sourcePriorityForEvent(event)
    };
  }

  if (sourceTypes.has('nos')) {
    return {
      confidence: 'confirmed',
      reason: 'Direct van NOS livestreambron.',
      lastVerified: generatedAt,
      priority: sourcePriorityForEvent(event)
    };
  }

  if (sourceTypes.has('espn') && hasConditions) {
    return {
      confidence: 'likely',
      reason: 'Externe wedstrijdfeed met NL-rechtenregels toegepast.',
      lastVerified: generatedAt,
      priority: sourcePriorityForEvent(event)
    };
  }

  if (sourceTypes.has('espn')) {
    return {
      confidence: 'unverified',
      reason: 'Externe wedstrijdfeed; controleer aanbieder op wedstrijddag.',
      lastVerified: generatedAt,
      priority: sourcePriorityForEvent(event)
    };
  }

  return {
    confidence: 'likely',
    reason: 'Automatisch samengesteld uit beschikbare bronnen.',
    lastVerified: generatedAt,
    priority: sourcePriorityForEvent(event)
  };
}

function finalizeVerification(events, generatedAt) {
  return events.map((event) => ({
    ...event,
    sourceRefs: mergeSourceRefs(event.sourceRefs || []),
    verification: inferVerification(event, generatedAt)
  }));
}

const previousRaw = await readFile(datasetPath, 'utf8').catch(() => null);
const previous = previousRaw ? safeParseJson(previousRaw) : null;
const manualRaw = await readFile(majorEventsPath, 'utf8').catch(() => '[]');
const manualParsed = safeParseJson(manualRaw);
const manualEvents = normalizeManualEvents(manualParsed);
const overridesRaw = await readFile(overridesPath, 'utf8').catch(() => '[]');
const overrideRules = normalizeOverrideRules(safeParseJson(overridesRaw));

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

const nosSportLivestreams = await fetchNosSportLivestreams();

const fetchErrors = [
  ...football.errors,
  ...f1.errors,
  ...tennis.errors,
  ...teamSports.errors,
  ...namedSports.errors,
  ...nosSportLivestreams.errors
];

if (fetchErrors.length) {
  console.warn(`Partial fetch issues: ${fetchErrors.join(' | ')}`);
}

const mergedEvents = dedupeEvents([
  ...football.events,
  ...f1.events,
  ...tennis.events,
  ...teamSports.events,
  ...namedSports.events,
  ...nosSportLivestreams.events,
  ...manualEvents
]);

const overriddenEvents = applyOverrides(mergedEvents, overrideRules);
const generatedAt = new Date().toISOString();
const verifiedEvents = finalizeVerification(overriddenEvents, generatedAt).slice(0, MAX_EVENTS);

if (!verifiedEvents.length) {
  throw new Error('No events fetched; aborting dataset overwrite.');
}

const nextDataset = normalizeDataset({
  generatedAt,
  region: 'NL',
  isDemo: false,
  sources: [
    ...football.sources,
    ...f1.sources,
    ...tennis.sources,
    ...teamSports.sources,
    ...namedSports.sources,
    ...nosSportLivestreams.sources,
    'manual:src/data/major-events.nl.json',
    'manual:src/data/event-overrides.nl.json'
  ],
  events: verifiedEvents
});

const previousEvents = previous && Array.isArray(previous.events) ? previous.events : null;
if (previousEvents && JSON.stringify(previousEvents) === JSON.stringify(nextDataset.events)) {
  console.log('No event changes detected; keeping current dataset.');
  process.exit(0);
}

await writeFile(datasetPath, `${JSON.stringify(nextDataset, null, 2)}\n`, 'utf8');
console.log(`Updated dataset with ${nextDataset.events.length} events.`);
