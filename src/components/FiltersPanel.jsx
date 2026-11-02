import {
  ACCESS_OPTIONS,
  MAJOR_FILTER_OPTIONS,
  PROVIDER_VISIBLE_LIMIT,
  RANGE_OPTIONS,
  SPORT_VISIBLE_LIMIT,
  TV_PROVIDER_OPTIONS
} from '../lib/filter-options.js';
import { trackAnalyticsEvent } from '../lib/analytics.js';

export default function FiltersPanel({
  isExpanded,
  preferences,
  setPreferences,
  openFilterSections,
  onToggleSection,
  totalSportCount,
  sportOptionsForView,
  sportsExpanded,
  onSportsExpandedChange,
  hiddenSportCount,
  onToggleSport,
  onSelectAllSports,
  onClearSports,
  providerOptionsForView,
  visibleProviders,
  hiddenProviderCount,
  providerListIsConstrained,
  providersExpanded,
  onProvidersExpandedChange,
  onToggleProvider,
  onSelectAllProviders,
  onClearProviders,
  tvProviderInfoOpen,
  onTvProviderInfoOpenChange,
  onRangeChange,
  onTvProviderChange,
  onAccessChange,
  onMajorChange
}) {
  return (
    <section id="filters-panel" className={`panel filters-panel ${isExpanded ? 'is-expanded-mobile' : ''}`}>
      <div className={`filter-section filter-group ${openFilterSections.sports ? 'is-open' : ''}`}>
        <div className="filter-section-header">
          <p className="filter-title" id="filter-sports-title">Sporten</p>
          <button
            type="button"
            className="filter-section-toggle"
            aria-expanded={openFilterSections.sports}
            aria-controls="filter-sports-content"
            onClick={() => onToggleSection('sports')}
          >
            <span aria-hidden="true">{openFilterSections.sports ? '-' : '+'}</span>
            <span className="sr-only">Sportfilters {openFilterSections.sports ? 'verbergen' : 'tonen'}</span>
          </button>
        </div>
        <div className="filter-section-content" id="filter-sports-content" aria-labelledby="filter-sports-title">
          <div className="sport-grid">
            {sportOptionsForView.map((sport) => {
              const selected = preferences.selectedSports.includes(sport.id);
              return (
                <button
                  key={sport.id}
                  type="button"
                  className={`chip sport-chip ${selected ? 'is-selected' : ''}`}
                  onClick={() => onToggleSport(sport.id)}
                  aria-pressed={selected}
                  style={{ '--chip-accent': sport.accent }}
                >
                  {sport.label}
                </button>
              );
            })}
          </div>
          <div className="chip-actions">
            <button type="button" className="ghost" onClick={onSelectAllSports}>Alles</button>
            <button type="button" className="ghost" onClick={onClearSports}>Geen</button>
            {hiddenSportCount > 0 ? (
              <button
                type="button"
                className="ghost compact"
                onClick={() => {
                  trackAnalyticsEvent('sport_list_expand', { hidden: hiddenSportCount });
                  onSportsExpandedChange(true);
                }}
              >
                Toon nog {hiddenSportCount} sporten
              </button>
            ) : null}
            {sportsExpanded && totalSportCount > SPORT_VISIBLE_LIMIT ? (
              <button
                type="button"
                className="ghost compact"
                onClick={() => onSportsExpandedChange(false)}
              >
                Minder sporten
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className={`filter-section filter-group ${openFilterSections.providers ? 'is-open' : ''}`}>
        <div className="filter-section-header">
          <p className="filter-title" id="filter-providers-title">Aanbieders</p>
          <button
            type="button"
            className="filter-section-toggle"
            aria-expanded={openFilterSections.providers}
            aria-controls="filter-providers-content"
            onClick={() => onToggleSection('providers')}
          >
            <span aria-hidden="true">{openFilterSections.providers ? '-' : '+'}</span>
            <span className="sr-only">Aanbieders {openFilterSections.providers ? 'verbergen' : 'tonen'}</span>
          </button>
        </div>
        <div className="filter-section-content" id="filter-providers-content" aria-labelledby="filter-providers-title">
          <div className="provider-tools">
            <input
              type="search"
              value={preferences.providerSearchText}
              onChange={(event) => {
                onProvidersExpandedChange(false);
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
                onProvidersExpandedChange(false);
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
                  onClick={() => onToggleProvider(provider)}
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
                  onProvidersExpandedChange(true);
                }}
              >
                Toon nog {hiddenProviderCount} aanbieders
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
                  onProvidersExpandedChange(false);
                }}
              >
                Minder tonen
              </button>
            </div>
          ) : null}
          <div className="chip-actions">
            <button type="button" className="ghost" onClick={onSelectAllProviders}>Alles</button>
            <button type="button" className="ghost" onClick={onClearProviders}>Geen</button>
          </div>
        </div>
      </div>

      <div className={`filter-section filter-section-more ${openFilterSections.more ? 'is-open' : ''}`}>
        <div className="filter-section-header">
          <p className="filter-title" id="filter-more-title">Meer filters</p>
          <button
            type="button"
            className="filter-section-toggle"
            aria-expanded={openFilterSections.more}
            aria-controls="filter-more-content"
            onClick={() => onToggleSection('more')}
          >
            <span aria-hidden="true">{openFilterSections.more ? '-' : '+'}</span>
            <span className="sr-only">Meer filters {openFilterSections.more ? 'verbergen' : 'tonen'}</span>
          </button>
        </div>
        <div className="filter-section-content" id="filter-more-content" aria-labelledby="filter-more-title">
          <div className="filter-row">
            <div className="filter-group inline-group">
              <p className="filter-title">Periode</p>
              <div className="chips-inline">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`chip ${preferences.rangeFilter === option.id ? 'is-selected' : ''}`}
                    onClick={() => onRangeChange(option.id)}
                    aria-pressed={preferences.rangeFilter === option.id}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group inline-group">
              <div className="filter-title-row">
                <p className="filter-title">TV-provider</p>
                <button
                  type="button"
                  className="filter-tooltip"
                  aria-label="Uitleg over TV-provider"
                  aria-expanded={tvProviderInfoOpen}
                  onClick={() => onTvProviderInfoOpenChange(!tvProviderInfoOpen)}
                >
                  ?
                </button>
              </div>
              {tvProviderInfoOpen ? (
                <p className="filter-popover">
                  Past voorwaardelijke zenders aan op jouw provider. Voorbeeld: Eurosport kan via Ziggo anders beschikbaar zijn dan via KPN.
                </p>
              ) : null}
              <div className="chips-inline">
                {TV_PROVIDER_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`chip ${preferences.tvProvider === option.id ? 'is-selected' : ''}`}
                    onClick={() => onTvProviderChange(option.id)}
                    aria-pressed={preferences.tvProvider === option.id}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="filter-help">
                Beïnvloedt voorwaardelijke zenders.
              </p>
            </div>

            <div className="filter-group inline-group">
              <p className="filter-title">Toegang</p>
              <div className="chips-inline">
                {ACCESS_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`chip ${preferences.accessFilter === option.id ? 'is-selected' : ''}`}
                    onClick={() => onAccessChange(option.id)}
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
                    onClick={() => onMajorChange(option.id)}
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
                aria-label="Zoek in sportevents"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
