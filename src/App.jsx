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
    rangeFilter: '30d',
    searchText: ''
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
      rangeFilter: RANGE_OPTIONS.some((option) => option.id === parsed.rangeFilter)
        ? parsed.rangeFilter
        : defaults.rangeFilter,
      searchText: typeof parsed.searchText === 'string' ? parsed.searchText : defaults.searchText
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

function App() {
  const [preferences, setPreferences] = useState(loadPreferences);

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

    return [...map.values()];
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
        event.notes || 'Controleer het uitzendschema op de wedstrijddag.'
      ];

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
            <div className="provider-grid">
              {PROVIDER_OPTIONS.map((provider) => {
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

            <div className="filter-group search-group">
              <label className="filter-title" htmlFor="search">Zoeken</label>
              <input
                id="search"
                type="search"
                value={preferences.searchText}
                onChange={(event) => setPreferences((current) => ({ ...current, searchText: event.target.value }))}
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
        </section>

        <section className="agenda">
          {groupedEvents.length === 0 ? (
            <article className="panel empty-state">
              <h2>Geen events met deze filters</h2>
              <p>Pas je sport-, aanbieder-, periode- of toegangskeuze aan om resultaten te zien.</p>
            </article>
          ) : (
            groupedEvents.map((group) => (
              <article key={group.key} className="day-block">
                <header>
                  <p className="day-number">{group.dayNumber}</p>
                  <h2>{group.label}</h2>
                </header>

                <div className="cards">
                  {group.events.map((event) => {
                    const sportMeta = sportMetaFor(event.sport);
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
                          <span>{event.location || 'Nederland'}</span>
                        </footer>

                        {event.notes ? <p className="event-note">{event.notes}</p> : null}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
