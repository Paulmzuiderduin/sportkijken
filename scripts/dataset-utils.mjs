export function assertValidChannel(channel, eventId) {
  if (!channel.name || typeof channel.name !== 'string') {
    throw new Error(`Channel name missing for event ${eventId}`);
  }

  if (!['tv', 'stream'].includes(channel.platform)) {
    throw new Error(`Invalid channel platform for event ${eventId}: ${channel.platform}`);
  }

  if (!['free', 'paid'].includes(channel.access)) {
    throw new Error(`Invalid channel access for event ${eventId}: ${channel.access}`);
  }

  if (channel.url && typeof channel.url !== 'string') {
    throw new Error(`Invalid channel url for event ${eventId}: ${channel.url}`);
  }
}

export function normalizeEvent(event) {
  if (!event.id || !event.start || !event.sport || !Array.isArray(event.channels) || !event.channels.length) {
    throw new Error(`Event missing required fields: ${JSON.stringify(event)}`);
  }

  event.channels.forEach((channel) => assertValidChannel(channel, event.id));

  return {
    ...event,
    sport: String(event.sport).toLowerCase(),
    channels: event.channels.map((channel) => ({
      name: channel.name.trim(),
      platform: channel.platform,
      access: channel.access,
      ...(channel.url ? { url: channel.url.trim() } : {})
    }))
  };
}

export function normalizeDataset(dataset) {
  if (!Array.isArray(dataset.events)) {
    throw new Error('Dataset must contain an events array');
  }

  return {
    ...dataset,
    events: dataset.events
      .map(normalizeEvent)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  };
}
