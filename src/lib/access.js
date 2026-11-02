export function accessLabelText(access) {
  if (access === 'free') {
    return 'Gratis';
  }
  if (access === 'mixed') {
    return 'Voorwaardelijk';
  }
  return 'Betaald';
}

export function effectiveChannelAccess(channel, tvProvider = 'all') {
  const providerKey = typeof tvProvider === 'string' ? tvProvider : 'all';
  const byProvider = channel?.tvProviderAccess;
  if (
    providerKey !== 'all'
    && byProvider
    && typeof byProvider === 'object'
    && typeof byProvider[providerKey] === 'string'
  ) {
    return byProvider[providerKey];
  }
  return channel?.access || 'paid';
}

export function hasAccess(event, accessFilter, tvProvider = 'all') {
  if (accessFilter === 'all') {
    return true;
  }
  return event.channels.some((channel) => {
    const access = effectiveChannelAccess(channel, tvProvider);
    if (access === accessFilter) {
      return true;
    }
    return access === 'mixed' && (accessFilter === 'free' || accessFilter === 'paid');
  });
}

export function getEventAccessLabel(event, tvProvider = 'all') {
  const hasFree = event.channels.some((channel) => effectiveChannelAccess(channel, tvProvider) === 'free');
  const hasPaid = event.channels.some((channel) => effectiveChannelAccess(channel, tvProvider) === 'paid');
  const hasMixed = event.channels.some((channel) => effectiveChannelAccess(channel, tvProvider) === 'mixed');

  if (hasMixed) {
    if (hasFree && hasPaid) {
      return 'Gratis + betaald';
    }
    if (hasPaid) {
      return 'Voorwaardelijk + betaald';
    }
    if (hasFree) {
      return 'Gratis + voorwaardelijk';
    }
    return 'Voorwaardelijk';
  }
  if (hasFree && hasPaid) {
    return 'Gratis + betaald';
  }
  if (hasFree) {
    return 'Gratis';
  }
  return 'Betaald';
}

export function getEventAccessTone(event, tvProvider = 'all') {
  const label = getEventAccessLabel(event, tvProvider);
  return label === 'Gratis' ? 'free' : label === 'Betaald' ? 'paid' : 'mixed';
}

export function compactChannelCondition(condition) {
  const value = String(condition || '').trim();
  const replacements = [
    ['Gratis voor Ziggo-klanten met geschikt tv-pakket.', 'Ziggo-abonnement met geschikt pakket.'],
    ['Kanaal vereist aanvullend Ziggo Sport-pakket of inloggen via Ziggo GO.', 'Aanvullend Ziggo Sport-pakket of Ziggo GO.'],
    ['Kanaal vereist aanvullend Ziggo Sport-pakket of inloggen via Ziggo GO', 'Aanvullend Ziggo Sport-pakket of Ziggo GO.'],
    ['Streaming via ESPN Watch met geschikt abonnement.', 'ESPN Watch-abonnement.'],
    ['Alleen met ESPN Compleet of geschikt tv-pakket.', 'ESPN Compleet of geschikt tv-pakket.'],
    ['Gratis voor KPN-klanten met geschikt tv-pakket.', 'KPN-abonnement met geschikt pakket.']
  ];
  return replacements.reduce((valueSoFar, [search, replacement]) => (
    valueSoFar.includes(search) ? valueSoFar.replace(search, replacement) : valueSoFar
  ), value);
}
