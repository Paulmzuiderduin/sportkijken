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

function loadPreferences() {
  const defaults = defaultPreferences();

  if (typeof window === 'undefined') {
    return defaults;
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return defaults;
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
      majorFilter: MAJOR_FILTER_OPTIONS.some((option) => option.id === parsed.majorFilter)
        ? parsed.majorFilter
        : defaults.majorFilter,
      rangeFilter: RANGE_OPTIONS.some((option) => option.id === parsed.rangeFilter)
        ? parsed.rangeFilter
        : defaults.rangeFilter,
      searchText: typeof parsed.searchText === 'string' ? parsed.searchText : defaults.searchText,
      providerSearchText:
        typeof parsed.providerSearchText === 'string' ? parsed.providerSearchText : defaults.providerSearchText,
      providerSelectedOnly:
        typeof parsed.providerSelectedOnly === 'boolean' ? parsed.providerSelectedOnly : defaults.providerSelectedOnly
    };
  } catch (error) {
    return defaults;
  }
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

function hasAccess(event, accessFilter) {
  if (accessFilter === 'all') {
    return true;
  }
  return event.channels.some((channel) => channel.access === accessFilter);
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

  const filteredEvents = useMemo(() => {
    const now = new Date();
    const threshold = new Date(now.getTime() - 3 * 60 * 60 * 1000);

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

      if (event.startDate < threshold) {
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
      const selected = current.selectedSports.includes(sportId)
        ? current.selectedSports.filter((id) => id !== sportId)
        : [...current.selectedSports, sportId];

      return {
        ...current,
        selectedSports: selected
      };
    });
  };

  const toggleProvider = (provider) => {
    setPreferences((current) => {
      const selected = current.selectedProviders.includes(provider)
        ? current.selectedProviders.filter((item) => item !== provider)
        : [...current.selectedProviders, provider];

      return {
        ...current,
        selectedProviders: selected
      };
    });
  };

  const selectAllSports = () => {
    setPreferences((current) => ({
      ...current,
      selectedSports: SPORT_OPTIONS.map((sport) => sport.id)
    }));
  };

  const clearSports = () => {
    setPreferences((current) => ({
      ...current,
      selectedSports: []
    }));
  };

  const selectAllProviders = () => {
    setPreferences((current) => ({
      ...current,
      selectedProviders: PROVIDER_OPTIONS
    }));
  };

  const clearProviders = () => {
    setPreferences((current) => ({
      ...current,
      selectedProviders: []
    }));
  };

  const exportVisibleEventsAsIcs = () => {
    if (!filteredEvents.length) {
      return;
    }

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

        <ul className="channel-list">
          {event.channels.map((channel) => (
            <li key={`${event.id}-${channel.name}-${channel.platform}`}>
              <div className="channel-main">
                {channel.url ? (
                  <a className="channel-link" href={channel.url} target="_blank" rel="noreferrer">
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
      <main className="shell">
        <section className="hero">
          <div>
            <p className="kicker">Sportkijken Nederland</p>
            <h1>Sport kijken in Nederland: wanneer en waar.</h1>
            <p className="intro">
              Kies sporten en aanbieders en krijg een compact overzicht met starttijd, zender/stream en gratis of betaald.
            </p>
            <div className="hero-actions">
              <button type="button" className="primary" onClick={exportVisibleEventsAsIcs}>
                Exporteer selectie als .ics
              </button>
              <p className="beta-note">Updates elk uur vanuit o.a. NOS, Ziggo, ESPN en Viaplay.</p>
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
                placeholder="Zoek aanbieder"
                aria-label="Zoek aanbieder"
              />
              <button
                type="button"
                className={`ghost compact ${preferences.providerSelectedOnly ? 'is-active' : ''}`}
                onClick={() => {
                  setProvidersExpanded(false);
                  setPreferences((current) => ({
                    ...current,
                    providerSelectedOnly: !current.providerSelectedOnly
                  }));
                }}
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
                  >
                    {provider}
                  </button>
                );
              })}
            </div>
            {!visibleProviders.length ? <p className="provider-empty">Geen aanbieders gevonden.</p> : null}
            {hiddenProviderCount > 0 ? (
              <div className="chip-actions">
                <button type="button" className="ghost compact" onClick={() => setProvidersExpanded(true)}>
                  Toon nog {hiddenProviderCount}
                </button>
              </div>
            ) : null}
            {!providerListIsConstrained && providersExpanded && providerOptionsForView.length > PROVIDER_VISIBLE_LIMIT ? (
              <div className="chip-actions">
                <button type="button" className="ghost compact" onClick={() => setProvidersExpanded(false)}>
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
                    onClick={() => setPreferences((current) => ({ ...current, rangeFilter: option.id }))}
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
                    onClick={() => setPreferences((current) => ({ ...current, accessFilter: option.id }))}
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
                    onClick={() => setPreferences((current) => ({ ...current, majorFilter: option.id }))}
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
                placeholder="team, toernooi of aanbieder"
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
          <p>Laatst geverifieerd (algemeen): {new Date(scheduleDataset.generatedAt).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}</p>
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
      </main>
    </div>
  );
}

export default App;
