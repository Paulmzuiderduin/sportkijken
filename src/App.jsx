import { useMemo, useState, useEffect } from 'react';
import scheduleDataset from './data/events.nl.json';

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

const CONTENT_TYPE_OPTIONS = [
  { id: 'all', label: 'Alles' },
  { id: 'match', label: 'Wedstrijden' },
  { id: 'broadcast', label: 'Uitzendingen / recap' }
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

const SOURCE_EVENTS = Array.isArray(scheduleDataset.events) ? scheduleDataset.events : [];
const CONSENT_STORAGE_KEY = 'sportkijken-consent-v1';
const CONTACT_EMAIL = 'info@paulzuiderduin.com';
const GMAIL_COMPOSE_URL = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT_EMAIL)}`;

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

const SPORT_OPTIONS = [...new Set([...Object.keys(KNOWN_SPORT_META), ...SOURCE_EVENTS.map((event) => event.sport)])]
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

const sportLookup = Object.fromEntries(SPORT_OPTIONS.map((sport) => [sport.id, sport]));

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

const PROVIDER_OPTIONS = [...new Set([
  ...PREFERRED_PROVIDERS,
  ...SOURCE_EVENTS.flatMap((event) => (Array.isArray(event.channels) ? event.channels.map((channel) => channel.name) : []))
])]
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b, 'nl-NL'));

const PROVIDER_VISIBLE_LIMIT = 24;

function sportMetaFor(id) {
  return sportLookup[id] || {
    id,
    label: formatSportLabel(id),
    accent: colorForSport(id)
  };
}

function defaultPreferences() {
  return {
    selectedSports: SPORT_OPTIONS.map((sport) => sport.id),
    selectedProviders: PROVIDER_OPTIONS,
    accessFilter: 'all',
    contentTypeFilter: 'all',
    majorFilter: 'all',
    rangeFilter: '30d',
    searchText: '',
    providerSearchText: '',
    providerSelectedOnly: false
  };
}

function sanitizeSelection(values, allowed) {
  const allowedSet = new Set(allowed);
  return values.filter((value) => allowedSet.has(value));
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

function loadPreferences() {
  const defaults = defaultPreferences();
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
      ? sanitizeSelection(parsed.selectedProviders, PROVIDER_OPTIONS)
      : defaults.selectedProviders;

    return {
      selectedSports: selectedSports.length ? selectedSports : defaults.selectedSports,
      selectedProviders,
      accessFilter: ACCESS_OPTIONS.some((option) => option.id === parsed.accessFilter)
        ? parsed.accessFilter
        : defaults.accessFilter,
      contentTypeFilter: CONTENT_TYPE_OPTIONS.some((option) => option.id === parsed.contentTypeFilter)
        ? parsed.contentTypeFilter
        : defaults.contentTypeFilter,
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

function matchesContentTypeFilter(event, contentTypeFilter) {
  if (contentTypeFilter === 'all') {
    return true;
  }
  return eventContentType(event) === contentTypeFilter;
}

function hasProvider(event, selectedProviders) {
  if (!selectedProviders.length) {
    return false;
  }
  return event.channels.some((channel) => selectedProviders.includes(channel.name));
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

function confidenceMeta(event) {
  const confidence = event.verification?.confidence || 'unverified';
  if (confidence === 'confirmed') {
    return { label: 'Bevestigd', className: 'confirmed' };
  }
  if (confidence === 'likely') {
    return { label: 'Waarschijnlijk', className: 'likely' };
  }
  return { label: 'Onbevestigd', className: 'unverified' };
}

function contentTypeMeta(event) {
  if (eventContentType(event) === 'broadcast') {
    if (event.contentSubType === 'recap') {
      return { label: 'Recap', className: 'recap' };
    }
    return { label: 'Uitzending', className: 'broadcast' };
  }
  return { label: 'Wedstrijd', className: 'match' };
}

const MAJOR_GROUP_ORDER = [
  'Paralympische Spelen',
  'Olympische Spelen',
  'Wereldbekers en WK',
  'Nationale Kampioenschappen'
];

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
    haystack.includes('nationaal kampioenschap')
    || haystack.includes('national championship')
    || haystack.includes('nederlands kampioenschap')
    || haystack.includes(' nk')
    || haystack.startsWith('nk ')
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
  const [preferences, setPreferences] = useState(loadPreferences);
  const [providersExpanded, setProvidersExpanded] = useState(false);
  const [consentState, setConsentState] = useState(loadConsentState);
  const [emailCopied, setEmailCopied] = useState(false);

  const events = useMemo(() => {
    return [...SOURCE_EVENTS]
      .map((event) => ({
        ...event,
        startDate: new Date(event.start),
        endDate: new Date(new Date(event.start).getTime() + event.durationMinutes * 60000)
      }))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      // Storage might be blocked; the app still functions without persistence.
    }
  }, [preferences]);

  useEffect(() => {
    trackAnalyticsEvent('sportkijken_view', { page: 'home' });
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

  const datasetStatus = useMemo(() => {
    const generatedAt = new Date(scheduleDataset.generatedAt || 0);
    const generatedMs = generatedAt.getTime();
    if (!Number.isFinite(generatedMs) || generatedMs <= 0) {
      return {
        level: 'warning',
        message: 'Kon geen geldige update-tijd bepalen.'
      };
    }

    const ageMinutes = Math.max(0, Math.round((Date.now() - generatedMs) / 60000));
    if (ageMinutes > 180) {
      return {
        level: 'warning',
        message: `Data is ${Math.round(ageMinutes / 60)} uur oud. Controleer zenderinformatie extra goed.`
      };
    }
    if (ageMinutes > 90) {
      return {
        level: 'notice',
        message: `Data is ${ageMinutes} minuten oud. Nieuwe wijzigingen kunnen nog binnenkomen.`
      };
    }

    return {
      level: 'ok',
      message: `Data is ${ageMinutes} minuten oud.`
    };
  }, []);

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

      if (!matchesContentTypeFilter(event, preferences.contentTypeFilter)) {
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
    const filtered = PROVIDER_OPTIONS.filter((provider) => !query || provider.toLowerCase().includes(query));
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
  }, [preferences.providerSearchText, preferences.providerSelectedOnly, preferences.selectedProviders]);

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
      selectedSports: SPORT_OPTIONS.map((sport) => sport.id)
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
      selectedProviders: PROVIDER_OPTIONS
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

  const setContentTypeFilter = (contentTypeId) => {
    trackAnalyticsEvent('filter_content_type_change', { content_type: contentTypeId });
    setPreferences((current) => ({ ...current, contentTypeFilter: contentTypeId }));
  };

  const setMajorFilter = (majorId) => {
    trackAnalyticsEvent('filter_major_change', { major: majorId });
    setPreferences((current) => ({ ...current, majorFilter: majorId }));
  };

  const setConsent = (nextState) => {
    if (typeof window === 'undefined') {
      return;
    }
    if (typeof window.setSportkijkenConsent === 'function') {
      window.setSportkijkenConsent(nextState);
      return;
    }

    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, nextState);
    } catch (error) {
      // Ignore localStorage issues.
    }
    setConsentState(nextState);
  };

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
      lines.push(`SUMMARY:${escapeIcsValue(`${sportMetaFor(event.sport).label}: ${event.title}`)}`);
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
    const sportMeta = sportMetaFor(event.sport);
    const confidence = confidenceMeta(event);
    const contentMeta = contentTypeMeta(event);

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

        <p className={`verification-badge ${confidence.className}`}>
          {confidence.label}
        </p>
        <p className={`content-type-badge ${contentMeta.className}`}>
          {contentMeta.label}
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
        </footer>

        {event.notes ? <p className="event-note">{event.notes}</p> : null}
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
              <button type="button" className="primary" onClick={exportVisibleEventsAsIcs}>
                Exporteer selectie als .ics
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
              <p className="beta-note">Met live-updates per uur en aanbiederfilters, inclusief NOS-livestreams.</p>
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
                  {sportMetaFor(counters.nextEvent.sport).label} • {TIME_FORMATTER.format(counters.nextEvent.startDate)}
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
              <button type="button" className="primary" onClick={() => setConsent('granted')}>
                Toestaan
              </button>
              <button type="button" className="ghost" onClick={() => setConsent('denied')}>
                Niet toestaan
              </button>
            </div>
          </section>
        ) : null}

        <section className="panel filters-panel">
          <div className="filter-group">
            <p className="filter-title">Sporten</p>
            <div className="sport-grid">
              {SPORT_OPTIONS.map((sport) => {
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
              <p className="filter-title">Type</p>
              <div className="chips-inline">
                {CONTENT_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`chip ${preferences.contentTypeFilter === option.id ? 'is-selected' : ''}`}
                    onClick={() => setContentTypeFilter(option.id)}
                    aria-pressed={preferences.contentTypeFilter === option.id}
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
          <p>
            {scheduleDataset.isDemo
              ? 'MVP-notitie: deze versie gebruikt een handmatige dataset. Rechten en tijden kunnen wijzigen.'
              : 'Dataset wordt automatisch bijgewerkt (ongeveer elk uur) vanuit meerdere bronnen, inclusief NOS, Ziggo, ESPN en Viaplay.'}
          </p>
          <p>Laatst bijgewerkt: {new Date(scheduleDataset.generatedAt).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}</p>
          <p className={`dataset-status ${datasetStatus.level}`}>{datasetStatus.message}</p>
          <div className="notice-actions">
            <span>Privacy:</span>
            <button type="button" className="ghost compact" onClick={() => setConsent('granted')}>
              Analytics aan
            </button>
            <button type="button" className="ghost compact" onClick={() => setConsent('denied')}>
              Analytics uit
            </button>
          </div>
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

        <section className="agenda">
          {groupedEvents.length === 0 ? (
            <article className="panel empty-state">
              <h2>Geen events met deze filters</h2>
              <p>Pas je sport-, aanbieder-, periode-, toegang-, type- of grote-events-filter aan om resultaten te zien.</p>
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
      </main>
    </div>
  );
}

export default App;
