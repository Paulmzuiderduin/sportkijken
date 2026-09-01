import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProviderHealthReport,
  dedupeEvents,
  extractEspnScheduleRows,
  inferZiggoScheduleSport,
  normalizedTitleKey,
  parseEspnFittData,
  quarantineReasonForEvent,
  runQualityGates
} from './update-events.mjs';

test('Ziggo sportName is authoritative for schedule-only sport classification', () => {
  assert.equal(inferZiggoScheduleSport({
    title: 'Torino - Monza',
    description: 'Verslag van de wedstrijd in de Coppa Italia.',
    sportName: 'voetbal',
    channelName: 'Ziggo Sport 3'
  }), 'voetbal');
});

test('editorial and malformed guide rows are quarantined without broad match removal', () => {
  assert.equal(quarantineReasonForEvent({ title: 'NOS Sportjournaal', contentType: 'broadcast' }), 'blocklisted_title');
  assert.equal(quarantineReasonForEvent({ title: 'All Blacks In Their Own Words: De finale', contentType: 'match' }), 'blocklisted_title');
  assert.equal(quarantineReasonForEvent({ title: 'Wimbledon Classic 2010 Isner Vs Mahut', contentType: 'match' }), 'blocklisted_title');
  assert.equal(quarantineReasonForEvent({ title: 'Borussia Dortmund -', contentType: 'match' }), 'malformed_match_title');
  assert.equal(quarantineReasonForEvent({ title: 'Torino - Monza', contentType: 'match' }), null);
});

test('dedupeEvents merges ESPN schedule variants introduced by fallbacks', () => {
  const base = {
    sport: 'volleybal',
    competition: 'NCAA',
    start: '2026-05-01T17:00:00.000Z',
    durationMinutes: 120,
    channels: [{ name: 'ESPN Watch', platform: 'stream', access: 'paid' }],
    sourceType: 'espn-schedule'
  };
  const result = dedupeEvents([
    { ...base, id: 'dual', title: 'Long Beach State vs. California (Dual #4)' },
    { ...base, id: 'pair', title: 'Long Beach State vs. California (Pair #5, Dual #4)' }
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Long Beach State vs. California (Pair #5, Dual #4)');
});

test('normalizedTitleKey collapses ESPN pair and dual variants', () => {
  const a = normalizedTitleKey('Long Beach State vs. California (Dual #4)');
  const b = normalizedTitleKey('Long Beach State vs. California (Pair #5, Dual #4)');
  assert.equal(a, b);
});

test('parseEspnFittData supports alternative assignment variants', () => {
  const rawHtml = `
    <html><body>
    <script>window["__espnfitt__"]={"page":{"content":{"watch":{"arngs":[]}}}};</script>
    </body></html>
  `;
  const payload = parseEspnFittData(rawHtml);
  assert.equal(payload?.page?.content?.watch?.arngs?.length, 0);
});

test('extractEspnScheduleRows can find nested arngs outside the primary path', () => {
  const upcomingStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const payload = {
    someWrapper: {
      nested: {
        arngs: [
          {
            nme: 'Test Match',
            stme: upcomingStart,
            etme: new Date(new Date(upcomingStart).getTime() + 2 * 60 * 60 * 1000).toISOString(),
            bcsts: [{ nme: 'ESPN' }]
          }
        ]
      }
    }
  };

  const rows = extractEspnScheduleRows(payload, 'https://example.com');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Test Match');
});

test('buildProviderHealthReport preserves additive degraded states', () => {
  const report = buildProviderHealthReport(
    {
      'espn-schedule': {
        rows: 0,
        errors: ['ESPN schedule 20260520: no usable rows'],
        diagnostics: [{ kind: 'parser_mismatch', detail: 'payload drift' }],
        status: 'empty'
      }
    },
    {
      providers: {
        'espn-schedule': {
          lastOkAt: '2026-05-10T10:00:00.000Z',
          lastNonEmptyAt: '2026-05-10T10:00:00.000Z'
        }
      }
    },
    '2026-05-15T10:00:00.000Z'
  );

  assert.equal(report.providers['espn-schedule'].status, 'empty');
  assert.equal(report.providers['espn-schedule'].lastOkAt, '2026-05-10T10:00:00.000Z');
  assert.equal(report.providers['espn-schedule'].lastNonEmptyAt, '2026-05-10T10:00:00.000Z');
  assert.equal(report.providers['espn-schedule'].diagnosticCount, 1);
});

test('runQualityGates warns for one degraded provider but does not fail', () => {
  const result = runQualityGates({
    events: [
      {
        id: 'evt-1',
        sport: 'voetbal',
        competition: 'Eredivisie',
        title: 'Ajax - PSV',
        start: '2026-05-15T18:00:00.000Z',
        channels: [{ name: 'ESPN' }],
        sourceType: 'espn'
      },
      {
        id: 'evt-2',
        sport: 'tennis',
        competition: 'ATP',
        title: 'Rome Masters',
        start: '2026-05-15T16:00:00.000Z',
        channels: [{ name: 'HBO Max' }],
        sourceType: 'hbo-max'
      },
      {
        id: 'evt-3',
        sport: 'basketbal',
        competition: 'NBA',
        title: 'Celtics - Knicks',
        start: '2026-05-15T23:00:00.000Z',
        channels: [{ name: 'ESPN Watch' }],
        sourceType: 'espn'
      },
      ...Array.from({ length: 447 }, (_, index) => ({
        id: `evt-extra-${index}`,
        sport: 'voetbal',
        competition: 'Eredivisie',
        title: `Match ${index}`,
        start: `2026-05-16T${String(index % 10).padStart(2, '0')}:00:00.000Z`,
        channels: [{ name: 'ESPN' }],
        sourceType: 'espn'
      }))
    ],
    previousEvents: [],
    providerHealth: {
      nos: { rows: 2, errors: [], status: 'ok' },
      ziggo: { rows: 20, errors: [], status: 'ok' },
      'espn-schedule': { rows: 0, errors: ['HTTP 503'], status: 'down' },
      viaplay: { rows: 10, errors: [], status: 'ok' },
      'npo-guide': { rows: 10, errors: [], status: 'ok' }
    },
    quarantinedEvents: [],
    fetchErrors: ['ESPN schedule 20260520: HTTP 503']
  });

  assert.equal(result.errors.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes('espn-schedule')));
});

test('runQualityGates treats an empty provider state as degradation during drop checks', () => {
  const currentEvents = Array.from({ length: 450 }, (_, index) => ({
    id: `current-${index}`,
    sport: 'voetbal',
    competition: 'Competitie',
    title: `Wedstrijd ${index}`,
    start: new Date(Date.now() + index * 60_000).toISOString(),
    channels: [{ name: 'Ziggo Sport' }],
    sourceType: 'ziggo'
  }));
  const previousEvents = Array.from({ length: 20 }, (_, index) => ({
    id: `npo-${index}`,
    sport: 'voetbal',
    competition: 'NPO',
    title: `NPO wedstrijd ${index}`,
    start: new Date(Date.now() + index * 60_000).toISOString(),
    channels: [{ name: 'NPO 1' }],
    sourceType: 'npo-guide'
  }));

  const result = runQualityGates({
    events: currentEvents,
    previousEvents,
    providerHealth: {
      nos: { rows: 1, errors: [], status: 'ok' },
      ziggo: { rows: 100, errors: [], status: 'ok' },
      'espn-schedule': { rows: 100, errors: [], status: 'ok' },
      viaplay: { rows: 10, errors: [], status: 'ok' },
      'npo-guide': { rows: 0, errors: [], status: 'empty' }
    },
    quarantinedEvents: [],
    fetchErrors: []
  });

  assert.equal(result.errors.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes('bronstatus empty')));
});
