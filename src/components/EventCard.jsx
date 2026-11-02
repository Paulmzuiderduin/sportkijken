import { TIME_FORMATTER } from '../lib/format.js';
import {
  accessLabelText,
  compactChannelCondition,
  effectiveChannelAccess,
  getEventAccessLabel,
  getEventAccessTone
} from '../lib/access.js';
import { trackAnalyticsEvent } from '../lib/analytics.js';

export default function EventCard({ event, sportMeta, reportLink, tvProvider }) {
  const eventAccessLabel = getEventAccessLabel(event, tvProvider);
  const eventAccessTone = getEventAccessTone(event, tvProvider);

  return (
    <div className="event-card">
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
        {event.channels.map((channel) => {
          const channelAccess = effectiveChannelAccess(channel, tvProvider);
          const showCondition = channel.conditions && channelAccess !== 'paid';
          return (
            <li key={`${event.id}-${channel.name}-${channel.platform}`}>
              <div className="channel-main">
                {channel.url ? (
                  <a
                    className="channel-link"
                    href={channel.url}
                    target="_blank"
                    rel="noreferrer"
                    title={channel.conditions || undefined}
                    onClick={() => {
                      trackAnalyticsEvent('outbound_stream_click', {
                        provider: channel.name,
                        access: channelAccess,
                        sport: event.sport
                      });
                    }}
                  >
                    {channel.name} ({channel.platform})
                  </a>
                ) : (
                  <span title={channel.conditions || undefined}>
                    {channel.name} ({channel.platform})
                  </span>
                )}
                {showCondition ? (
                  <small className="channel-condition" title={channel.conditions}>
                    {compactChannelCondition(channel.conditions)}
                  </small>
                ) : null}
              </div>
              <span className={`access ${channelAccess}`}>
                {accessLabelText(channelAccess)}
              </span>
            </li>
          );
        })}
      </ul>

      <footer>
        <span className={`event-access ${eventAccessTone}`}>
          {eventAccessLabel}
        </span>
        <a
          className="report-link"
          href={reportLink}
          onClick={() => {
            trackAnalyticsEvent('report_incorrect_listing_click', {
              sport: event.sport,
              event_id: event.id,
              competition: event.competition || 'unknown'
            });
          }}
        >
          Meld onjuiste vermelding
        </a>
      </footer>
    </div>
  );
}
