import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeDataset } from './dataset-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const datasetPath = resolve(__dirname, '../src/data/events.nl.json');
const majorEventsPath = resolve(__dirname, '../src/data/major-events.nl.json');
const overridesPath = resolve(__dirname, '../src/data/event-overrides.nl.json');
const providerRulesPath = resolve(__dirname, './provider-rules.nl.json');

const NOW = new Date();
const windowStart = new Date(NOW.getTime() - 4 * 60 * 60 * 1000);
const windowEnd = new Date(NOW.getTime() + 75 * 24 * 60 * 60 * 1000);
const RANGE_START = formatDateForApi(windowStart);
const RANGE_END = formatDateForApi(windowEnd);
const DATE_RANGE = `${RANGE_START}-${RANGE_END}`;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_EVENTS = Number(process.env.MAX_EVENTS || 700);
const NOS_SPORT_URL = 'https://nos.nl/sport';
const HBO_MAX_SPORTS_URL = 'https://www.hbomax.com/nl/nl/sports';
const NOS_LIVESTREAM_LIMIT = 120;
const ZIGGO_EPG_BASE_URL = 'https://www.ziggosport.nl/cache/site/ZiggosportNL/json/epg';
const ESPN_SCHEDULE_BASE_URL = 'https://www.espn.nl/watch/speelkalender/_/type/upcoming';
const ZIGGO_EPG_LOOKAHEAD_DAYS = 30;
const ESPN_SCHEDULE_LOOKAHEAD_DAYS = 28;
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
    { name: 'HBO Max', platform: 'stream', access: 'paid', url: 'https://www.hbomax.com/nl/nl/sports' }
  ],
  hboMax: [
    { name: 'HBO Max', platform: 'stream', access: 'paid', url: 'https://www.hbomax.com/nl/nl/sports' },
    { name: 'Eurosport', platform: 'tv', access: 'paid', url: 'https://www.eurosport.nl/' }
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

const DEFAULT_DUTCH_CLUB_KEYWORDS = [
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

const PROVIDER_RULES = await loadProviderRules(providerRulesPath);
const DUTCH_CLUB_KEYWORDS = Array.isArray(PROVIDER_RULES.dutchClubKeywords) && PROVIDER_RULES.dutchClubKeywords.length
  ? PROVIDER_RULES.dutchClubKeywords
  : DEFAULT_DUTCH_CLUB_KEYWORDS;
const ZIGGO_RULES = PROVIDER_RULES.ziggo || {};
const ESPN_RULES = PROVIDER_RULES.espn || {};

const TITLE_NOISE_WORDS = new Set([
  'live',
  'samenvatting',
  'highlights',
  'voorbeschouwing',
  'nabeschouwing',
  'studio',
  'herhaling',
  'sport',
  'voetbal',
  'wedstrijd',
  'match',
  'mannen',
  'vrouwen'
]);

const TEAM_NOISE_WORDS = new Set([
  'fc',
  'cf',
  'ac',
  'as',
  'sc',
  'sv',
  'club',
  'team',
  'the',
  'de',
  'het',
  'united',
  'women',
  'vrouwen'
]);

const SCHEDULE_ONLY_SKIP_KEYWORDS = [
  'samenvatting',
  'hoogtepunten',
  'highlights',
  'herhaling',
  'voorbeschouwing',
  'nabeschouwing',
  'dossier',
  'vandaag',
  'espn vandaag',
  'top 25 goals',
  'sportscenter',
  'today',
  'praat',
  'insights',
  'on the fly',
  'the iconic',
  'the rising',
  'dream team',
  'football nations',
  'greatest stage',
  'switch',
  'matchday',
  'rondo',
  'heldinnen',
  'zolder van',
  'race cafe',
  'this week',
  'preview',
  'tekengeld',
  'classic match',
  'on the range',
  'ahora o nunca',
  'rich eisen show',
  'the rich eisen show',
  'adios rafa',
  'film',
  'documentaire'
];

const SCHEDULE_ONLY_EVENT_KEYWORDS = [
  'grand prix',
  'kampioenschap',
  'championship',
  'world cup',
  'wereldkampioenschap',
  'olympisch',
  'olympic',
  'paralymp',
  'ek ',
  'wk ',
  ' kwalificatie',
  ' qualification',
  'open',
  'masters',
  'beker',
  'cup',
  'finale',
  'semi-finale',
  'semifinal',
  'kwartfinale',
  'quarterfinal',
  'race',
  'etappe',
  'stage'
];

const BROADCAST_RECAP_KEYWORDS = [
  'samenvatting',
  'hoogtepunten',
  'highlights',
  'recap',
  'terugblik'
];

const BROADCAST_GENERAL_KEYWORDS = [
  'sportjournaal',
  'studio sport',
  'nabeschouwing',
  'voorbeschouwing'
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
    slug: 'ned.2',
    sport: 'voetbal',
    competition: 'Keuken Kampioen Divisie',
    channels: CHANNEL_PRESETS.espn,
    note: 'Automatisch opgehaald. Beschikbaarheid op ESPN-kanalen kan per speelronde verschillen.'
  },
  {
    slug: 'eng.1',
    sport: 'voetbal',
    competition: 'Premier League',
    channels: CHANNEL_PRESETS.viaplay,
    note: 'Automatisch opgehaald. In Nederland primair via Viaplay.'
  },
  {
    slug: 'esp.1',
    sport: 'voetbal',
    competition: 'La Liga',
    channels: CHANNEL_PRESETS.ziggo,
    note: 'Automatisch opgehaald. In Nederland primair via Ziggo Sport/Ziggo GO.'
  },
  {
    slug: 'ita.1',
    sport: 'voetbal',
    competition: 'Serie A',
    channels: CHANNEL_PRESETS.ziggo,
    note: 'Automatisch opgehaald. In Nederland primair via Ziggo Sport/Ziggo GO.'
  },
  {
    slug: 'ger.1',
    sport: 'voetbal',
    competition: 'Bundesliga',
    channels: CHANNEL_PRESETS.viaplay,
    note: 'Automatisch opgehaald. In Nederland primair via Viaplay.'
  },
  {
    slug: 'fra.1',
    sport: 'voetbal',
    competition: 'Ligue 1',
    channels: CHANNEL_PRESETS.viaplay,
    note: 'Automatisch opgehaald. In Nederland primair via Viaplay.'
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

async function loadProviderRules(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const parsed = safeParseJson(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid provider rules config: ${filePath}`);
  }
  return parsed;
}

function formatDateForApi(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatDateForYmd(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizeAsciiLower(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function detectContentTypeFromText(title, context = '') {
  const text = normalizeAsciiLower(`${title || ''} ${context || ''}`);
  if (BROADCAST_RECAP_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return { contentType: 'broadcast', contentSubType: 'recap' };
  }
  if (BROADCAST_GENERAL_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return { contentType: 'broadcast', contentSubType: 'general' };
  }
  return { contentType: 'match' };
}

function isGenericGamesBroadcastTitle(title) {
  const normalized = normalizeAsciiLower(title);
  const isGamesRelated = normalized.includes('paralymp') || normalized.includes('olymp');
  if (!isGamesRelated) {
    return false;
  }
  return !normalized.includes(':');
}

function normalizeTitleForMatch(value) {
  return normalizeAsciiLower(value)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[:/,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanTeamName(value) {
  return normalizeTitleForMatch(value)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(' ')
    .filter((token) => token && token.length > 1 && !TEAM_NOISE_WORDS.has(token))
    .join(' ');
}

function splitMatchupTitle(title) {
  const normalized = normalizeTitleForMatch(title);
  const parts = normalized
    .split(/\s(?:-|–|—|vs\.?|v\.?)\s/i)
    .map((part) => cleanTeamName(part))
    .filter(Boolean);

  if (parts.length !== 2) {
    return null;
  }

  return parts;
}

function teamNameLikelyMatches(a, b) {
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const tokensA = new Set(a.split(' ').filter(Boolean));
  const tokensB = new Set(b.split(' ').filter(Boolean));
  if (!tokensA.size || !tokensB.size) return false;

  let overlap = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) {
      overlap += 1;
    }
  });

  const minimum = Math.max(1, Math.min(tokensA.size, tokensB.size) - 1);
  return overlap >= minimum;
}

function isSameMatchup(titleA, titleB) {
  const teamsA = splitMatchupTitle(titleA);
  const teamsB = splitMatchupTitle(titleB);
  if (!teamsA || !teamsB) {
    return false;
  }

  return (
    (teamNameLikelyMatches(teamsA[0], teamsB[0]) && teamNameLikelyMatches(teamsA[1], teamsB[1]))
    || (teamNameLikelyMatches(teamsA[0], teamsB[1]) && teamNameLikelyMatches(teamsA[1], teamsB[0]))
  );
}

function titleLikelyMatches(eventTitle, listingTitle) {
  if (isSameMatchup(eventTitle, listingTitle)) {
    return true;
  }

  const tokensA = normalizeTitleForMatch(eventTitle)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(' ')
    .filter((token) => token && token.length > 2 && !TITLE_NOISE_WORDS.has(token));
  const tokensB = normalizeTitleForMatch(listingTitle)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(' ')
    .filter((token) => token && token.length > 2 && !TITLE_NOISE_WORDS.has(token));

  if (!tokensA.length || !tokensB.length) {
    return false;
  }

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let overlap = 0;
  setA.forEach((token) => {
    if (setB.has(token)) {
      overlap += 1;
    }
  });

  return overlap >= Math.max(2, Math.floor(Math.min(setA.size, setB.size) * 0.6));
}

function isReplayLikeTitle(title) {
  const normalized = normalizeTitleForMatch(title);
  return ['samenvatting', 'highlights', 'herhaling', 'voorbeschouwing', 'nabeschouwing'].some((word) => normalized.includes(word));
}

function hasProviderChannel(channels, providerName) {
  const needle = normalizeAsciiLower(providerName);
  return (channels || []).some((channel) => normalizeAsciiLower(channel.name).includes(needle));
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

function canonicalizeZiggoChannelName(channelName) {
  const compact = String(channelName || '').trim().replace(/\s+/g, ' ');
  const normalized = normalizeAsciiLower(compact);
  if (!normalized) {
    return '';
  }

  if (normalized === 'ziggo sport' || normalized === 'ziggo sport kanaal 14' || normalized === 'ziggo sport 14') {
    return normalized === 'ziggo sport' ? 'Ziggo Sport' : 'Ziggo Sport Kanaal 14';
  }

  const numbered = normalized.match(/^ziggo sport(?: kanaal)? ([0-9]{1,2})$/);
  if (numbered) {
    const channelNumber = Number(numbered[1]);
    if (channelNumber === 14) {
      return 'Ziggo Sport Kanaal 14';
    }
    if (channelNumber >= 2 && channelNumber <= 14) {
      return `Ziggo Sport ${channelNumber}`;
    }
  }

  const ott = compact.match(/^ott\s*([0-9]+)(.*)$/i);
  if (ott) {
    const suffix = String(ott[2] || '').trim();
    return suffix ? `OTT${ott[1]} ${suffix}` : `OTT${ott[1]}`;
  }

  return compact;
}

function canonicalizeEspnChannelName(channelName) {
  const compact = String(channelName || '').trim().replace(/\s+/g, ' ');
  const normalized = normalizeAsciiLower(compact);
  if (!normalized.includes('espn')) {
    return compact;
  }

  if (normalized === 'espn watch') {
    return 'ESPN Watch';
  }

  if (normalized === 'espn+' || normalized === 'espn plus') {
    return 'ESPN+';
  }

  if (normalized === 'espn' || normalized === 'espn 1' || normalized === 'espn1') {
    return 'ESPN';
  }

  const numbered = normalized.match(/^espn\s*([2-9])$/);
  if (numbered) {
    return `ESPN ${numbered[1]}`;
  }

  if (normalized.includes('espn extra')) {
    return 'ESPN Extra';
  }

  if (normalized === 'espnews') {
    return 'ESPNews';
  }

  if (normalized === 'espn deportes') {
    return 'ESPN Deportes';
  }

  return compact;
}

function ruleListIncludes(values, needle) {
  const normalizedNeedle = normalizeAsciiLower(needle);
  return values.some((value) => normalizeAsciiLower(value) === normalizedNeedle);
}

function channelMatchesRuleTarget(channel, override) {
  const normalizedName = normalizeAsciiLower(channel.name);
  if (override.targetName && normalizedName === normalizeAsciiLower(override.targetName)) {
    return true;
  }
  if (override.targetNameIncludes && normalizedName.includes(normalizeAsciiLower(override.targetNameIncludes))) {
    return true;
  }
  return false;
}

function eventMatchesCompetitionOverride(event, override) {
  const haystack = normalizeAsciiLower(`${event.title || ''} ${event.competition || ''} ${event.notes || ''}`);
  const requiredAll = Array.isArray(override?.when?.all) ? override.when.all : [];
  const requiredAny = Array.isArray(override?.when?.any) ? override.when.any : [];

  if (requiredAll.some((needle) => !haystack.includes(normalizeAsciiLower(needle)))) {
    return false;
  }

  if (requiredAny.length && !requiredAny.some((needle) => haystack.includes(normalizeAsciiLower(needle)))) {
    return false;
  }

  return true;
}

function applyCompetitionChannelOverrides(event, channels) {
  const overrides = Array.isArray(PROVIDER_RULES.competitionOverrides) ? PROVIDER_RULES.competitionOverrides : [];
  if (!overrides.length) {
    return channels;
  }

  let nextChannels = [...channels];
  overrides.forEach((override) => {
    if (!eventMatchesCompetitionOverride(event, override)) {
      return;
    }

    const patch = override && typeof override.set === 'object' ? override.set : null;
    let matched = false;

    nextChannels = nextChannels.map((channel) => {
      if (!channelMatchesRuleTarget(channel, override)) {
        return channel;
      }
      matched = true;
      return patch ? { ...channel, ...patch } : channel;
    });

    if (!matched && override.upsert && patch) {
      nextChannels.push({ ...patch });
    }
  });

  return nextChannels;
}

function applyProviderAccessBusinessRules(event) {
  let channels = (event.channels || []).map((channel) => {
    const originalName = String(channel.name || '').trim();
    const normalizedName = normalizeAsciiLower(originalName);

    if (normalizedName.includes('ziggo') || normalizedName.startsWith('ott')) {
      const canonicalName = canonicalizeZiggoChannelName(originalName);
      const normalizedCanonical = normalizeAsciiLower(canonicalName);
      const streamIndicators = Array.isArray(ZIGGO_RULES.streamChannelIndicators)
        ? ZIGGO_RULES.streamChannelIndicators
        : ['ziggo go', 'ott'];
      const freeNames = Array.isArray(ZIGGO_RULES.freeChannelNames)
        ? ZIGGO_RULES.freeChannelNames
        : ['ziggo sport', 'ziggo sport kanaal 14', 'ziggo sport 14'];
      const isOtt = streamIndicators.some((indicator) => normalizedCanonical.includes(normalizeAsciiLower(indicator)));
      const isFree = ruleListIncludes(freeNames, normalizedCanonical);

      return {
        ...channel,
        name: canonicalName,
        platform: isOtt ? 'stream' : 'tv',
        access: isFree ? 'free' : 'paid',
        url: isOtt ? (ZIGGO_RULES.streamUrl || 'https://www.ziggogo.tv/nl/home') : (ZIGGO_RULES.tvUrl || 'https://www.ziggosport.nl/programmagids/'),
        conditions: isFree
          ? (ZIGGO_RULES.freeConditions || 'Gratis voor Ziggo-klanten met geschikt tv-pakket.')
          : (ZIGGO_RULES.paidConditions || 'Kanaal vereist aanvullend Ziggo Sport-pakket of inloggen via Ziggo GO.')
      };
    }

    if (normalizedName.includes('espn')) {
      const canonicalName = canonicalizeEspnChannelName(originalName);
      const normalizedCanonical = normalizeAsciiLower(canonicalName);
      const streamNames = Array.isArray(ESPN_RULES.streamChannelNames)
        ? ESPN_RULES.streamChannelNames
        : ['espn watch', 'espn+', 'espn plus'];
      const freeNames = Array.isArray(ESPN_RULES.freeChannelNames)
        ? ESPN_RULES.freeChannelNames
        : ['espn', 'espn 1'];
      const isStream = ruleListIncludes(streamNames, normalizedCanonical);
      const isFree = ruleListIncludes(freeNames, normalizedCanonical);

      return {
        ...channel,
        name: canonicalName,
        platform: isStream ? 'stream' : 'tv',
        access: isFree ? 'free' : 'paid',
        url: channel.url || (isStream ? (ESPN_RULES.watchUrl || 'https://www.espn.nl/watch/') : (ESPN_RULES.scheduleUrl || 'https://www.espn.nl/watch/schedule')),
        conditions: isFree
          ? (ESPN_RULES.freeConditions || 'Gratis voor KPN-klanten met geschikt tv-pakket.')
          : isStream
            ? (ESPN_RULES.paidStreamConditions || 'Streaming via ESPN Watch met geschikt abonnement.')
          : (ESPN_RULES.paidTvConditions || 'Alleen met ESPN Compleet of geschikt tv-pakket.')
      };
    }

    return channel;
  });

  channels = applyCompetitionChannelOverrides(event, channels);

  return {
    ...event,
    channels: mergeChannels(channels)
  };
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

function ziggoChannelFromName(channelName) {
  const name = canonicalizeZiggoChannelName(channelName);
  if (!name) {
    return null;
  }

  const normalized = normalizeAsciiLower(name);
  const freeNames = Array.isArray(ZIGGO_RULES.freeChannelNames)
    ? ZIGGO_RULES.freeChannelNames
    : ['ziggo sport', 'ziggo sport kanaal 14', 'ziggo sport 14'];
  const streamIndicators = Array.isArray(ZIGGO_RULES.streamChannelIndicators)
    ? ZIGGO_RULES.streamChannelIndicators
    : ['ziggo go', 'ott'];
  const isFree = ruleListIncludes(freeNames, normalized);
  const isOtt = streamIndicators.some((indicator) => normalized.includes(normalizeAsciiLower(indicator)));

  return {
    name,
    platform: isOtt ? 'stream' : 'tv',
    access: isFree ? 'free' : 'paid',
    url: isOtt ? (ZIGGO_RULES.streamUrl || 'https://www.ziggogo.tv/nl/home') : (ZIGGO_RULES.tvUrl || 'https://www.ziggosport.nl/programmagids/'),
    conditions: isFree
      ? (ZIGGO_RULES.freeConditions || 'Gratis voor Ziggo-klanten met geschikt tv-pakket.')
      : (ZIGGO_RULES.paidConditions || 'Kanaal vereist aanvullend Ziggo Sport-pakket of inloggen via Ziggo GO.')
  };
}

function espnChannelFromName(channelName, watchUrl) {
  const name = canonicalizeEspnChannelName(channelName);
  const normalized = normalizeAsciiLower(name);
  if (!normalized.includes('espn')) {
    return null;
  }

  const streamNames = Array.isArray(ESPN_RULES.streamChannelNames)
    ? ESPN_RULES.streamChannelNames
    : ['espn watch', 'espn+', 'espn plus'];
  const freeNames = Array.isArray(ESPN_RULES.freeChannelNames)
    ? ESPN_RULES.freeChannelNames
    : ['espn', 'espn 1'];
  const isStream = ruleListIncludes(streamNames, normalized);
  const isFree = ruleListIncludes(freeNames, normalized);

  return {
    name,
    platform: isStream ? 'stream' : 'tv',
    access: isFree ? 'free' : 'paid',
    url: watchUrl || (isStream ? (ESPN_RULES.watchUrl || 'https://www.espn.nl/watch/') : (ESPN_RULES.scheduleUrl || 'https://www.espn.nl/watch/schedule')),
    conditions: isFree
      ? (ESPN_RULES.freeConditions || 'Gratis voor KPN-klanten met geschikt tv-pakket.')
      : isStream
        ? (ESPN_RULES.paidStreamConditions || 'Streaming via ESPN Watch met geschikt abonnement.')
      : (ESPN_RULES.paidTvConditions || 'Alleen met ESPN Compleet of geschikt tv-pakket.')
  };
}

function parseEspnFittData(rawHtml) {
  const match = rawHtml.match(/window\['__espnfitt__'\]=(\{[\s\S]*?\});<\/script>/);
  if (!match) {
    return null;
  }
  return safeParseJson(match[1]);
}

function extractEspnScheduleRows(payload, sourceUrl) {
  const root = payload?.page?.content?.watch?.arngs;
  const rows = [];

  const walk = (node, path = []) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach((child) => walk(child, path));
      return;
    }

    const nodeName = String(node?.nme || node?.name || '').trim();
    const nextPath = nodeName ? [...path, nodeName] : path;

    if (Array.isArray(node.arngs)) {
      node.arngs.forEach((airing) => {
        const start = tryIso(airing?.stme || airing?.startTime);
        if (!start || !isWithinWindow(start)) {
          return;
        }

        const channels = (airing?.bcsts || airing?.broadcasts || [])
          .map((broadcast) => broadcast?.nme || broadcast?.name)
          .filter(Boolean);

        if (!channels.length) {
          return;
        }

        const hrf = airing?.hrf;
        const watchUrl = hrf && hrf.startsWith('http')
          ? hrf
          : (hrf ? `https://www.espn.nl${hrf}` : 'https://www.espn.nl/watch/schedule');
        const categories = [
          ...nextPath,
          ...((airing?.ctgys || []).map((category) => category?.name || category?.nme)),
          ...((airing?.sctgys || []).map((category) => category?.name || category?.nme))
        ]
          .map((value) => String(value || '').trim())
          .filter(Boolean);
        const uniqueCategories = [...new Set(categories)];

        rows.push({
          title: airing?.nme || airing?.name || '',
          description: airing?.fnme || '',
          type: airing?.tp || '',
          start,
          startMs: new Date(start).getTime(),
          end: tryIso(airing?.etme || airing?.endTime || airing?.endDate),
          channels,
          categories: uniqueCategories,
          sectionName: nextPath[0] || '',
          watchUrl,
          sourceUrl
        });
      });
    }

    if (Array.isArray(node.sctgys)) {
      walk(node.sctgys, nextPath);
    }
  };

  walk(root, []);
  return rows;
}

async function fetchZiggoEpgRows() {
  const rows = [];
  const sources = [];
  const errors = [];
  const seen = new Set();
  const startDay = new Date(Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth(), windowStart.getUTCDate()));
  let notFoundStreak = 0;

  for (let dayOffset = 0; dayOffset <= ZIGGO_EPG_LOOKAHEAD_DAYS; dayOffset += 1) {
    const day = addDays(startDay, dayOffset);
    const ymd = formatDateForYmd(day);
    const url = `${ZIGGO_EPG_BASE_URL}/epg-${ymd}.json`;

    try {
      const channels = await fetchJson(url);
      notFoundStreak = 0;
      if (!Array.isArray(channels)) {
        continue;
      }

      sources.push(url);
      channels.forEach((channelGroup) => {
        const channelName = channelGroup?.channel;
        (channelGroup?.programming || []).forEach((program) => {
          const start = tryIso(program?.dateStart);
          if (!start || !isWithinWindow(start)) {
            return;
          }

          const title = String(program?.title || '').trim();
          if (!title || !channelName) {
            return;
          }

          const key = `${channelName}|${title}|${start}`;
          if (seen.has(key)) {
            return;
          }
          seen.add(key);

          rows.push({
            title,
            start,
            startMs: new Date(start).getTime(),
            end: tryIso(program?.dateEnd || program?.endDate || program?.dateStop),
            description: String(program?.description || program?.subTitle || program?.subtitle || '').trim(),
            live: program?.live === true || program?.isLive === true,
            channelName: channelName,
            channels: [channelName],
            sourceUrl: url
          });
        });
      });
    } catch (error) {
      if (String(error.message).includes('HTTP 404')) {
        notFoundStreak += 1;
        if (dayOffset > 3 && notFoundStreak >= 3) {
          break;
        }
        continue;
      }
      errors.push(`Ziggo EPG ${ymd}: ${error.message}`);
    }
  }

  return { rows, sources, errors };
}

async function fetchEspnScheduleRows() {
  const rows = [];
  const sources = [];
  const errors = [];
  const seen = new Set();
  const startDay = new Date(Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth(), windowStart.getUTCDate()));
  const totalDays = Math.min(
    ESPN_SCHEDULE_LOOKAHEAD_DAYS,
    Math.ceil((windowEnd.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000))
  );

  for (let dayOffset = 0; dayOffset <= totalDays; dayOffset += 1) {
    const startDate = formatDateForApi(addDays(startDay, dayOffset));
    const url = `${ESPN_SCHEDULE_BASE_URL}?startDate=${startDate}`;
    sources.push(url);

    try {
      const html = await fetchText(url);
      const payload = parseEspnFittData(html);
      const extracted = extractEspnScheduleRows(payload, url);
      extracted.forEach((row) => {
        const key = `${row.title}|${row.start}|${row.channels.join(',')}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        rows.push(row);
      });
    } catch (error) {
      errors.push(`ESPN schedule ${startDate}: ${error.message}`);
    }
  }

  return { rows, sources, errors };
}

function scoreScheduleRow(event, row, maxLeadMinutes, maxLagMinutes) {
  const eventStartMs = new Date(event.start).getTime();
  const diffMinutes = Math.round((row.startMs - eventStartMs) / 60000);

  if (diffMinutes < -maxLeadMinutes || diffMinutes > maxLagMinutes) {
    return Number.NEGATIVE_INFINITY;
  }
  if (!titleLikelyMatches(event.title, row.title)) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 220 - Math.abs(diffMinutes);
  if (diffMinutes >= -45 && diffMinutes <= 30) {
    score += 35;
  }
  if (isSameMatchup(event.title, row.title)) {
    score += 40;
  }
  if (isReplayLikeTitle(row.title)) {
    score -= 120;
  }

  return score;
}

function findScheduleRowsForEvent(event, rows, maxLeadMinutes = 180, maxLagMinutes = 120) {
  const scored = rows
    .map((row) => ({ row, score: scoreScheduleRow(event, row, maxLeadMinutes, maxLagMinutes) }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((a, b) => b.score - a.score);

  if (!scored.length || scored[0].score < 70) {
    return [];
  }

  const anchor = scored[0].row;
  const grouped = scored
    .map((candidate) => candidate.row)
    .filter((row) => titleLikelyMatches(anchor.title, row.title))
    .filter((row) => Math.abs(row.startMs - anchor.startMs) <= 45 * 60 * 1000)
    .filter((row) => !isReplayLikeTitle(row.title) || isReplayLikeTitle(anchor.title));

  return grouped.length ? grouped : [anchor];
}

function removeChannelsByNeedles(channels, needles) {
  const normalizedNeedles = needles.map((needle) => normalizeAsciiLower(needle));
  return (channels || []).filter((channel) => {
    const normalizedName = normalizeAsciiLower(channel.name);
    return !normalizedNeedles.some((needle) => normalizedName.includes(needle));
  });
}

function enrichEventChannels(event, ziggoRows, espnRows) {
  let nextChannels = event.channels || [];
  let nextSourceRefs = event.sourceRefs || [];
  let sourceType = event.sourceType;

  if (hasProviderChannel(nextChannels, 'ziggo')) {
    const matches = findScheduleRowsForEvent(event, ziggoRows, 210, 150);
    if (matches.length) {
      const ziggoChannels = mergeChannels(
        ...matches.map((row) => row.channels.map((channelName) => ziggoChannelFromName(channelName)).filter(Boolean))
      );
      if (ziggoChannels.length) {
        const carryOverZiggoGo = (nextChannels || []).filter((channel) => channel.name === 'Ziggo GO');
        const nonZiggoChannels = removeChannelsByNeedles(nextChannels, ['ziggo']);
        nextChannels = mergeChannels(nonZiggoChannels, ziggoChannels, carryOverZiggoGo);
        nextSourceRefs = mergeSourceRefs(
          nextSourceRefs,
          matches.map((match) => createSourceRef('Ziggo Sport programmagids', match.sourceUrl, 'ziggo')).filter(Boolean)
        );
        sourceType = sourceType === 'espn' ? 'mixed' : sourceType;
      }
    }
  }

  if (hasProviderChannel(nextChannels, 'espn')) {
    const matches = findScheduleRowsForEvent(event, espnRows, 120, 120);
    if (matches.length) {
      const espnChannels = mergeChannels(
        ...matches.map((row) => (
          row.channels
            .map((channelName) => espnChannelFromName(channelName, row.watchUrl))
            .filter(Boolean)
        ))
      );
      if (espnChannels.length) {
        const nonEspnChannels = removeChannelsByNeedles(nextChannels, ['espn']);
        nextChannels = mergeChannels(nonEspnChannels, espnChannels);
        nextSourceRefs = mergeSourceRefs(
          nextSourceRefs,
          matches.map((match) => createSourceRef('ESPN TV-gids', match.sourceUrl, 'espn-schedule')).filter(Boolean)
        );
        sourceType = sourceType === 'espn' ? 'mixed' : sourceType;
      }
    }
  }

  return {
    ...event,
    channels: nextChannels,
    sourceRefs: nextSourceRefs,
    sourceType
  };
}

function enrichEventsWithSchedules(events, ziggoRows, espnRows) {
  return events.map((event) => applyProviderAccessBusinessRules(enrichEventChannels(event, ziggoRows, espnRows)));
}

function competitionFromCandidates(candidates, fallback = 'Sport') {
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (!value) {
      continue;
    }

    const normalized = normalizeAsciiLower(value);
    if (['sport', 'sports', 'others', 'upcoming', 'live', 'livestream'].includes(normalized)) {
      continue;
    }
    return value;
  }

  return fallback;
}

function durationFromStartEnd(startIso, endIso, fallbackMinutes = 120) {
  const end = tryIso(endIso);
  if (!end) {
    return fallbackMinutes;
  }
  const diffMinutes = Math.round((new Date(end).getTime() - new Date(startIso).getTime()) / 60000);
  return diffMinutes > 10 ? diffMinutes : fallbackMinutes;
}

function normalizedTitleKey(title) {
  return normalizeTitleForMatch(title)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(live|livestream|wedstrijd|match|sport)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scheduleOnlyShouldSkip(title) {
  const normalized = normalizeAsciiLower(title).replace(/\s+/g, ' ').trim();
  return !normalized || SCHEDULE_ONLY_SKIP_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function looksLikeScheduledSportEvent(title) {
  const raw = String(title || '');
  const normalized = normalizeTitleForMatch(raw);
  if (!normalized) {
    return false;
  }
  if (/\s(?:-|–|—|vs\.?|v\.?)\s/i.test(raw)) {
    return true;
  }
  return SCHEDULE_ONLY_EVENT_KEYWORDS.some((keyword) => normalized.includes(keyword.trim()));
}

function inferEspnScheduleSport(row) {
  const detected = detectSportFromCandidates([
    row.title,
    row.description,
    row.sectionName,
    ...(row.categories || [])
  ]);
  if (detected) {
    return detected;
  }

  const titlePrefix = row.title.includes(':') ? row.title.split(':')[0] : '';
  return inferSportFromCandidates([row.sectionName, ...(row.categories || []), titlePrefix], null);
}

function inferZiggoScheduleSport(row) {
  const detected = detectSportFromCandidates([row.title, row.description, row.channelName]);
  if (detected) {
    return detected;
  }

  const titlePrefix = row.title.includes(':') ? row.title.split(':')[0] : '';
  return inferSportFromCandidates([titlePrefix], null);
}

function scheduleOnlyLikelyDuplicate(candidate, existingEvents) {
  const candidateStartMs = new Date(candidate.start).getTime();
  const candidateTitleKey = normalizedTitleKey(candidate.title);

  for (const event of existingEvents) {
    const eventStartMs = new Date(event.start).getTime();
    if (!Number.isFinite(eventStartMs)) {
      continue;
    }
    if (Math.abs(eventStartMs - candidateStartMs) > 4 * 60 * 60 * 1000) {
      continue;
    }

    if (titleLikelyMatches(candidate.title, event.title) || titleLikelyMatches(event.title, candidate.title)) {
      return true;
    }

    const eventTitleKey = normalizedTitleKey(event.title);
    if (candidateTitleKey && eventTitleKey && candidateTitleKey === eventTitleKey) {
      return true;
    }
  }

  return false;
}

function createScheduleOnlyId(prefix, row) {
  const title = slugify(row.title).slice(0, 72) || 'event';
  const startKey = formatDateForApi(new Date(row.start));
  return `${prefix}-${startKey}-${title}`;
}

function parseEspnScheduleOnlyEvent(row) {
  if (scheduleOnlyShouldSkip(row.title) || !looksLikeScheduledSportEvent(row.title)) {
    return null;
  }

  const type = normalizeAsciiLower(row.type);
  if (type && !['live', 'upcoming'].includes(type)) {
    return null;
  }

  const sport = inferEspnScheduleSport(row);
  if (!sport) {
    return null;
  }

  const channels = mergeChannels(
    ...(row.channels || []).map((channelName) => espnChannelFromName(channelName, row.watchUrl)).filter(Boolean)
  );
  if (!channels.length) {
    return null;
  }

  const competition = competitionFromCandidates(
    [row.sectionName, ...(row.categories || []), sport.replace(/-/g, ' ')],
    'ESPN'
  );

  return {
    id: createScheduleOnlyId('espn-schedule', row),
    sport,
    title: row.title,
    competition,
    start: row.start,
    durationMinutes: durationFromStartEnd(row.start, row.end, 120),
    location: 'Online',
    channels,
    notes: 'Automatisch toegevoegd vanuit ESPN TV-gids (schedule-only).',
    sourceType: 'espn-schedule',
    sourceRefs: [createSourceRef('ESPN TV-gids', row.sourceUrl, 'espn-schedule')].filter(Boolean),
    contentType: 'match'
  };
}

function parseZiggoScheduleOnlyEvent(row) {
  if (scheduleOnlyShouldSkip(row.title)) {
    return null;
  }
  if (!row.live && !looksLikeScheduledSportEvent(row.title)) {
    return null;
  }

  const sport = inferZiggoScheduleSport(row);
  if (!sport) {
    return null;
  }

  const channels = mergeChannels(
    ...(row.channels || []).map((channelName) => ziggoChannelFromName(channelName)).filter(Boolean)
  );
  if (!channels.length) {
    return null;
  }

  const competition = competitionFromCandidates(
    [row.channelName, row.title.split(':')[0], sport.replace(/-/g, ' ')],
    'Ziggo Sport'
  );

  return {
    id: createScheduleOnlyId('ziggo-schedule', row),
    sport,
    title: row.title,
    competition,
    start: row.start,
    durationMinutes: durationFromStartEnd(row.start, row.end, 120),
    location: 'Online',
    channels,
    notes: row.live
      ? 'Automatisch toegevoegd vanuit Ziggo Sport EPG (live-indicatie aanwezig).'
      : 'Automatisch toegevoegd vanuit Ziggo Sport EPG (schedule-only).',
    sourceType: 'ziggo',
    sourceRefs: [createSourceRef('Ziggo Sport programmagids', row.sourceUrl, 'ziggo')].filter(Boolean),
    contentType: 'match'
  };
}

function parseHboMaxScheduleOnlyEvent(row) {
  if (scheduleOnlyShouldSkip(row.title)) {
    return null;
  }

  const sport = inferSportFromCandidates(
    [row.sportLabel, row.league, row.title, row.summary],
    null
  );
  if (!sport) {
    return null;
  }

  const competition = competitionFromCandidates(
    [row.league, row.sportLabel, row.title.split('|')[0], 'HBO Max'],
    'HBO Max'
  );

  const channels = mergeChannels([
    {
      ...CHANNEL_PRESETS.hboMax[0],
      url: row.eventUrl || CHANNEL_PRESETS.hboMax[0].url
    },
    CHANNEL_PRESETS.hboMax[1]
  ]);

  return {
    id: createScheduleOnlyId('hbo-max', row),
    sport,
    title: row.title,
    competition,
    start: row.start,
    durationMinutes: durationFromStartEnd(row.start, row.end, 150),
    location: 'Online',
    channels,
    notes: 'Automatisch toegevoegd vanuit HBO Max sportagenda.',
    sourceType: 'hbo-max',
    sourceRefs: [
      createSourceRef('HBO Max sportagenda', row.sourceUrl, 'hbo-max'),
      row.eventUrl ? createSourceRef('HBO Max event', row.eventUrl, 'hbo-max') : null
    ].filter(Boolean),
    contentType: 'match'
  };
}

function buildScheduleOnlyEvents(existingEvents, ziggoRows, espnRows, hboMaxRows) {
  const scheduleOnlyEvents = [];
  const combinedExisting = [...existingEvents];

  const addIfUnique = (candidate) => {
    if (!candidate) {
      return;
    }
    if (scheduleOnlyLikelyDuplicate(candidate, combinedExisting)) {
      return;
    }
    scheduleOnlyEvents.push(candidate);
    combinedExisting.push(candidate);
  };

  espnRows
    .map((row) => parseEspnScheduleOnlyEvent(row))
    .filter(Boolean)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .forEach(addIfUnique);

  ziggoRows
    .map((row) => parseZiggoScheduleOnlyEvent(row))
    .filter(Boolean)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .forEach(addIfUnique);

  hboMaxRows
    .map((row) => parseHboMaxScheduleOnlyEvent(row))
    .filter(Boolean)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .forEach(addIfUnique);

  return scheduleOnlyEvents;
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

const SPORT_KEYWORDS = [
  { sport: 'formule-1', keywords: ['formule 1', 'f1'] },
  {
    sport: 'voetbal',
    keywords: [
      'voetbal',
      'soccer',
      'eredivisie',
      'keuken kampioen',
      'premier league',
      'la liga',
      'serie a',
      'bundesliga',
      'ligue 1',
      'champions league',
      'europa league',
      'conference league',
      ...DUTCH_CLUB_KEYWORDS
    ]
  },
  { sport: 'tennis', keywords: ['tennis', 'atp', 'wta', 'davis cup', 'billie jean king'] },
  { sport: 'basketbal', keywords: ['basketbal', 'basketball'] },
  { sport: 'american-football', keywords: ['american football', 'nfl'] },
  { sport: 'honkbal', keywords: ['honkbal', 'baseball'] },
  { sport: 'ijshockey', keywords: ['ijshockey', 'ice hockey'] },
  { sport: 'golf', keywords: ['golf', 'pga', 'lpga', 'european tour'] },
  { sport: 'vechtsport', keywords: ['ufc', 'mma', 'boksen', 'boxing', 'kickboksen'] },
  { sport: 'handbal', keywords: ['handbal', 'handball'] },
  { sport: 'volleybal', keywords: ['volleybal', 'volleyball'] },
  { sport: 'hockey', keywords: ['hockey', 'veldhockey'] },
  { sport: 'wielrennen', keywords: ['wielrennen', 'cycling'] },
  { sport: 'atletiek', keywords: ['atletiek', 'athletics'] },
  { sport: 'schaatsen', keywords: ['schaatsen', 'speed skating'] },
  { sport: 'rugby', keywords: ['rugby'] },
  { sport: 'darts', keywords: ['darts'] },
  { sport: 'olympics', keywords: ['olympisch', 'olympic', 'olympische spelen'] },
  { sport: 'paralympics', keywords: ['paralymp', 'paralympische spelen'] },
  { sport: 'snooker', keywords: ['snooker'] },
  { sport: 'zwemmen', keywords: ['zwemmen', 'swimming'] },
  { sport: 'turnen', keywords: ['turnen', 'gymnastics'] },
  { sport: 'badminton', keywords: ['badminton'] },
  { sport: 'judo', keywords: ['judo'] },
  { sport: 'roeien', keywords: ['roeien', 'rowing'] },
  { sport: 'zeilen', keywords: ['zeilen', 'sailing'] },
  {
    sport: 'motorsport',
    keywords: ['motogp', 'motorsport', 'nascar', 'indycar', 'rally', 'imsa', 'supercars', 'formula e']
  },
  { sport: 'cricket', keywords: ['cricket'] }
];

const GENERIC_SPORT_FALLBACK_BLOCKLIST = new Set([
  'sport',
  'sports',
  'nos-sport',
  'livestream',
  'live',
  'wedstrijd',
  'match',
  'upcoming',
  'others',
  'espn',
  'ziggo-sport',
  'ziggo',
  'npo',
  'npo-start',
  'nos',
  'watch',
  'vandaag'
]);

function detectSportFromCandidates(candidates) {
  const normalized = normalizeAsciiLower(candidates.filter(Boolean).join(' '));
  if (!normalized) {
    return null;
  }
  const match = SPORT_KEYWORDS.find((entry) => entry.keywords.some((keyword) => normalized.includes(keyword)));
  return match?.sport || null;
}

function fallbackSportSlugFromCandidates(candidates) {
  for (const candidate of candidates) {
    const normalized = normalizeAsciiLower(candidate)
      .replace(/\b(live|livestream|wedstrijd|match|sport|sports|espn|ziggo|npo|nos|watch|kanaal|channel)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const slug = slugify(normalized || candidate);
    if (!slug || GENERIC_SPORT_FALLBACK_BLOCKLIST.has(slug)) {
      continue;
    }
    return slug;
  }

  return null;
}

function inferSportFromCandidates(candidates, defaultSport = 'sport') {
  const detected = detectSportFromCandidates(candidates);
  if (detected) {
    return detected;
  }

  const fallback = fallbackSportSlugFromCandidates(candidates);
  if (fallback) {
    return fallback;
  }

  return defaultSport;
}

function mapNosSport(item) {
  const categories = Array.isArray(item.categories) ? item.categories : [];
  const categoryLabels = categories
    .map((category) => category?.label || category?.name)
    .filter(Boolean);

  const candidates = [
    ...categoryLabels,
    item?.title?.split(':')?.[0],
    item?.owner,
    item?.title
  ].filter(Boolean);
  return inferSportFromCandidates(candidates, 'sport');
}

function parseNosNextData(rawHtml) {
  const match = rawHtml.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    return null;
  }
  return safeParseJson(match[1]);
}

function parseHboMaxNextData(rawHtml) {
  const match = rawHtml.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    return null;
  }
  return safeParseJson(match[1]);
}

function hboText(value) {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'object') {
    return String(value.full || value.short || value.title || '').trim();
  }
  return String(value).trim();
}

function extractHboMaxScheduleRows(nextData, sourceUrl) {
  const mappedData = nextData?.props?.pageProps?.mappedData;
  if (!mappedData || typeof mappedData !== 'object') {
    return [];
  }

  const rows = [];
  const seen = new Set();
  const containers = Object.values(mappedData).filter((entry) => Array.isArray(entry?.items));

  containers.forEach((container) => {
    (container.items || []).forEach((item) => {
      const start = tryIso(item?.scheduleDates?.startDate || item?.offeringDates?.startDate);
      if (!start || !isWithinWindow(start)) {
        return;
      }

      const status = normalizeAsciiLower(item?.status);
      if (status && status !== 'published') {
        return;
      }

      const eventStatus = normalizeAsciiLower(item?.eventStatus);
      if (eventStatus === 'ended') {
        return;
      }

      const title = hboText(item?.title) || hboText(item?.titleDefault);
      if (!title) {
        return;
      }

      const relativeUrl = String(item?.url || '').trim();
      const eventUrl = relativeUrl
        ? new URL(relativeUrl, 'https://www.hbomax.com').toString()
        : sourceUrl;

      const key = `${title}|${start}|${eventUrl}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);

      rows.push({
        title,
        sportLabel: hboText(item?.sport),
        league: hboText(item?.league),
        summary: hboText(item?.summary),
        start,
        startMs: new Date(start).getTime(),
        end: tryIso(item?.scheduleDates?.endDate || item?.offeringDates?.endDate),
        sourceUrl,
        eventUrl
      });
    });
  });

  return rows;
}

function cleanNosParticipantLabel(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,;:!?'"()\-–—]+|[\s.,;:!?'"()\-–—]+$/g, '')
    .trim();
}

function extractNosLivestreamMatchTitle(title) {
  const text = String(title || '').trim();
  if (!text) {
    return null;
  }

  const betweenMatch = text.match(/\btussen\s+(.+?)\s+(?:en|tegen)\s+(.+?)(?:\s*(?:\(|,|$))/i);
  if (!betweenMatch) {
    return null;
  }

  const homeLike = cleanNosParticipantLabel(betweenMatch[1]);
  const awayLike = cleanNosParticipantLabel(betweenMatch[2]);
  if (!homeLike || !awayLike) {
    return null;
  }

  const homeWords = homeLike.split(' ').filter(Boolean).length;
  const awayWords = awayLike.split(' ').filter(Boolean).length;
  if (homeWords > 6 || awayWords > 6) {
    return null;
  }

  return `${homeLike} - ${awayLike}`;
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

  const rawTitle = item.title || 'NOS Sport livestream';
  const title = extractNosLivestreamMatchTitle(rawTitle) || rawTitle;
  const competition = rawTitle.includes(':') ? rawTitle.split(':')[0].trim() : 'NOS Sport';
  const url = item.url || fallbackUrl;
  let contentMeta = detectContentTypeFromText(title, competition);
  if (contentMeta.contentType === 'match' && isGenericGamesBroadcastTitle(title)) {
    contentMeta = { contentType: 'broadcast', contentSubType: 'general' };
  }

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
    sourceRefs: [createSourceRef('NOS livestream', url, 'nos')].filter(Boolean),
    contentType: contentMeta.contentType,
    ...(contentMeta.contentSubType ? { contentSubType: contentMeta.contentSubType } : {})
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

  const livestreamPaths = [...new Set(sportHtml.match(/\/livestream\/[0-9][^"' <]*/g) || [])]
    .slice(0, NOS_LIVESTREAM_LIMIT);

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

async function fetchHboMaxScheduleRows() {
  const sources = [HBO_MAX_SPORTS_URL];
  const errors = [];
  const rows = [];

  try {
    const html = await fetchText(HBO_MAX_SPORTS_URL);
    const nextData = parseHboMaxNextData(html);
    rows.push(...extractHboMaxScheduleRows(nextData, HBO_MAX_SPORTS_URL));
  } catch (error) {
    errors.push(`HBO Max sportagenda: ${error.message}`);
  }

  return { rows, sources, errors };
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
    sourceRefs: [createSourceRef('ESPN scoreboard', sourceUrl, 'espn')].filter(Boolean),
    contentType: 'match'
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
    sourceRefs: [createSourceRef('ESPN scoreboard', sourceUrl, 'espn')].filter(Boolean),
    contentType: 'match'
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
    sourceRefs: [createSourceRef('ESPN scoreboard', sourceUrl, 'espn')].filter(Boolean),
    contentType: 'match'
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
      contentType: event.contentType || 'match',
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
  if (set.contentType) {
    next.contentType = set.contentType;
  }
  if (set.contentSubType) {
    next.contentSubType = set.contentSubType;
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
    'hbo-max': 90,
    ziggo: 89,
    mixed: 85,
    'espn-schedule': 82,
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

  if (sourceTypes.has('ziggo') && sourceTypes.has('espn')) {
    return {
      confidence: 'likely',
      reason: 'Wedstrijd + kanaalindeling gekoppeld via ESPN feed en Ziggo EPG.',
      lastVerified: generatedAt,
      priority: sourcePriorityForEvent(event)
    };
  }

  if (sourceTypes.has('espn-schedule') && sourceTypes.has('espn')) {
    return {
      confidence: 'likely',
      reason: 'ESPN kanaalindeling gekoppeld aan ESPN TV-gids.',
      lastVerified: generatedAt,
      priority: sourcePriorityForEvent(event)
    };
  }

  if (sourceTypes.has('ziggo')) {
    return {
      confidence: 'likely',
      reason: 'Kanaalindeling gekoppeld via Ziggo Sport programmagids.',
      lastVerified: generatedAt,
      priority: sourcePriorityForEvent(event)
    };
  }

  if (sourceTypes.has('hbo-max')) {
    return {
      confidence: 'likely',
      reason: 'Direct toegevoegd vanuit HBO Max sportagenda.',
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
const hboMaxSchedule = await fetchHboMaxScheduleRows();
const ziggoEpg = await fetchZiggoEpgRows();
const espnSchedule = await fetchEspnScheduleRows();

const fetchErrors = [
  ...football.errors,
  ...f1.errors,
  ...tennis.errors,
  ...teamSports.errors,
  ...namedSports.errors,
  ...nosSportLivestreams.errors,
  ...hboMaxSchedule.errors,
  ...ziggoEpg.errors,
  ...espnSchedule.errors
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

const scheduleOnlyEvents = buildScheduleOnlyEvents(mergedEvents, ziggoEpg.rows, espnSchedule.rows, hboMaxSchedule.rows);
const mergedWithScheduleOnly = dedupeEvents([...mergedEvents, ...scheduleOnlyEvents]);
const enrichedEvents = enrichEventsWithSchedules(mergedWithScheduleOnly, ziggoEpg.rows, espnSchedule.rows);
const overriddenEvents = applyOverrides(enrichedEvents, overrideRules);
const generatedAt = new Date().toISOString();
const allVerifiedEvents = finalizeVerification(overriddenEvents, generatedAt);
const verifiedEvents = MAX_EVENTS > 0 ? allVerifiedEvents.slice(0, MAX_EVENTS) : allVerifiedEvents;

if (MAX_EVENTS > 0 && allVerifiedEvents.length > MAX_EVENTS) {
  console.warn(`Event list truncated from ${allVerifiedEvents.length} to ${MAX_EVENTS}.`);
}

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
    ...hboMaxSchedule.sources,
    ...ziggoEpg.sources,
    ...espnSchedule.sources,
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
