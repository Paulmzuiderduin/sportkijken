export const DATE_FORMATTER = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  timeZone: 'Europe/Amsterdam'
});

export const TIME_FORMATTER = new Intl.DateTimeFormat('nl-NL', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Amsterdam'
});

export const DAY_KEY_FORMATTER = new Intl.DateTimeFormat('sv-SE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Amsterdam'
});

export const DAY_NUMBER_FORMATTER = new Intl.DateTimeFormat('nl-NL', {
  day: '2-digit',
  month: 'short',
  timeZone: 'Europe/Amsterdam'
});

export const WEEKDAY_SHORT_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: 'Europe/Amsterdam'
});
