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

  if (channel.conditions && typeof channel.conditions !== 'string') {
    throw new Error(`Invalid channel conditions for event ${eventId}: ${channel.conditions}`);
  }
}

export function normalizeEvent(event) {
  if (!event.id || !event.start || !event.sport || !Array.isArray(event.channels) || !event.channels.length) {
    throw new Error(`Event missing required fields: ${JSON.stringify(event)}`);
  }

  if (event.sourceType && typeof event.sourceType !== 'string') {
    throw new Error(`Invalid sourceType for event ${event.id}: ${event.sourceType}`);
  }

  if (event.sourceRefs && !Array.isArray(event.sourceRefs)) {
    throw new Error(`Invalid sourceRefs for event ${event.id}`);
  }

  if (event.contentType && !['match', 'broadcast'].includes(event.contentType)) {
    throw new Error(`Invalid contentType for event ${event.id}: ${event.contentType}`);
  }

  if (event.contentSubType && !['general', 'recap'].includes(event.contentSubType)) {
    throw new Error(`Invalid contentSubType for event ${event.id}: ${event.contentSubType}`);
  }

  if (event.sourceRefs) {
    event.sourceRefs.forEach((ref) => {
      if (!ref || typeof ref !== 'object') {
        throw new Error(`Invalid sourceRef for event ${event.id}`);
      }
      if (!ref.url || typeof ref.url !== 'string') {
        throw new Error(`Invalid sourceRef url for event ${event.id}`);
      }
    });
  }

  if (event.verification) {
    const { confidence, reason, lastVerified, priority } = event.verification;
    if (!['confirmed', 'likely', 'unverified'].includes(confidence)) {
      throw new Error(`Invalid verification confidence for event ${event.id}: ${confidence}`);
    }
    if (typeof reason !== 'string') {
      throw new Error(`Invalid verification reason for event ${event.id}`);
    }
    if (typeof lastVerified !== 'string' || Number.isNaN(new Date(lastVerified).getTime())) {
      throw new Error(`Invalid verification timestamp for event ${event.id}`);
    }
    if (typeof priority !== 'number') {
      throw new Error(`Invalid verification priority for event ${event.id}`);
    }
  }

  event.channels.forEach((channel) => assertValidChannel(channel, event.id));

  return {
    ...event,
    sport: String(event.sport).toLowerCase(),
    ...(event.sourceType ? { sourceType: event.sourceType.trim() } : {}),
    ...(event.contentType ? { contentType: event.contentType } : {}),
    ...(event.contentSubType ? { contentSubType: event.contentSubType } : {}),
    ...(event.sourceRefs
      ? {
          sourceRefs: event.sourceRefs
            .filter((ref) => ref && typeof ref.url === 'string')
            .map((ref) => ({
              ...(ref.label ? { label: String(ref.label).trim() } : {}),
              ...(ref.type ? { type: String(ref.type).trim() } : {}),
              url: ref.url.trim()
            }))
        }
      : {}),
    ...(event.verification
      ? {
          verification: {
            confidence: event.verification.confidence,
            reason: event.verification.reason.trim(),
            lastVerified: event.verification.lastVerified,
            priority: event.verification.priority
          }
        }
      : {}),
    channels: event.channels.map((channel) => ({
      name: channel.name.trim(),
      platform: channel.platform,
      access: channel.access,
      ...(channel.url ? { url: channel.url.trim() } : {}),
      ...(channel.conditions ? { conditions: channel.conditions.trim() } : {})
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
