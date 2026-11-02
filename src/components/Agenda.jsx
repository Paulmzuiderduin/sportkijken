import { QUICK_DAY_OPTIONS } from '../lib/filter-options.js';

export default function Agenda({
  groups,
  visibleDaysCount,
  onLoadMore,
  dayJumpOptions,
  jumpDay,
  onJumpDay,
  quickDayFilter,
  onQuickDay,
  filteredCount,
  onExport,
  hasSourceEvents,
  renderEventCard
}) {
  return (
    <section className="agenda" id="agenda">
      <div className="agenda-tools">
        <div className="quick-days" role="group" aria-label="Snelle dagkeuze">
          {QUICK_DAY_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`chip compact ${quickDayFilter === option.id ? 'is-selected' : ''}`}
              onClick={() => onQuickDay(option.id)}
              aria-pressed={quickDayFilter === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
        {dayJumpOptions.length ? (
          <div className="agenda-date-jump">
            <label className="agenda-label" htmlFor="jump-day">Spring naar datum</label>
            <select
              id="jump-day"
              value={jumpDay}
              onChange={(event) => onJumpDay(event.target.value)}
            >
              <option value="">Kies een dag</option>
              {dayJumpOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>
        ) : null}
        <button
          type="button"
          className="ghost compact agenda-export"
          onClick={onExport}
          disabled={!filteredCount}
        >
          Export .ics ({filteredCount})
        </button>
      </div>

      {groups.length === 0 ? (
        <article className="panel empty-state">
          <h2>{hasSourceEvents ? 'Geen events met deze filters' : 'Sportgegevens worden geladen...'}</h2>
          <p>
            {hasSourceEvents
              ? 'Pas je sport-, aanbieder-, periode-, toegang- of grote-events-filter aan om resultaten te zien.'
              : 'De nieuwste sportgegevens worden opgehaald. Vernieuw de pagina als dit blijft staan.'}
          </p>
        </article>
      ) : (
        <>
          {groups.slice(0, visibleDaysCount).map((group) => (
            <article key={group.key} id={`day-${group.key}`} className="day-block">
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
          ))}

          {groups.length > visibleDaysCount ? (
            <button
              type="button"
              onClick={onLoadMore}
              className="ghost load-more"
            >
              Laad meer dagen ({groups.length - visibleDaysCount} resterend)
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
