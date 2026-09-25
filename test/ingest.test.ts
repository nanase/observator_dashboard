import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IngestResponse } from '../src/shared/api';
import { MAX_PENDING_DEVICES } from '../src/worker/ingest';
import { asUser, CENTRAL, nowSec, postIngest, resetDatabase } from './helpers';

const SENSOR = '11:22:33:44:55:66';

function centralReading(observedAt: number, extra: Record<string, unknown> = {}) {
  return {
    address: CENTRAL,
    kind: 'ESP32-Central',
    observedAt,
    temperature: 25.12,
    humidity: 45.1,
    pressure: 970.12,
    co2: 800,
    rssi: -60,
    ...extra,
  };
}

function sensorReading(observedAt: number, address = SENSOR, extra: Record<string, unknown> = {}) {
  return { address, kind: 'W3400010', observedAt, temperature: 23.4, humidity: 55, battery: 100, rssi: -70, ...extra };
}

async function ingest(readings: unknown[]): Promise<IngestResponse> {
  const response = await postIngest({ central: CENTRAL, sentAt: nowSec(), readings });
  expect(response.status).toBe(200);
  return response.json();
}

async function deviceByAddress(address: string) {
  return env.DB.prepare('SELECT * FROM devices WHERE address = ?').bind(address).first<Record<string, unknown>>();
}

async function countReadings(address: string): Promise<number> {
  return (
    (await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM readings_1m r JOIN devices d ON d.id = r.device_id WHERE d.address = ?',
    )
      .bind(address)
      .first<number>('n')) ?? 0
  );
}

beforeEach(resetDatabase);

describe('POST /api/ingest', () => {
  it('セントラル自身は承認なしで記録する', async () => {
    const now = nowSec();
    expect(await ingest([centralReading(now)])).toEqual({ accepted: 1, pending: 0, ignored: 0, rejected: 0 });

    const device = await deviceByAddress(CENTRAL);
    expect(device).toMatchObject({ status: 'active', kind: 'ESP32-Central', last_seen_at: now });

    const row = await env.DB.prepare('SELECT * FROM readings_1m').first<Record<string, unknown>>();
    expect(row).toMatchObject({ ts: now - (now % 60), temperature: 25.12, co2: 800, battery: null });
  });

  it('未知の温湿度計は承認待ちとし、最新値だけを持つ', async () => {
    const now = nowSec();
    expect(await ingest([sensorReading(now)])).toMatchObject({ accepted: 0, pending: 1 });

    const device = await deviceByAddress(SENSOR);
    expect(device).toMatchObject({ status: 'pending', last_seen_at: now });
    expect(JSON.parse(device!.last_reading as string)).toMatchObject({ observedAt: now, temperature: 23.4 });
    expect(await countReadings(SENSOR)).toBe(0);
  });

  it('承認後は記録する', async () => {
    const now = nowSec();
    await ingest([sensorReading(now - 60)]);
    const device = await deviceByAddress(SENSOR);
    await asUser(`/api/devices/${device!.id}`, { method: 'PATCH', body: { status: 'active' } });

    expect(await ingest([sensorReading(now)])).toMatchObject({ accepted: 1 });
    expect(await countReadings(SENSOR)).toBe(1);
  });

  it('無視したデバイスは何も更新しない', async () => {
    const now = nowSec();
    await ingest([sensorReading(now - 60)]);
    const device = await deviceByAddress(SENSOR);
    await asUser(`/api/devices/${device!.id}`, { method: 'PATCH', body: { status: 'ignored' } });

    expect(await ingest([sensorReading(now)])).toMatchObject({ ignored: 1 });
    expect(await deviceByAddress(SENSOR)).toMatchObject({ last_seen_at: now - 60 });
  });

  it('承認待ちが上限に達したら新しいデバイスを登録しない', async () => {
    const now = nowSec();
    const readings = Array.from({ length: MAX_PENDING_DEVICES + 2 }, (_, i) =>
      sensorReading(now, `00:00:00:00:00:${i.toString(16).padStart(2, '0')}`),
    );
    expect(await ingest(readings)).toMatchObject({ pending: MAX_PENDING_DEVICES, ignored: 2 });

    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM devices').first<number>('n');
    expect(count).toBe(MAX_PENDING_DEVICES);
  });

  it('同じ分の再送は 1 行にまとめる', async () => {
    const minute = nowSec() - (nowSec() % 60) - 60;
    await ingest([centralReading(minute + 5)]);
    await ingest([centralReading(minute + 5), centralReading(minute + 30, { temperature: 26 })]);

    const rows = await env.DB.prepare('SELECT ts, temperature FROM readings_1m').all();
    expect(rows.results).toEqual([{ ts: minute, temperature: 26 }]);
  });

  it('10 分と 1 日（JST）のバケットを集計待ちに積む', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:05:00+09:00'));
    try {
      const midnight = Date.parse('2026-01-01T00:00:00+09:00') / 1000;
      await ingest([centralReading(midnight - 30), centralReading(midnight + 30), centralReading(midnight + 90)]);

      const { results } = await env.DB.prepare(
        'SELECT granularity, bucket_ts FROM rollup_queue ORDER BY granularity, bucket_ts',
      ).all();
      expect(results).toEqual([
        { granularity: '10m', bucket_ts: midnight - 600 },
        { granularity: '10m', bucket_ts: midnight },
        { granularity: '1d', bucket_ts: midnight - 86400 },
        { granularity: '1d', bucket_ts: midnight },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('範囲外の値は欠測にする', async () => {
    await ingest([centralReading(nowSec(), { temperature: 150, co2: -1, humidity: 'wet' })]);

    const row = await env.DB.prepare('SELECT temperature, humidity, co2, pressure FROM readings_1m').first();
    expect(row).toEqual({ temperature: null, humidity: null, co2: null, pressure: 970.12 });
  });

  it('古すぎる値・未来の値・形式が不正な値は拒否する', async () => {
    const now = nowSec();
    const result = await ingest([
      centralReading(now - 25 * 3600),
      centralReading(now + 600),
      centralReading(now, { address: 'not-a-mac' }),
      centralReading(now + 0.5),
      { address: CENTRAL, kind: 'ESP32-Central', observedAt: now },
      centralReading(now),
    ]);
    expect(result).toEqual({ accepted: 1, pending: 0, ignored: 0, rejected: 5 });
  });

  it('遅れて届いた古い値で最新値を巻き戻さない', async () => {
    const now = nowSec();
    await ingest([centralReading(now)]);
    await ingest([centralReading(now - 600, { temperature: 20 })]);

    const device = await deviceByAddress(CENTRAL);
    expect(device).toMatchObject({ last_seen_at: now });
    expect(JSON.parse(device!.last_reading as string)).toMatchObject({ temperature: 25.12 });
    expect(await countReadings(CENTRAL)).toBe(2);
  });

  it('アドレスは小文字にそろえる', async () => {
    await ingest([centralReading(nowSec(), { address: CENTRAL.toUpperCase() })]);
    expect(await deviceByAddress(CENTRAL)).not.toBeNull();
  });

  it('件数が上限を超えたら 400 を返す', async () => {
    const readings = Array.from({ length: 101 }, () => centralReading(nowSec()));
    const response = await postIngest({ central: CENTRAL, sentAt: nowSec(), readings });
    expect(response.status).toBe(400);
  });

  it('JSON でなければ 400 を返す', async () => {
    const response = await postIngest(undefined);
    expect(response.status).toBe(400);
  });
});
