import { createScheduledController, env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/worker/index';
import { processRollups, purgeExpired, RETENTION_10M, RETENTION_1M } from '../src/worker/rollup';
import { DAY, floorTo, floorToJstDay } from '../src/worker/time';
import { CENTRAL, nowSec, postIngest, resetDatabase } from './helpers';

// 2026-01-01 00:00 JST
const DAY0 = Date.UTC(2025, 11, 31, 15) / 1000;

async function insertDevice(address = CENTRAL): Promise<number> {
  return (await env.DB.prepare(
    `INSERT INTO devices (address, kind, status, first_seen_at, updated_at) VALUES (?, 'ESP32-Central', 'active', 0, 0)
     RETURNING id`,
  )
    .bind(address)
    .first<number>('id'))!;
}

async function insert1m(deviceId: number, ts: number, temperature: number | null, humidity: number | null = null) {
  await env.DB.prepare('INSERT INTO readings_1m (device_id, ts, temperature, humidity) VALUES (?, ?, ?, ?)')
    .bind(deviceId, ts, temperature, humidity)
    .run();
}

async function enqueue(granularity: '10m' | '1d', deviceId: number, bucket: number) {
  await env.DB.prepare('INSERT OR IGNORE INTO rollup_queue (granularity, device_id, bucket_ts) VALUES (?, ?, ?)')
    .bind(granularity, deviceId, bucket)
    .run();
}

async function queueSize(): Promise<number> {
  return (await env.DB.prepare('SELECT COUNT(*) AS n FROM rollup_queue').first<number>('n'))!;
}

beforeEach(resetDatabase);

describe('10 分集計', () => {
  it('平均・最小・最大と件数を求める', async () => {
    const id = await insertDevice();
    await insert1m(id, DAY0, 20, 50);
    await insert1m(id, DAY0 + 60, 22, null);
    await insert1m(id, DAY0 + 120, 24, 60);
    await insert1m(id, DAY0 + 600, 99, 99);
    await enqueue('10m', id, DAY0);

    expect(await processRollups(env.DB, DAY0 + 600 + 120)).toEqual({ tenMinutes: 1, days: 0 });

    const row = await env.DB.prepare('SELECT * FROM readings_10m').first();
    expect(row).toMatchObject({
      ts: DAY0,
      n: 3,
      temperature_avg: 22,
      temperature_min: 20,
      temperature_max: 24,
      humidity_avg: 55,
      co2_avg: null,
    });
    expect(await queueSize()).toBe(0);
  });

  it('終了直後のバケットは送信遅れを見込んで待つ', async () => {
    const id = await insertDevice();
    await insert1m(id, DAY0, 20);
    await enqueue('10m', id, DAY0);

    expect(await processRollups(env.DB, DAY0 + 600 + 60)).toEqual({ tenMinutes: 0, days: 0 });
    expect(await queueSize()).toBe(1);
  });

  it('集計後に遅れて届いた値も集計し直す', async () => {
    const now = nowSec();
    const minute = floorTo(now, 600) - 1200;
    const reading = (observedAt: number, temperature: number) => ({
      central: CENTRAL,
      sentAt: now,
      readings: [{ address: CENTRAL, kind: 'ESP32-Central', observedAt, temperature }],
    });

    await postIngest(reading(minute, 20));
    await processRollups(env.DB, now + 3600);
    await postIngest(reading(minute + 60, 30));
    await processRollups(env.DB, now + 3600);

    const row = await env.DB.prepare('SELECT n, temperature_avg FROM readings_10m WHERE ts = ?').bind(minute).first();
    expect(row).toEqual({ n: 2, temperature_avg: 25 });
  });
});

describe('1 日集計', () => {
  it('10 分平均を件数で重み付けする', async () => {
    const id = await insertDevice();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO readings_10m (device_id, ts, n, temperature_avg, temperature_min, temperature_max)
         VALUES (?1, ?2, 1, 20, 19, 21), (?1, ?2 + 600, 3, 24, 22, 26), (?1, ?2 + ${DAY}, 5, 0, 0, 0)`,
      ).bind(id, DAY0),
    ]);
    await enqueue('1d', id, DAY0);

    expect(await processRollups(env.DB, DAY0 + DAY + 600)).toEqual({ tenMinutes: 0, days: 1 });

    const row = await env.DB.prepare('SELECT * FROM readings_1d').first();
    expect(row).toMatchObject({
      ts: DAY0,
      n: 4,
      temperature_avg: 23,
      temperature_min: 19,
      temperature_max: 26,
      humidity_avg: null,
    });
  });

  it('日が終わるまで集計しない', async () => {
    const id = await insertDevice();
    await enqueue('1d', id, DAY0);

    expect(await processRollups(env.DB, DAY0 + DAY - 60)).toEqual({ tenMinutes: 0, days: 0 });
  });

  it('同じ実行の中で 1 分値から 10 分・1 日まで集計する', async () => {
    const id = await insertDevice();
    await insert1m(id, DAY0 + 3600, 10);
    await insert1m(id, DAY0 + 7200, 30);
    await enqueue('10m', id, DAY0 + 3600);
    await enqueue('10m', id, DAY0 + 7200);
    await enqueue('1d', id, floorToJstDay(DAY0 + 3600));

    expect(await processRollups(env.DB, DAY0 + DAY + 600)).toEqual({ tenMinutes: 2, days: 1 });
    const row = await env.DB.prepare('SELECT n, temperature_avg FROM readings_1d').first();
    expect(row).toEqual({ n: 2, temperature_avg: 20 });
  });
});

describe('purgeExpired', () => {
  it('保持期間を過ぎた 1 分値と 10 分値を消し、1 日値は残す', async () => {
    const id = await insertDevice();
    const now = DAY0 + 5 * 366 * DAY;
    await insert1m(id, now - RETENTION_1M - 60, 1);
    await insert1m(id, now - RETENTION_1M + 60, 2);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO readings_10m (device_id, ts, n) VALUES (?1, ?2, 1), (?1, ?3, 1)').bind(
        id,
        now - RETENTION_10M - 600,
        now - RETENTION_10M + 600,
      ),
      env.DB.prepare('INSERT INTO readings_1d (device_id, ts, n) VALUES (?, ?, 1)').bind(id, DAY0),
    ]);

    await purgeExpired(env.DB, now);

    const count = async (table: string) =>
      (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<number>('n'))!;
    expect(await count('readings_1m')).toBe(1);
    expect(await count('readings_10m')).toBe(1);
    expect(await count('readings_1d')).toBe(1);
  });
});

describe('scheduled', () => {
  it('5 分ごとの Cron で集計する', async () => {
    const id = await insertDevice();
    const bucket = floorTo(nowSec(), 600) - 1200;
    await insert1m(id, bucket, 20);
    await enqueue('10m', id, bucket);

    await worker.scheduled(createScheduledController({ cron: '*/5 * * * *' }), env);

    expect(await queueSize()).toBe(0);
  });
});
