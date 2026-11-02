export function trackAnalyticsEvent(eventName, params = {}) {
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
