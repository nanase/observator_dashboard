import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Device, LatestResponse } from '../src/shared/api';
import { floorToJstDay } from '../src/worker/time';
import { asUser, CENTRAL, nowSec, postIngest, resetDatabase } from './helpers';

const SENSOR_A = '11:22:33:44:55:01';

async function devices(): Promise<Device[]> {
  return ((await (await asUser('/api/devices')).json()) as { devices: Device[] }).devices;
}

async function addDevice(address: string, name: string | null = null): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO devices (address, kind, status, name, first_seen_at, updated_at) VALUES (?, 'W3400010', 'active', ?, 0, 0)`,
  )
    .bind(address, name)
    .run();
}

beforeEach(resetDatabase);

describe('PATCH /api/devices/:id', () => {
  it('名前・順序・非表示・高度を変更できる', async () => {
    await addDevice(SENSOR_A);
    const [device] = await devices();

    const response = await asUser(`/api/devices/${device.id}`, {
      method: 'PATCH',
      body: { name: '  書斎  ', sortOrder: 5, hidden: true, altitudeM: 380.4 },
    });
    expect(await response.json()).toMatchObject({ name: '書斎', sortOrder: 5, hidden: true, altitudeM: 380.4 });
  });

  it('アイコンを設定・解除できる', async () => {
    await addDevice(SENSOR_A);
    const [device] = await devices();

    const set = await asUser(`/api/devices/${device.id}`, { method: 'PATCH', body: { icon: 'bathtub' } });
    expect(await set.json()).toMatchObject({ icon: 'bathtub' });
    const unset = await asUser(`/api/devices/${device.id}`, { method: 'PATCH', body: { icon: null } });
    expect(await unset.json()).toMatchObject({ icon: null });
  });

  it('温度の適正範囲は片方だけでも設定でき、解除もできる', async () => {
    await addDevice(SENSOR_A);
    const [device] = await devices();
    const patch = async (body: unknown) =>
      (await asUser(`/api/devices/${device.id}`, { method: 'PATCH', body })).json();

    expect(await patch({ temperatureMin: 0, temperatureMax: 6 })).toMatchObject({
      temperatureMin: 0,
      temperatureMax: 6,
    });
    expect(await patch({ temperatureMin: null })).toMatchObject({ temperatureMin: null, temperatureMax: 6 });
    expect(await patch({ temperatureMax: null })).toMatchObject({ temperatureMin: null, temperatureMax: null });
  });

  it('空の名前は未設定に戻す', async () => {
    await addDevice(SENSOR_A, '書斎');
    const [device] = await devices();

    const response = await asUser(`/api/devices/${device.id}`, { method: 'PATCH', body: { name: '' } });
    expect(await response.json()).toMatchObject({ name: null });
  });

  it.each([
    { status: 'deleted' },
    { icon: 'rocket' },
    { temperatureMin: 10, temperatureMax: 5 },
    { temperatureMax: 200 },
    { hidden: 1 },
    { sortOrder: 1.5 },
    { altitudeM: '380' },
    { name: 1 },
    [],
  ])('不正な値 %j は 400 を返す', async (body) => {
    await addDevice(SENSOR_A);
    const [device] = await devices();
    expect((await asUser(`/api/devices/${device.id}`, { method: 'PATCH', body })).status).toBe(400);
  });

  it('存在しない ID は 404 を返す', async () => {
    expect((await asUser('/api/devices/999', { method: 'PATCH', body: { hidden: true } })).status).toBe(404);
  });
});

describe('GET /api/latest', () => {
  it('承認済みのデバイスと承認待ちの件数を返す', async () => {
    const now = nowSec();
    await postIngest({
      central: CENTRAL,
      sentAt: now,
      readings: [
        { address: CENTRAL, kind: 'ESP32-Central', observedAt: now, co2: 700 },
        { address: SENSOR_A, kind: 'W3400010', observedAt: now, temperature: 21.5 },
      ],
    });

    const latest = (await (await asUser('/api/latest')).json()) as LatestResponse;
    expect(latest.pendingCount).toBe(1);
    expect(latest.devices).toHaveLength(1);
    expect(latest.devices[0]).toMatchObject({ address: CENTRAL, lastReading: { observedAt: now, co2: 700 } });
  });
});

describe('floorToJstDay', () => {
  it('JST の 0 時に丸める', () => {
    // 2026-01-01 00:00 JST = 2025-12-31 15:00 UTC
    const midnight = Date.UTC(2025, 11, 31, 15) / 1000;
    expect(floorToJstDay(midnight)).toBe(midnight);
    expect(floorToJstDay(midnight + 86399)).toBe(midnight);
    expect(floorToJstDay(midnight - 1)).toBe(midnight - 86400);
  });
});
