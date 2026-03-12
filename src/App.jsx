import { useMemo, useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'sportkijken-preferences-v2';

const KNOWN_SPORT_META = {
  voetbal: { label: 'Voetbal', accent: '#0a7b52' },
  'formule-1': { label: 'Formule 1', accent: '#c7351b' },
  tennis: { label: 'Tennis', accent: '#2f67cf' },
  basketbal: { label: 'Basketbal', accent: '#7e3af2' },
  'american-football': { label: 'American Football', accent: '#7c3f00' },
  honkbal: { label: 'Honkbal', accent: '#c7791f' },
  ijshockey: { label: 'IJshockey', accent: '#0f6a8f' },
  golf: { label: 'Golf', accent: '#2a8c44' },
  vechtsport: { label: 'Vechtsport', accent: '#7f1d1d' }
};

const FALLBACK_ACCENTS = ['#0a7b52', '#2f67cf', '#c7351b', '#7e3af2', '#0f6a8f', '#7f1d1d', '#b45309'];

const RANGE_OPTIONS = [
  { id: '7d', label: 'Komende 7 dagen' },
  { id: '30d', label: 'Komende 30 dagen' },
  { id: 'all', label: 'Alles gepland' }
];

const ACCESS_OPTIONS = [
  { id: 'all', label: 'Alles' },
  { id: 'free', label: 'Alleen gratis' },
  { id: 'paid', label: 'Alleen betaald' }
];

const MAJOR_FILTER_OPTIONS = [
  { id: 'all', label: 'Alles' },
  { id: 'major', label: 'Alleen grote events' },
  { id: 'regular', label: 'Zonder grote events' }
];

const DATE_FORMATTER = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  timeZone: 'Europe/Amsterdam'
});

const TIME_FORMATTER = new Intl.DateTimeFormat('nl-NL', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Amsterdam'
});

const DAY_KEY_FORMATTER = new Intl.DateTimeFormat('sv-SE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Amsterdam'
});

const DAY_NUMBER_FORMATTER = new Intl.DateTimeFormat('nl-NL', {
  day: '2-digit',
  month: 'short',
  timeZone: 'Europe/Amsterdam'
});

const EMPTY_DATASET = {
  generatedAt: null,
  region: 'NL',
  isDemo: false,
  sources: [],
  events: []
};
const FALLBACK_EVENTS = [];
const CONSENT_STORAGE_KEY = 'sportkijken-consent-v1';
const DEFAULT_ANALYTICS_RUNTIME = {
  consent: 'unknown',
  scriptRequested: false,
  scriptReady: false,
  configured: false,
  lastError: null,
  lastEventName: null,
  lastEventAt: null
};
const CONTACT_EMAIL = 'info@paulzuiderduin.com';
const GMAIL_COMPOSE_URL = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT_EMAIL)}`;
const REFRESH_STATUS_URLS = [
  'https://api.github.com/repos/Paulmzuiderduin/sportkijken/actions/workflows/update-data.yml/runs?per_page=5',
  'https://api.github.com/repos/Paulmzuiderduin/sportkijken/actions/runs?per_page=20'
];
const REFRESH_STATUS_STORAGE_KEY = 'sportkijken-last-refresh-check-at-v1';
const DATASET_CACHE_STORAGE_KEY = 'sportkijken-runtime-dataset-v1';
const RUNTIME_DATASET_URL = '/events.nl.json';
const RUNTIME_DATASET_META_URL = '/events.meta.json';
const RUNTIME_DATASET_POLL_MS = 5 * 60 * 1000;
const SEO_BASE_URL = 'https://sportkijken.paulzuiderduin.com/';
const SEO_BASE_TITLE = 'Waar Kan Ik Sport Kijken? | Sportkijken Nederland';
const SEO_BASE_DESCRIPTION = 'Waar kan ik voetbal, Formule 1, tennis en andere sport kijken? Sportkijken geeft per wedstrijd een NL-overzicht met zender/stream, tijd en gratis of betaald.';

function formatSportLabel(id) {
  return id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function colorForSport(id) {
  const hash = [...id].reduce((total, char) => total + char.charCodeAt(0), 0);
  return FALLBACK_ACCENTS[hash % FALLBACK_ACCENTS.length];
}

function buildSportOptions(events) {
  return [...new Set([...Object.keys(KNOWN_SPORT_META), ...events.map((event) => event.sport)])]
    .sort((a, b) => {
      const aLabel = KNOWN_SPORT_META[a]?.label || formatSportLabel(a);
      const bLabel = KNOWN_SPORT_META[b]?.label || formatSportLabel(b);
      return aLabel.localeCompare(bLabel, 'nl-NL');
    })
    .map((id) => ({
      id,
      label: KNOWN_SPORT_META[id]?.label || formatSportLabel(id),
      accent: KNOWN_SPORT_META[id]?.accent || colorForSport(id)
    }));
}

const PREFERRED_PROVIDERS = [
  'NOS.nl Live',
  'NPO 1',
  'NPO 2',
  'NPO 3',
  'NPO Start',
  'Ziggo Sport',
  'Ziggo GO',
  'Viaplay',
  'Viaplay TV',
  'ESPN',
  'ESPN Watch',
  'Discovery+',
  'HBO Max',
  'DAZN',
  'Prime Video',
  'Apple TV+',
  'CANAL+',
  'NFL Game Pass',
  'NBA League Pass',
  'MLB.TV',
  'NHL.TV',
  'UFC Fight Pass'
];

const PROVIDER_ALIAS_GROUPS = [
  ['HBO Max', 'Discovery+', 'Eurosport']
];

function buildProviderOptions(events) {
  const fromEvents = [...new Set(
    events
      .flatMap((event) => (Array.isArray(event.channels) ? event.channels.map((channel) => channel.name) : []))
      .filter(Boolean)
  )];

  // Keep fallback providers only before runtime data is loaded.
  const providers = fromEvents.length ? fromEvents : [...PREFERRED_PROVIDERS];
  const preferredRank = new Map(PREFERRED_PROVIDERS.map((provider, index) => [provider, index]));

  return providers.sort((a, b) => {
    const rankA = preferredRank.has(a) ? preferredRank.get(a) : Number.MAX_SAFE_INTEGER;
    const rankB = preferredRank.has(b) ? preferredRank.get(b) : Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return a.localeCompare(b, 'nl-NL');
  });
}

const FALLBACK_SPORT_OPTIONS = buildSportOptions(FALLBACK_EVENTS);
const FALLBACK_PROVIDER_OPTIONS = buildProviderOptions(FALLBACK_EVENTS);

const PROVIDER_VISIBLE_LIMIT = 24;

function sportMetaFor(id, sportLookup) {
  return sportLookup[id] || {
    id,
    label: formatSportLabel(id),
    accent: colorForSport(id)
  };
}

function defaultPreferences(sportOptions = FALLBACK_SPORT_OPTIONS, providerOptions = FALLBACK_PROVIDER_OPTIONS) {
  return {
    selectedSports: sportOptions.map((sport) => sport.id),
    selectedProviders: providerOptions,
    accessFilter: 'all',
    majorFilter: 'all',
    rangeFilter: '30d',
    searchText: '',
    providerSearchText: '',
    providerSelectedOnly: false
  };
}

function normalizeProviderName(value) {
  return String(value || '').trim().toLowerCase();
}

function expandedProviderSelection(selectedProviders) {
  const selected = new Set(selectedProviders.map((provider) => normalizeProviderName(provider)).filter(Boolean));
  if (!selected.size) {
    return selected;
  }

  PROVIDER_ALIAS_GROUPS.forEach((group) => {
    const normalizedGroup = group.map((provider) => normalizeProviderName(provider));
    if (normalizedGroup.some((provider) => selected.has(provider))) {
      normalizedGroup.forEach((provider) => selected.add(provider));
    }
  });

  return selected;
}

function sanitizeSelection(values, allowed) {
  const allowedSet = new Set(allowed);
  return values.filter((value) => allowedSet.has(value));
}

function areSameStringArrays(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

function normalizeRuntimeDataset(candidate) {
  if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.events)) {
    return null;
  }

  return {
    ...candidate,
    events: candidate.events
  };
}

function normalizeRuntimeDatasetMeta(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const generatedAt = normalizeIsoDateTime(candidate.generatedAt);
  const eventCountValue = Number(candidate.eventCount);
  const eventCount = Number.isFinite(eventCountValue) && eventCountValue >= 0
    ? Math.round(eventCountValue)
    : null;

  if (!generatedAt && eventCount === null) {
    return null;
  }

  return {
    generatedAt,
    eventCount
  };
}

function loadCachedDataset() {
  if (typeof window === 'undefined') {
    return EMPTY_DATASET;
  }

  try {
    const cached = window.localStorage.getItem(DATASET_CACHE_STORAGE_KEY);
    if (!cached) {
      return EMPTY_DATASET;
    }
    return normalizeRuntimeDataset(JSON.parse(cached)) || EMPTY_DATASET;
  } catch (error) {
    return EMPTY_DATASET;
  }
}

function persistCachedDataset(dataset) {
  if (typeof window === 'undefined' || !dataset) {
    return;
  }

  try {
    window.localStorage.setItem(DATASET_CACHE_STORAGE_KEY, JSON.stringify(dataset));
  } catch (error) {
    // Ignore storage limit errors.
  }
}

function formatDatasetDateTime(value) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= 0) {
    return 'Nog niet beschikbaar';
  }
  return date.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' });
}

function formatAgeLabel(totalMinutes) {
  const minutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (restMinutes === 0) {
    return `${hours} uur`;
  }
  return `${hours} uur ${restMinutes} min`;
}

function searchTextFromUrl() {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const params = new URLSearchParams(window.location.search);
    return (params.get('q') || '').trim();
  } catch (error) {
    return '';
  }
}

function setOrCreateMetaTag(selector, attributes, content) {
  if (typeof document === 'undefined') {
    return;
  }

  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement('meta');
    Object.entries(attributes).forEach(([key, value]) => tag.setAttribute(key, value));
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonicalHref(href) {
  if (typeof document === 'undefined') {
    return;
  }

  let tag = document.head.querySelector('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', 'canonical');
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
}

function toReadableSeoQuery(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function capitalizeFirst(value) {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildSeoMeta(query) {
  const normalizedQuery = toReadableSeoQuery(query);
  if (!normalizedQuery) {
    return {
      title: SEO_BASE_TITLE,
      description: SEO_BASE_DESCRIPTION,
      url: SEO_BASE_URL
    };
  }

  const question = normalizedQuery.startsWith('waar kan ik')
    ? normalizedQuery
    : `waar kan ik ${normalizedQuery} kijken`;

  const intentLabel = question
    .replace(/^waar kan ik\s+/i, '')
    .replace(/\s+kijken$/i, '')
    .trim();

  const descriptionIntent = intentLabel || normalizedQuery;

  return {
    title: `${capitalizeFirst(question)}? | Sportkijken`,
    description: `Bekijk direct waar je ${descriptionIntent} in Nederland kunt kijken: zender/stream, starttijd en gratis of betaald.`,
    url: `${SEO_BASE_URL}?q=${encodeURIComponent(normalizedQuery)}`
  };
}

function canonicalUrlFromLocation() {
  if (typeof window === 'undefined') {
    return SEO_BASE_URL;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const normalizedQuery = toReadableSeoQuery(params.get('q') || '');
    if (!normalizedQuery) {
      return SEO_BASE_URL;
    }
    return `${SEO_BASE_URL}?q=${encodeURIComponent(normalizedQuery)}`;
  } catch (error) {
    return SEO_BASE_URL;
  }
}

function loadPreferences(sportOptions = FALLBACK_SPORT_OPTIONS, providerOptions = FALLBACK_PROVIDER_OPTIONS) {
  const defaults = defaultPreferences(sportOptions, providerOptions);
  const querySearchText = searchTextFromUrl();

  if (typeof window === 'undefined') {
    return defaults;
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return {
        ...defaults,
        searchText: querySearchText || defaults.searchText
      };
    }

    const parsed = JSON.parse(saved);
    const selectedSports = Array.isArray(parsed.selectedSports)
      ? sanitizeSelection(parsed.selectedSports, defaults.selectedSports)
      : defaults.selectedSports;

    const selectedProviders = Array.isArray(parsed.selectedProviders)
      ? sanitizeSelection(parsed.selectedProviders, providerOptions)
      : defaults.selectedProviders;

    return {
      selectedSports: selectedSports.length ? selectedSports : defaults.selectedSports,
      selectedProviders,
      accessFilter: ACCESS_OPTIONS.some((option) => option.id === parsed.accessFilter)
        ? parsed.accessFilter
        : defaults.accessFilter,
      majorFilter: MAJOR_FILTER_OPTIONS.some((option) => option.id === parsed.majorFilter)
        ? parsed.majorFilter
        : defaults.majorFilter,
      rangeFilter: RANGE_OPTIONS.some((option) => option.id === parsed.rangeFilter)
        ? parsed.rangeFilter
        : defaults.rangeFilter,
      searchText: querySearchText || (typeof parsed.searchText === 'string' ? parsed.searchText : defaults.searchText),
      providerSearchText:
        typeof parsed.providerSearchText === 'string' ? parsed.providerSearchText : defaults.providerSearchText,
      providerSelectedOnly:
        typeof parsed.providerSelectedOnly === 'boolean' ? parsed.providerSelectedOnly : defaults.providerSelectedOnly
    };
  } catch (error) {
    return defaults;
  }
}

function loadConsentState() {
  if (typeof window === 'undefined') {
    return 'unknown';
  }

  if (typeof window.getSportkijkenConsent === 'function') {
    const value = window.getSportkijkenConsent();
    if (value === 'granted' || value === 'denied' || value === 'unknown') {
      return value;
    }
  }

  try {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (stored === 'granted' || stored === 'denied') {
      return stored;
    }
  } catch (error) {
    // Ignore storage issues and keep unknown.
  }

  return 'unknown';
}

function normalizeIsoDateTime(value) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= 0) {
    return null;
  }
  return date.toISOString();
}

function loadLastRefreshCheckAt() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return normalizeIsoDateTime(window.localStorage.getItem(REFRESH_STATUS_STORAGE_KEY));
  } catch (error) {
    return null;
  }
}

function persistLastRefreshCheckAt(value) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (value) {
      window.localStorage.setItem(REFRESH_STATUS_STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(REFRESH_STATUS_STORAGE_KEY);
    }
  } catch (error) {
    // Ignore storage failures.
  }
}

function parseLatestRefreshCheckAt(payload) {
  const runs = Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : [];
  if (!runs.length) {
    return null;
  }

  const sortedRuns = [...runs].sort((a, b) => {
    const aTime = new Date(a?.updated_at || a?.run_started_at || a?.created_at || 0).getTime();
    const bTime = new Date(b?.updated_at || b?.run_started_at || b?.created_at || 0).getTime();
    return bTime - aTime;
  });

  const targetedRun = sortedRuns.find((run) => run?.name === 'Update Sports TV Guide Data') || sortedRuns[0];
  return normalizeIsoDateTime(targetedRun?.updated_at || targetedRun?.run_started_at || targetedRun?.created_at);
}

function isReloadNavigation() {
  if (typeof window === 'undefined' || typeof performance === 'undefined') {
    return false;
  }

  const navigationEntry = typeof performance.getEntriesByType === 'function'
    ? performance.getEntriesByType('navigation')?.[0]
    : null;

  if (navigationEntry && typeof navigationEntry.type === 'string') {
    return navigationEntry.type === 'reload';
  }

  // Fallback for older navigation timing implementations.
  return Boolean(performance.navigation && performance.navigation.type === 1);
}

function scrollToPageTop() {
  if (typeof window === 'undefined') {
    return;
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

function loadAnalyticsRuntime() {
  if (typeof window === 'undefined') {
    return DEFAULT_ANALYTICS_RUNTIME;
  }

  if (typeof window.getSportkijkenAnalyticsRuntime === 'function') {
    const value = window.getSportkijkenAnalyticsRuntime();
    if (value && typeof value === 'object') {
      return {
        ...DEFAULT_ANALYTICS_RUNTIME,
        ...value
      };
    }
  }

  return DEFAULT_ANALYTICS_RUNTIME;
}

function escapeIcsValue(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function toIcsDate(date) {
  return date.toISOString().replace(/[-:]/g, '').replace('.000', '');
}

function buildReportIncorrectListingLink(event, sportLabel) {
  if (!event) {
    return GMAIL_COMPOSE_URL;
  }

  const providerSummary = (event.channels || [])
    .map((channel) => {
      const access = channel.access === 'free' ? 'gratis' : 'betaald';
      const conditions = channel.conditions ? ` - ${channel.conditions}` : '';
      return `${channel.name} (${channel.platform}, ${access})${conditions}`;
    })
    .join('\n');

  const subject = `Incorrect listing: ${event.title || 'Sportevent'}`;
  const body = [
    'Hi, I found an incorrect listing on Sportkijken.',
    '',
    `Event: ${event.title || '-'}`,
    `Sport: ${sportLabel || event.sport || '-'}`,
    `Competition: ${event.competition || '-'}`,
    `Date (NL): ${DATE_FORMATTER.format(event.startDate)} ${TIME_FORMATTER.format(event.startDate)}-${TIME_FORMATTER.format(event.endDate)}`,
    `Event ID: ${event.id || '-'}`,
    '',
    'Shown providers:',
    providerSummary || '-',
    '',
    'What seems wrong:',
    '- ',
    '',
    `Page URL: ${typeof window !== 'undefined' ? window.location.href : ''}`
  ].join('\n');

  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function trackAnalyticsEvent(eventName, params = {}) {
  if (typeof window === 'undefined' || !eventName) {
    return;
  }

  if (typeof window.trackSportkijkenEvent === 'function') {
    window.trackSportkijkenEvent(eventName, params);
    return;
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

function hasAccess(event, accessFilter) {
  if (accessFilter === 'all') {
    return true;
  }
  return event.channels.some((channel) => channel.access === accessFilter);
}

function eventContentType(event) {
  return event.contentType === 'broadcast' ? 'broadcast' : 'match';
}

function hasProvider(event, selectedProviders) {
  if (!selectedProviders.length) {
    return false;
  }
  const selected = expandedProviderSelection(selectedProviders);
  return event.channels.some((channel) => selected.has(normalizeProviderName(channel.name)));
}

function getEventAccessLabel(event) {
  const hasFree = event.channels.some((channel) => channel.access === 'free');
  const hasPaid = event.channels.some((channel) => channel.access === 'paid');

  if (hasFree && hasPaid) {
    return 'Gratis + betaald';
  }
  if (hasFree) {
    return 'Gratis';
  }
  return 'Betaald';
}

const MAJOR_GROUP_ORDER = [
  'Paralympische Spelen',
  'Olympische Spelen',
  'Wereldbekers en WK',
  'Nationale Kampioenschappen'
];

const NATIONAL_CHAMPIONSHIP_PATTERNS = [
  /\bnationaal(?:\s+of)?\s+kampioenschap(?:pen)?\b/,
  /\bnationale\s+kampioenschap(?:pen)?\b/,
  /\bnederlands?\s+kampioenschap(?:pen)?\b/,
  /\bnederlandse\s+kampioenschap(?:pen)?\b/,
  /\bnational championship(?:s)?\b/,
  /\bkampioenschap(?:pen)?\s+van\s+nederland\b/,
  /\bdutch championships?\b/,
  /\bnk\s+(?:allround|afstanden|sprint|indoor|outdoor|atletiek|wielrennen|veldrijden|tijdrit|judo|turnen|zwemmen|schaatsen|tafeltennis|badminton|hockey|volleybal|handbal|boksen|roeien|zeilen|triatlon|marathon)\b/
];

function isNationalChampionshipEvent(haystack) {
  return NATIONAL_CHAMPIONSHIP_PATTERNS.some((pattern) => pattern.test(haystack));
}

function majorGroupForEvent(event) {
  const haystack = `${event.title || ''} ${event.competition || ''} ${event.notes || ''}`.toLowerCase();

  if (haystack.includes('paralymp')) {
    return 'Paralympische Spelen';
  }

  if (haystack.includes('olymp')) {
    return 'Olympische Spelen';
  }

  if (
    haystack.includes('world cup')
    || haystack.includes('wereldbeker')
    || haystack.includes('wereldkampioenschap')
    || haystack.includes(' wk')
    || haystack.startsWith('wk ')
  ) {
    return 'Wereldbekers en WK';
  }

  if (
    isNationalChampionshipEvent(haystack)
  ) {
    return 'Nationale Kampioenschappen';
  }

  return null;
}

function matchesMajorFilter(event, majorFilter) {
  if (majorFilter === 'all') {
    return true;
  }

  const isMajor = Boolean(majorGroupForEvent(event));
  if (majorFilter === 'major') {
    return isMajor;
  }
  if (majorFilter === 'regular') {
    return !isMajor;
  }
  return true;
}

function App() {
  const [dataset, setDataset] = useState(loadCachedDataset);
  const [preferences, setPreferences] = useState(() => loadPreferences(FALLBACK_SPORT_OPTIONS, FALLBACK_PROVIDER_OPTIONS));
  const [providersExpanded, setProvidersExpanded] = useState(false);
  const [consentState, setConsentState] = useState(loadConsentState);
  const [analyticsRuntime, setAnalyticsRuntime] = useState(loadAnalyticsRuntime);
  const [emailCopied, setEmailCopied] = useState(false);
  const [lastRefreshCheckAt, setLastRefreshCheckAt] = useState(loadLastRefreshCheckAt);
  const shouldForceTopOnLoadRef = useRef(false);
  const datasetSnapshotRef = useRef(dataset);
  const previousOptionsRef = useRef({
    sports: FALLBACK_SPORT_OPTIONS.map((sport) => sport.id),
    providers: FALLBACK_PROVIDER_OPTIONS
  });

  const sourceEvents = useMemo(
    () => (Array.isArray(dataset.events) ? dataset.events : []),
    [dataset.events]
  );

  const sportOptions = useMemo(() => buildSportOptions(sourceEvents), [sourceEvents]);
  const providerOptions = useMemo(() => buildProviderOptions(sourceEvents), [sourceEvents]);
  const sportLookup = useMemo(
    () => Object.fromEntries(sportOptions.map((sport) => [sport.id, sport])),
    [sportOptions]
  );

  const events = useMemo(() => {
    return [...sourceEvents]
      .map((event) => ({
        ...event,
        channels: Array.isArray(event.channels) ? event.channels : [],
        durationMinutes: Number.isFinite(event.durationMinutes) && event.durationMinutes > 0 ? event.durationMinutes : 120,
        startDate: new Date(event.start),
        endDate: new Date(new Date(event.start).getTime() + (Number.isFinite(event.durationMinutes) && event.durationMinutes > 0 ? event.durationMinutes : 120) * 60000)
      }))
      .filter((event) => Number.isFinite(event.startDate.getTime()) && Number.isFinite(event.endDate.getTime()))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [sourceEvents]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (!isReloadNavigation()) {
      return undefined;
    }

    shouldForceTopOnLoadRef.current = true;

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    scrollToPageTop();
    const timeoutA = window.setTimeout(scrollToPageTop, 120);
    const timeoutB = window.setTimeout(scrollToPageTop, 450);

    return () => {
      window.clearTimeout(timeoutA);
      window.clearTimeout(timeoutB);
    };
  }, []);

  useEffect(() => {
    if (!shouldForceTopOnLoadRef.current) {
      return;
    }

    if (!dataset.generatedAt) {
      return;
    }

    scrollToPageTop();
    shouldForceTopOnLoadRef.current = false;
  }, [dataset.generatedAt]);

  useEffect(() => {
    datasetSnapshotRef.current = dataset;
  }, [dataset]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let cancelled = false;

    const ensureBundledFallbackDataset = async () => {
      const current = datasetSnapshotRef.current || EMPTY_DATASET;
      const hasCurrentEvents = Array.isArray(current.events) && current.events.length > 0;
      if (hasCurrentEvents) {
        return false;
      }

      try {
        const module = await import('./data/events.nl.json');
        const payload = normalizeRuntimeDataset(module?.default);
        if (!payload || cancelled) {
          return false;
        }

        setDataset((existing) => {
          const existingCount = Array.isArray(existing?.events) ? existing.events.length : 0;
          if (existingCount > 0) {
            return existing;
          }
          persistCachedDataset(payload);
          return payload;
        });
        return true;
      } catch (error) {
        return false;
      }
    };

    const fetchRuntimeDataset = async () => {
      try {
        const response = await fetch(RUNTIME_DATASET_URL, { cache: 'no-cache' });
        if (!response.ok) {
          return false;
        }

        const payload = normalizeRuntimeDataset(await response.json());
        if (!payload || cancelled) {
          return false;
        }

        setDataset((current) => {
          const currentGeneratedAt = current?.generatedAt || '';
          const nextGeneratedAt = payload.generatedAt || '';
          const currentCount = Array.isArray(current?.events) ? current.events.length : 0;
          const nextCount = payload.events.length;
          if (currentGeneratedAt === nextGeneratedAt && currentCount === nextCount) {
            return current;
          }

          trackAnalyticsEvent('runtime_dataset_refresh', {
            from_generated_at: currentGeneratedAt || 'unknown',
            to_generated_at: nextGeneratedAt || 'unknown',
            events: nextCount
          });

          persistCachedDataset(payload);
          return payload;
        });
        return true;
      } catch (error) {
        return false;
      }
    };

    const fetchRuntimeDatasetMeta = async () => {
      try {
        const response = await fetch(`${RUNTIME_DATASET_META_URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) {
          return null;
        }
        return normalizeRuntimeDatasetMeta(await response.json());
      } catch (error) {
        return null;
      }
    };

    const refreshDataset = async (forceFull = false) => {
      if (forceFull) {
        const updated = await fetchRuntimeDataset();
        if (!updated) {
          await ensureBundledFallbackDataset();
        }
        return;
      }

      const current = datasetSnapshotRef.current || EMPTY_DATASET;
      const currentGeneratedAt = normalizeIsoDateTime(current.generatedAt);
      const currentCount = Array.isArray(current.events) ? current.events.length : 0;

      const meta = await fetchRuntimeDatasetMeta();
      if (!meta) {
        if (!currentCount) {
          const updated = await fetchRuntimeDataset();
          if (!updated) {
            await ensureBundledFallbackDataset();
          }
        }
        return;
      }

      const generatedChanged = Boolean(meta.generatedAt && meta.generatedAt !== currentGeneratedAt);
      const countChanged = Number.isFinite(meta.eventCount) && meta.eventCount !== currentCount;

      if (generatedChanged || countChanged || (!currentGeneratedAt && !currentCount)) {
        const updated = await fetchRuntimeDataset();
        if (!updated) {
          await ensureBundledFallbackDataset();
        }
      }
    };

    const hasCachedEvents = Array.isArray(datasetSnapshotRef.current?.events) && datasetSnapshotRef.current.events.length > 0;
    refreshDataset(!hasCachedEvents);

    const intervalId = window.setInterval(() => {
      refreshDataset(false);
    }, RUNTIME_DATASET_POLL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshDataset(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const nextSportIds = sportOptions.map((sport) => sport.id);
    const nextProviders = providerOptions;
    const previousSportIds = previousOptionsRef.current.sports;
    const previousProviders = previousOptionsRef.current.providers;

    setPreferences((current) => {
      const currentSportSet = new Set(current.selectedSports);
      const currentProviderSet = new Set(current.selectedProviders);
      const hadAllPreviousSports = previousSportIds.length > 0 && previousSportIds.every((id) => currentSportSet.has(id));
      const hadAllPreviousProviders = previousProviders.length > 0 && previousProviders.every((provider) => currentProviderSet.has(provider));

      let selectedSports = sanitizeSelection(current.selectedSports, nextSportIds);
      let selectedProviders = sanitizeSelection(current.selectedProviders, nextProviders);

      if (hadAllPreviousSports) {
        selectedSports = nextSportIds;
      }
      if (hadAllPreviousProviders) {
        selectedProviders = nextProviders;
      }

      if (
        areSameStringArrays(current.selectedSports, selectedSports)
        && areSameStringArrays(current.selectedProviders, selectedProviders)
      ) {
        return current;
      }

      return {
        ...current,
        selectedSports,
        selectedProviders
      };
    });

    previousOptionsRef.current = {
      sports: nextSportIds,
      providers: nextProviders
    };
  }, [providerOptions, sportOptions]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      // Storage might be blocked; the app still functions without persistence.
    }
  }, [preferences]);

  useEffect(() => {
    if (consentState !== 'granted') {
      return;
    }

    trackAnalyticsEvent('sportkijken_view', { page: 'home' });
  }, [consentState]);

  useEffect(() => {
    const seo = buildSeoMeta(preferences.searchText);
    if (typeof document === 'undefined') {
      return;
    }

    document.title = seo.title;
    setOrCreateMetaTag('meta[name="description"]', { name: 'description' }, seo.description);
    setOrCreateMetaTag('meta[property="og:title"]', { property: 'og:title' }, seo.title);
    setOrCreateMetaTag('meta[property="og:description"]', { property: 'og:description' }, seo.description);
    const canonicalUrl = canonicalUrlFromLocation();
    setOrCreateMetaTag('meta[property="og:url"]', { property: 'og:url' }, canonicalUrl);
    setOrCreateMetaTag('meta[name="twitter:title"]', { name: 'twitter:title' }, seo.title);
    setOrCreateMetaTag('meta[name="twitter:description"]', { name: 'twitter:description' }, seo.description);
    setCanonicalHref(canonicalUrl);
  }, [preferences.searchText]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let cancelled = false;

    const fetchRefreshStatus = async () => {
      for (const url of REFRESH_STATUS_URLS) {
        try {
          const response = await fetch(`${url}&t=${Date.now()}`, { cache: 'no-store' });
          if (!response.ok) {
            continue;
          }

          const payload = await response.json();
          const checkedAt = parseLatestRefreshCheckAt(payload);
          if (!cancelled && checkedAt) {
            setLastRefreshCheckAt(checkedAt);
            persistLastRefreshCheckAt(checkedAt);
            return;
          }
        } catch (error) {
          // Try next endpoint before giving up.
        }
      }
    };

    fetchRefreshStatus();
    const intervalId = window.setInterval(fetchRefreshStatus, 15 * 60 * 1000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchRefreshStatus();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncConsent = (event) => {
      const detailState = event?.detail?.state;
      if (detailState === 'granted' || detailState === 'denied' || detailState === 'unknown') {
        setConsentState(detailState);
        return;
      }
      setConsentState(loadConsentState());
    };

    window.addEventListener('sportkijken-consent-changed', syncConsent);
    return () => window.removeEventListener('sportkijken-consent-changed', syncConsent);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncAnalyticsRuntime = (event) => {
      const detail = event?.detail;
      if (detail && typeof detail === 'object') {
        setAnalyticsRuntime((current) => ({ ...current, ...detail }));
        return;
      }
      setAnalyticsRuntime(loadAnalyticsRuntime());
    };

    window.addEventListener('sportkijken-analytics-runtime-changed', syncAnalyticsRuntime);
    return () => window.removeEventListener('sportkijken-analytics-runtime-changed', syncAnalyticsRuntime);
  }, []);

  const datasetStatus = useMemo(() => {
    const generatedAt = new Date(dataset.generatedAt || 0);
    const generatedMs = generatedAt.getTime();
    const datasetAgeMinutes = Number.isFinite(generatedMs) && generatedMs > 0
      ? Math.max(0, Math.round((Date.now() - generatedMs) / 60000))
      : null;

    if (!lastRefreshCheckAt && datasetAgeMinutes === null) {
      return {
        level: 'notice',
        message: 'Dataset wordt geladen...'
      };
    }

    if (!lastRefreshCheckAt) {
      if (datasetAgeMinutes !== null && datasetAgeMinutes > 240) {
        return {
          level: 'notice',
          message: `Laatste datasetcommit is ${formatAgeLabel(datasetAgeMinutes)} oud; recente workflow-check tijdelijk onbekend.`
        };
      }

      return {
        level: 'notice',
        message: 'Recente broncontrole tijdelijk onbekend; toon laatste datasetwijziging.'
      };
    }

    const referenceAt = lastRefreshCheckAt;
    const referenceDate = new Date(referenceAt);
    const referenceMs = referenceDate.getTime();
    if (!Number.isFinite(referenceMs) || referenceMs <= 0) {
      return {
        level: 'warning',
        message: 'Kon geen geldige update-tijd bepalen.'
      };
    }

    const ageMinutes = Math.max(0, Math.round((Date.now() - referenceMs) / 60000));
    if (ageMinutes > 240) {
      return {
        level: 'warning',
        message: `Laatste workflow-check is ${formatAgeLabel(ageMinutes)} geleden. Controleer zenderinformatie extra goed.`
      };
    }
    if (ageMinutes > 120) {
      return {
        level: 'notice',
        message: `Laatste workflow-check: ${formatAgeLabel(ageMinutes)} geleden.`
      };
    }

    if (datasetAgeMinutes !== null && lastRefreshCheckAt && datasetAgeMinutes > 180) {
      return {
        level: 'ok',
        message: `Workflow-check ${formatAgeLabel(ageMinutes)} geleden; geen nieuwe datasetcommit sinds ${formatAgeLabel(datasetAgeMinutes)}.`
      };
    }

    return {
      level: 'ok',
      message: `Workflow-check ${formatAgeLabel(ageMinutes)} geleden.`
    };
  }, [dataset.generatedAt, lastRefreshCheckAt]);

  const filteredEvents = useMemo(() => {
    const now = new Date();
    const matchThreshold = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const broadcastThreshold = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    let rangeMax = null;
    if (preferences.rangeFilter === '7d') {
      rangeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (preferences.rangeFilter === '30d') {
      rangeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    const text = preferences.searchText.trim().toLowerCase();

    return events.filter((event) => {
      if (!preferences.selectedSports.includes(event.sport)) {
        return false;
      }

      if (!hasProvider(event, preferences.selectedProviders)) {
        return false;
      }

      const eventThreshold = eventContentType(event) === 'broadcast' ? broadcastThreshold : matchThreshold;
      if (event.startDate < eventThreshold) {
        return false;
      }

      if (rangeMax && event.startDate > rangeMax) {
        return false;
      }

      if (!hasAccess(event, preferences.accessFilter)) {
        return false;
      }

      if (!matchesMajorFilter(event, preferences.majorFilter)) {
        return false;
      }

      if (!text) {
        return true;
      }

      return [
        event.title,
        event.competition,
        event.location,
        ...(event.channels || []).map((channel) => channel.name)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(text);
    });
  }, [events, preferences]);

  const groupedEvents = useMemo(() => {
    const map = new Map();

    filteredEvents.forEach((event) => {
      const dayKey = DAY_KEY_FORMATTER.format(event.startDate);
      const existing = map.get(dayKey);

      if (existing) {
        existing.events.push(event);
      } else {
        map.set(dayKey, {
          key: dayKey,
          label: DATE_FORMATTER.format(event.startDate),
          dayNumber: DAY_NUMBER_FORMATTER.format(event.startDate),
          events: [event]
        });
      }
    });

    return [...map.values()].map((dayGroup) => {
      const majorMap = new Map();
      const regularEvents = [];

      dayGroup.events.forEach((event) => {
        const major = majorGroupForEvent(event);
        if (!major) {
          regularEvents.push(event);
          return;
        }

        const bucket = majorMap.get(major);
        if (bucket) {
          bucket.events.push(event);
        } else {
          majorMap.set(major, { label: major, events: [event] });
        }
      });

      const majorGroups = MAJOR_GROUP_ORDER
        .filter((label) => majorMap.has(label))
        .map((label) => majorMap.get(label));

      return {
        ...dayGroup,
        majorGroups,
        regularEvents
      };
    });
  }, [filteredEvents]);

  const counters = useMemo(() => {
    const free = filteredEvents.filter((event) => event.channels.some((channel) => channel.access === 'free')).length;
    const paid = filteredEvents.filter((event) => event.channels.some((channel) => channel.access === 'paid')).length;

    return {
      total: filteredEvents.length,
      free,
      paid,
      nextEvent: filteredEvents[0] || null
    };
  }, [filteredEvents]);

  const providerOptionsForView = useMemo(() => {
    const query = preferences.providerSearchText.trim().toLowerCase();
    const selectedSet = new Set(preferences.selectedProviders);
    const filtered = providerOptions.filter((provider) => !query || provider.toLowerCase().includes(query));
    const visible = preferences.providerSelectedOnly
      ? filtered.filter((provider) => selectedSet.has(provider))
      : filtered;

    return visible.sort((a, b) => {
      const aSelected = selectedSet.has(a);
      const bSelected = selectedSet.has(b);
      if (aSelected !== bSelected) {
        return aSelected ? -1 : 1;
      }
      return a.localeCompare(b, 'nl-NL');
    });
  }, [preferences.providerSearchText, preferences.providerSelectedOnly, preferences.selectedProviders, providerOptions]);

  const providerListIsConstrained = preferences.providerSearchText.trim() !== '' || preferences.providerSelectedOnly;
  const visibleProviders = !providerListIsConstrained && !providersExpanded
    ? providerOptionsForView.slice(0, PROVIDER_VISIBLE_LIMIT)
    : providerOptionsForView;
  const hiddenProviderCount = providerOptionsForView.length - visibleProviders.length;

  const toggleSport = (sportId) => {
    setPreferences((current) => {
      const willBeSelected = !current.selectedSports.includes(sportId);
      const selected = willBeSelected
        ? [...current.selectedSports, sportId]
        : current.selectedSports.filter((id) => id !== sportId);

      trackAnalyticsEvent('filter_sport_toggle', {
        sport: sportId,
        selected: willBeSelected ? 'yes' : 'no'
      });

      return {
        ...current,
        selectedSports: selected
      };
    });
  };

  const toggleProvider = (provider) => {
    setPreferences((current) => {
      const willBeSelected = !current.selectedProviders.includes(provider);
      const selected = willBeSelected
        ? [...current.selectedProviders, provider]
        : current.selectedProviders.filter((item) => item !== provider);

      trackAnalyticsEvent('filter_provider_toggle', {
        provider,
        selected: willBeSelected ? 'yes' : 'no'
      });

      return {
        ...current,
        selectedProviders: selected
      };
    });
  };

  const selectAllSports = () => {
    trackAnalyticsEvent('filter_sport_bulk', { mode: 'all' });
    setPreferences((current) => ({
      ...current,
      selectedSports: sportOptions.map((sport) => sport.id)
    }));
  };

  const clearSports = () => {
    trackAnalyticsEvent('filter_sport_bulk', { mode: 'none' });
    setPreferences((current) => ({
      ...current,
      selectedSports: []
    }));
  };

  const selectAllProviders = () => {
    trackAnalyticsEvent('filter_provider_bulk', { mode: 'all' });
    setPreferences((current) => ({
      ...current,
      selectedProviders: providerOptions
    }));
  };

  const clearProviders = () => {
    trackAnalyticsEvent('filter_provider_bulk', { mode: 'none' });
    setPreferences((current) => ({
      ...current,
      selectedProviders: []
    }));
  };

  const setRangeFilter = (rangeId) => {
    trackAnalyticsEvent('filter_range_change', { range: rangeId });
    setPreferences((current) => ({ ...current, rangeFilter: rangeId }));
  };

  const setAccessFilter = (accessId) => {
    trackAnalyticsEvent('filter_access_change', { access: accessId });
    setPreferences((current) => ({ ...current, accessFilter: accessId }));
  };

  const setMajorFilter = (majorId) => {
    trackAnalyticsEvent('filter_major_change', { major: majorId });
    setPreferences((current) => ({ ...current, majorFilter: majorId }));
  };

  const setConsent = (nextState) => {
    if (typeof window === 'undefined') {
      return;
    }

    setConsentState(nextState);
    if (typeof window.setSportkijkenConsent === 'function') {
      let appliedViaGlobal = false;
      try {
        window.setSportkijkenConsent(nextState);
        appliedViaGlobal = true;
      } catch (error) {
        // Fall back to local storage when the global setter fails.
      }
      if (appliedViaGlobal) {
        setAnalyticsRuntime(loadAnalyticsRuntime());
        return;
      }
    }

    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, nextState);
    } catch (error) {
      // Ignore localStorage issues.
    }
    setConsentState(nextState);
    setAnalyticsRuntime((current) => ({
      ...current,
      consent: nextState
    }));
  };

  const analyticsStatus = useMemo(() => {
    if (consentState !== 'granted') {
      return { level: 'off', message: 'Analytics is disabled.' };
    }

    if (analyticsRuntime.lastError === 'script_load_failed' || analyticsRuntime.lastError === 'script_load_timeout') {
      return { level: 'warning', message: 'Analytics blocked by browser/privacy settings.' };
    }

    if (analyticsRuntime.configured || analyticsRuntime.scriptReady) {
      return { level: 'on', message: 'Analytics active.' };
    }

    if (analyticsRuntime.scriptRequested) {
      return { level: 'notice', message: 'Connecting analytics...' };
    }

    return { level: 'notice', message: 'Waiting for analytics startup...' };
  }, [analyticsRuntime, consentState]);

  const copyContactEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setEmailCopied(true);
      window.setTimeout(() => setEmailCopied(false), 2000);
      trackAnalyticsEvent('contact_email_copy', {});
    } catch (error) {
      setEmailCopied(false);
    }
  };

  const exportVisibleEventsAsIcs = () => {
    if (!filteredEvents.length) {
      return;
    }

    trackAnalyticsEvent('export_ics', { events: filteredEvents.length });

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Sportkijken//NL//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    const nowStamp = toIcsDate(new Date());

    filteredEvents.forEach((event) => {
      const channels = event.channels
        .map((channel) => {
          const base = `${channel.name} (${channel.access === 'free' ? 'gratis' : 'betaald'})`;
          const withCondition = channel.conditions ? `${base} - ${channel.conditions}` : base;
          return channel.url ? `${withCondition} ${channel.url}` : withCondition;
        })
        .join(', ');

      const descriptionLines = [
        `Competitie: ${event.competition}`,
        `Waar te kijken: ${channels}`,
        event.verification
          ? `Betrouwbaarheid: ${event.verification.confidence} (${event.verification.reason})`
          : null,
        event.notes || 'Controleer het uitzendschema op de wedstrijddag.'
      ].filter(Boolean);

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${event.id}@sportkijken.paulzuiderduin.com`);
      lines.push(`DTSTAMP:${nowStamp}`);
      lines.push(`DTSTART:${toIcsDate(event.startDate)}`);
      lines.push(`DTEND:${toIcsDate(event.endDate)}`);
      lines.push(`SUMMARY:${escapeIcsValue(`${sportMetaFor(event.sport, sportLookup).label}: ${event.title}`)}`);
      lines.push(`DESCRIPTION:${escapeIcsValue(descriptionLines.join('\n'))}`);
      lines.push(`LOCATION:${escapeIcsValue(event.location || 'Nederland')}`);
      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sportkijken-selectie.ics';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const renderEventCard = (event) => {
    const sportMeta = sportMetaFor(event.sport, sportLookup);
    const reportLink = buildReportIncorrectListingLink(event, sportMeta.label);

    return (
      <div key={event.id} className="event-card">
        <div className="event-meta">
          <span
            className="sport-dot"
            style={{ background: sportMeta.accent }}
            aria-hidden="true"
          />
          <p>{sportMeta.label}</p>
          <span className="divider">•</span>
          <p>{event.competition}</p>
        </div>

        <h3>{event.title}</h3>

        <p className="event-time">
          {TIME_FORMATTER.format(event.startDate)} - {TIME_FORMATTER.format(event.endDate)} uur (NL)
        </p>

        <ul className="channel-list">
          {event.channels.map((channel) => (
            <li key={`${event.id}-${channel.name}-${channel.platform}`}>
              <div className="channel-main">
                {channel.url ? (
                  <a
                    className="channel-link"
                    href={channel.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      trackAnalyticsEvent('outbound_stream_click', {
                        provider: channel.name,
                        access: channel.access,
                        sport: event.sport
                      });
                    }}
                  >
                    {channel.name} ({channel.platform})
                  </a>
                ) : (
                  <span>{channel.name} ({channel.platform})</span>
                )}
                {channel.conditions ? <small className="channel-condition">{channel.conditions}</small> : null}
              </div>
              <span className={`access ${channel.access}`}>{channel.access === 'free' ? 'Gratis' : 'Betaald'}</span>
            </li>
          ))}
        </ul>

        <footer>
          <span className={`event-access ${getEventAccessLabel(event) === 'Gratis' ? 'free' : 'paid'}`}>
            {getEventAccessLabel(event)}
          </span>
          <a
            className="report-link"
            href={reportLink}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              trackAnalyticsEvent('report_incorrect_listing_click', {
                sport: event.sport,
                event_id: event.id,
                competition: event.competition || 'unknown'
              });
            }}
          >
            Report incorrect listing
          </a>
        </footer>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="ambient ambient-top" />
      <div className="ambient ambient-bottom" />

      <main className="shell">
        <section className="hero">
          <div>
            <p className="kicker">Sportkijken Nederland</p>
            <h1>Wanneer en waar sport kijken, zonder eindeloos zoeken.</h1>
            <p className="intro">
              Kies je sporten en aanbieders voor Nederland: starttijd, zender/stream en gratis of betaald in een overzicht.
            </p>
            <div className="hero-actions">
              <button
                type="button"
                className="primary"
                onClick={exportVisibleEventsAsIcs}
                disabled={!filteredEvents.length}
                title={!filteredEvents.length ? 'Geen events in huidige selectie' : undefined}
              >
                {filteredEvents.length
                  ? `Exporteer ${filteredEvents.length} events als .ics`
                  : 'Exporteer selectie als .ics'}
              </button>
              <a className="ghost contact-cta" href="https://ko-fi.com/Y8Y41QY1SE" target="_blank" rel="noreferrer">
                Support op Ko-fi
              </a>
              <a
                className="ghost contact-cta"
                href={GMAIL_COMPOSE_URL}
                target="_blank"
                rel="noreferrer"
              >
                Contact: {CONTACT_EMAIL}
              </a>
              <button type="button" className="ghost contact-cta" onClick={copyContactEmail}>
                {emailCopied ? 'E-mailadres gekopieerd' : 'Kopieer e-mailadres'}
              </button>
              <p className="beta-note">Met live-updates elke ~3 uur en aanbiederfilters, inclusief NOS-livestreams.</p>
            </div>
          </div>
          <aside className="summary-card">
            <p className="kicker">Overzicht</p>
            <div className="summary-grid">
              <div>
                <span>Totaal</span>
                <strong>{counters.total}</strong>
              </div>
              <div>
                <span>Gratis</span>
                <strong>{counters.free}</strong>
              </div>
              <div>
                <span>Betaald</span>
                <strong>{counters.paid}</strong>
              </div>
            </div>
            <div className="next-event">
              <span>Volgende event</span>
              {counters.nextEvent ? (
                <strong>
                  {sportMetaFor(counters.nextEvent.sport, sportLookup).label} • {TIME_FORMATTER.format(counters.nextEvent.startDate)}
                </strong>
              ) : (
                <strong>Geen event in huidige filters</strong>
              )}
            </div>
          </aside>
        </section>

        {consentState === 'unknown' ? (
          <section className="panel consent-banner" role="region" aria-label="Privacy-instellingen">
            <p>
              We gebruiken optionele analytics (GA4) alleen met jouw toestemming.
            </p>
            <div className="consent-actions">
              <button
                type="button"
                className="primary"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setConsent('granted');
                }}
              >
                Toestaan
              </button>
              <button
                type="button"
                className="ghost"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setConsent('denied');
                }}
              >
                Niet toestaan
              </button>
            </div>
          </section>
        ) : null}

        <section className="panel filters-panel">
          <div className="filter-group">
            <p className="filter-title">Sporten</p>
            <div className="sport-grid">
              {sportOptions.map((sport) => {
                const selected = preferences.selectedSports.includes(sport.id);
                return (
                  <button
                    key={sport.id}
                    type="button"
                    className={`chip sport-chip ${selected ? 'is-selected' : ''}`}
                    onClick={() => toggleSport(sport.id)}
                    aria-pressed={selected}
                    style={{ '--chip-accent': sport.accent }}
                  >
                    {sport.label}
                  </button>
                );
              })}
            </div>
            <div className="chip-actions">
              <button type="button" className="ghost" onClick={selectAllSports}>Alles</button>
              <button type="button" className="ghost" onClick={clearSports}>Geen</button>
            </div>
          </div>

          <div className="filter-group">
            <p className="filter-title">Aanbieders</p>
            <div className="provider-tools">
              <input
                type="search"
                value={preferences.providerSearchText}
                onChange={(event) => {
                  setProvidersExpanded(false);
                  setPreferences((current) => ({ ...current, providerSearchText: event.target.value }));
                }}
                onBlur={(event) => {
                  const value = event.target.value.trim();
                  if (!value) return;
                  trackAnalyticsEvent('provider_search', { query_length: value.length });
                }}
                placeholder="Zoek aanbieder"
                aria-label="Zoek aanbieder"
              />
              <button
                type="button"
                className={`ghost compact ${preferences.providerSelectedOnly ? 'is-active' : ''}`}
                onClick={() => {
                  const nextSelectedOnly = !preferences.providerSelectedOnly;
                  trackAnalyticsEvent('provider_view_mode', { mode: nextSelectedOnly ? 'selected_only' : 'all' });
                  setProvidersExpanded(false);
                  setPreferences((current) => ({
                    ...current,
                    providerSelectedOnly: !current.providerSelectedOnly
                  }));
                }}
                aria-pressed={preferences.providerSelectedOnly}
              >
                {preferences.providerSelectedOnly ? 'Toon alles' : 'Alleen geselecteerd'}
              </button>
            </div>
            <p className="provider-hint">
              {visibleProviders.length} van {providerOptionsForView.length} zichtbaar • {preferences.selectedProviders.length} geselecteerd
            </p>
            <div className="provider-grid">
              {visibleProviders.map((provider) => {
                const selected = preferences.selectedProviders.includes(provider);
                return (
                  <button
                    key={provider}
                    type="button"
                    className={`chip provider-chip ${selected ? 'is-selected' : ''}`}
                    onClick={() => toggleProvider(provider)}
                    aria-pressed={selected}
                  >
                    {provider}
                  </button>
                );
              })}
            </div>
            {!visibleProviders.length ? <p className="provider-empty">Geen aanbieders gevonden.</p> : null}
            {hiddenProviderCount > 0 ? (
              <div className="chip-actions">
                <button
                  type="button"
                  className="ghost compact"
                  onClick={() => {
                    trackAnalyticsEvent('provider_list_expand', { hidden: hiddenProviderCount });
                    setProvidersExpanded(true);
                  }}
                >
                  Toon nog {hiddenProviderCount}
                </button>
              </div>
            ) : null}
            {!providerListIsConstrained && providersExpanded && providerOptionsForView.length > PROVIDER_VISIBLE_LIMIT ? (
              <div className="chip-actions">
                <button
                  type="button"
                  className="ghost compact"
                  onClick={() => {
                    trackAnalyticsEvent('provider_list_collapse', {});
                    setProvidersExpanded(false);
                  }}
                >
                  Minder tonen
                </button>
              </div>
            ) : null}
            <div className="chip-actions">
              <button type="button" className="ghost" onClick={selectAllProviders}>Alles</button>
              <button type="button" className="ghost" onClick={clearProviders}>Geen</button>
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-group inline-group">
              <p className="filter-title">Periode</p>
              <div className="chips-inline">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`chip ${preferences.rangeFilter === option.id ? 'is-selected' : ''}`}
                    onClick={() => setRangeFilter(option.id)}
                    aria-pressed={preferences.rangeFilter === option.id}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group inline-group">
              <p className="filter-title">Toegang</p>
              <div className="chips-inline">
                {ACCESS_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`chip ${preferences.accessFilter === option.id ? 'is-selected' : ''}`}
                    onClick={() => setAccessFilter(option.id)}
                    aria-pressed={preferences.accessFilter === option.id}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group inline-group">
              <p className="filter-title">Grote events</p>
              <div className="chips-inline">
                {MAJOR_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`chip ${preferences.majorFilter === option.id ? 'is-selected' : ''}`}
                    onClick={() => setMajorFilter(option.id)}
                    aria-pressed={preferences.majorFilter === option.id}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group search-group">
              <label className="filter-title" htmlFor="search">Zoeken</label>
              <input
                id="search"
                type="search"
                value={preferences.searchText}
                onChange={(event) => setPreferences((current) => ({ ...current, searchText: event.target.value }))}
                onBlur={(event) => {
                  const value = event.target.value.trim();
                  if (!value) return;
                  trackAnalyticsEvent('search_used', { query_length: value.length });
                }}
                placeholder="team, toernooi, aanbieder of locatie"
              />
            </div>
          </div>
        </section>

        <section className="panel notice-panel">
          <div className="notice-meta">
            <span className="dataset-label">Dataset</span>
            <span>
              {dataset.isDemo
                ? 'Handmatige demo-dataset.'
                : 'Automatisch ververst (~3 uur) via NOS, Ziggo, ESPN, Viaplay en HBO Max.'}
            </span>
            <span>
              Laatste workflow-check: {lastRefreshCheckAt
                ? formatDatasetDateTime(lastRefreshCheckAt)
                : 'Tijdelijk onbekend'}
            </span>
            <span>
              Laatste datasetcommit: {formatDatasetDateTime(dataset.generatedAt)}
            </span>
            <span className={`dataset-status ${datasetStatus.level}`}>{datasetStatus.message}</span>
          </div>
          <div className="notice-actions">
            <span>Privacy:</span>
            <button
              type="button"
              className={`ghost compact ${consentState === 'granted' ? 'is-active' : ''}`}
              onClick={() => setConsent('granted')}
              aria-pressed={consentState === 'granted'}
            >
              Analytics aan
            </button>
            <button
              type="button"
              className={`ghost compact ${consentState === 'denied' ? 'is-active' : ''}`}
              onClick={() => setConsent('denied')}
              aria-pressed={consentState === 'denied'}
            >
              Analytics uit
            </button>
            <span className={`analytics-runtime ${analyticsStatus.level}`}>{analyticsStatus.message}</span>
          </div>
        </section>

        <section className="agenda">
          {groupedEvents.length === 0 ? (
            <article className="panel empty-state">
              <h2>Geen events met deze filters</h2>
              <p>Pas je sport-, aanbieder-, periode-, toegang- of grote-events-filter aan om resultaten te zien.</p>
            </article>
          ) : (
            groupedEvents.map((group) => (
              <article key={group.key} className="day-block">
                <header>
                  <p className="day-number">{group.dayNumber}</p>
                  <h2>{group.label}</h2>
                </header>

                {group.majorGroups.map((majorGroup) => (
                  <section key={`${group.key}-${majorGroup.label}`} className="major-group">
                    <h3 className="major-group-title">{majorGroup.label}</h3>
                    <div className="cards">
                      {majorGroup.events.map(renderEventCard)}
                    </div>
                  </section>
                ))}

                {group.regularEvents.length ? (
                  <section className="major-group">
                    {group.majorGroups.length ? <h3 className="major-group-title secondary">Overige events</h3> : null}
                    <div className="cards">
                      {group.regularEvents.map(renderEventCard)}
                    </div>
                  </section>
                ) : null}
              </article>
            ))
          )}
        </section>

        <section className="panel seo-landing" aria-label="SEO landingsinformatie">
          <h2>Waar kan ik sport kijken in Nederland?</h2>
          <p>
            Zoek je op “waar kan ik voetbal kijken”, “waar kan ik Formule 1 kijken” of “waar kan ik tennis kijken”?
            Sportkijken geeft per event een praktisch overzicht met Nederlandse starttijd, aanbieder en of kijken gratis of betaald is.
          </p>
          <p>
            Je kunt snel filteren op sporten zoals voetbal, Formule 1, tennis, golf, basketbal, honkbal en ijshockey.
            Daarnaast zie je grote events zoals Olympische Spelen, Paralympics, wereldbekers en nationale kampioenschappen gegroepeerd.
          </p>
          <p>
            Ook voor vragen als “welke zender zendt vanavond voetbal uit?”, “waar kan ik Champions League kijken?” en
            “welke livestream is gratis in Nederland?” is dit overzicht gemaakt. We combineren data uit meerdere bronnen,
            waaronder NOS, Ziggo Sport, ESPN en Viaplay.
          </p>
          <div className="seo-links">
            <a href="/?q=waar%20kan%20ik%20voetbal%20kijken">Waar kan ik voetbal kijken?</a>
            <a href="/?q=waar%20kan%20ik%20formule%201%20kijken">Waar kan ik Formule 1 kijken?</a>
            <a href="/?q=waar%20kan%20ik%20tennis%20kijken">Waar kan ik tennis kijken?</a>
            <a href="/?q=champions%20league%20kijken">Waar kan ik Champions League kijken?</a>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
