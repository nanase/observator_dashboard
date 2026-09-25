import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SeriesResponse } from '../src/shared/api';
import { chooseResolution } from '../src/worker/series';
import { DAY, HOUR } from '../src/worker/time';
import { asUser, nowSec, resetDatabase } from './helpers';

const NOW = 1_800_000_000;

describe('chooseResolution', () => {
  it.each([
    ['直近 1 日', NOW - DAY, NOW, '1m'],
    ['直近 3 日', NOW - 3 * DAY, NOW, '1m'],
    ['直近 10 日', NOW - 10 * DAY, NOW, '10m'],
    ['直近 1 年', NOW - 365 * DAY, NOW, '1d'],
    ['400 日前の 1 日', NOW - 400 * DAY, NOW - 399 * DAY, '10m'],
    ['4 年前の 1 日', NOW - 4 * 365 * DAY, NOW - 4 * 365 * DAY + DAY, '1d'],
  ] as const)('%s は %s 粒度', (_, from, to, expected) => {
    expect(chooseResolution(from, to, NOW)).toBe(expected);
  });
});

describe('GET /api/series', () => {
  let deviceIds: number[];

  beforeEach(async () => {
    await resetDatabase();
    deviceIds = [];
    for (const address of ['11:22:33:44:55:01', '11:22:33:44:55:02']) {
      const id = await env.DB.prepare(
        `INSERT INTO devices (address, kind, status, first_seen_at, updated_at) VALUES (?, 'W3400010', 'active', 0, 0)
         RETURNING id`,
      )
        .bind(address)
        .first<number>('id');
      deviceIds.push(id!);
    }
  });

  async function get(params: Record<string, string | number>): Promise<Response> {
    return asUser(`/api/series?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`);
  }

  it('1 分粒度では平均だけを列で返す', async () => {
    const base = nowSec() - HOUR;
    const [a, b] = deviceIds;
    await env.DB.prepare(
      'INSERT INTO readings_1m (device_id, ts, temperature, humidity) VALUES (?1, ?3, 20, 50), (?1, ?3 + 60, 21, 51), (?2, ?3, 25, 40)',
    )
      .bind(a, b, base)
      .run();

    const response = await get({ devices: `${a},${b}`, from: base, to: base + 600, metrics: 'temperature' });
    const body = (await response.json()) as SeriesResponse;

    expect(body).toMatchObject({ resolution: '1m', step: 60 });
    expect(body.series).toEqual([
      { deviceId: a, ts: [base, base + 60], values: { temperature: { avg: [20, 21] } } },
      { deviceId: b, ts: [base], values: { temperature: { avg: [25] } } },
    ]);
  });

  it('集計済みの粒度では平均・最小・最大を返す', async () => {
    const [a] = deviceIds;
    await env.DB.prepare(
      'INSERT INTO readings_10m (device_id, ts, n, co2_avg, co2_min, co2_max) VALUES (?, ?, 10, 800, 700, 900)',
    )
      .bind(a, NOW)
      .run();

    const response = await get({ devices: a, from: NOW, to: NOW + 600, metrics: 'co2', resolution: '10m' });
    const body = (await response.json()) as SeriesResponse;

    expect(body.series[0].values).toEqual({ co2: { avg: [800], min: [700], max: [900] } });
  });

  it('metrics を省くと全指標を返す', async () => {
    const response = await get({ devices: deviceIds[0], from: NOW, to: NOW + 60 });
    const body = (await response.json()) as SeriesResponse;
    expect(Object.keys(body.series[0].values)).toEqual([
      'temperature',
      'humidity',
      'pressure',
      'co2',
      'battery',
      'rssi',
    ]);
  });

  it.each([
    [{ from: NOW, to: NOW + 60 }],
    [{ devices: 'a', from: NOW, to: NOW + 60 }],
    [{ devices: 1, from: NOW, to: NOW }],
    [{ devices: 1, from: NOW, to: NOW + 60, metrics: 'wind' }],
    [{ devices: 1, from: NOW, to: NOW + 60, resolution: '1h' }],
  ])('不正な指定 %j は 400 を返す', async (params) => {
    expect((await get(params)).status).toBe(400);
  });
});
