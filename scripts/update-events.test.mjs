import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProviderHealthReport,
  extractEspnScheduleRows,
  normalizedTitleKey,
  parseEspnFittData,
  runQualityGates
} from './update-events.mjs';

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
  const payload = {
    someWrapper: {
      nested: {
        arngs: [
          {
            nme: 'Test Match',
            stme: '2026-05-20T19:00:00.000Z',
            etme: '2026-05-20T21:00:00.000Z',
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
