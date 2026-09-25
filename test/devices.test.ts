import { beforeEach, describe, expect, it } from 'vitest';
import type { Device, LatestResponse } from '../src/shared/api';
import { floorToJstDay } from '../src/worker/time';
import { asUser, CENTRAL, nowSec, postIngest, resetDatabase } from './helpers';

const SENSOR_A = '11:22:33:44:55:01';
const SENSOR_B = '11:22:33:44:55:02';

async function devices(): Promise<Device[]> {
  return ((await (await asUser('/api/devices')).json()) as { devices: Device[] }).devices;
}

beforeEach(resetDatabase);

describe('POST /api/devices/import', () => {
  it('旧ダッシュボードのエクスポートを承認済みとして取り込む', async () => {
    const response = await asUser('/api/devices/import', {
      method: 'POST',
      body: [
        { address: SENSOR_B.toUpperCase(), name: '寝室', result: { type: 'W3200010', sensor: [] } },
        { address: SENSOR_A, name: SENSOR_A, hidden: true },
      ],
    });
    expect(await response.json()).toEqual({ imported: 2 });

    expect(await devices()).toMatchObject([
      { address: SENSOR_B, kind: 'W3400010', status: 'active', name: '寝室', sortOrder: 0, hidden: false },
      { address: SENSOR_A, kind: 'unknown', status: 'active', name: null, sortOrder: 1, hidden: true },
    ]);
  });

  it('既存のデバイスは名前と順序を上書きし、種別は受信値を保つ', async () => {
    await postIngest({
      central: CENTRAL,
      sentAt: nowSec(),
      readings: [{ address: SENSOR_A, kind: 'W3400010', observedAt: nowSec(), temperature: 20 }],
    });
    await asUser('/api/devices/import', { method: 'POST', body: [{ address: SENSOR_A, name: '居間' }] });

    expect(await devices()).toMatchObject([{ address: SENSOR_A, kind: 'W3400010', status: 'active', name: '居間' }]);
  });

  it('形式が不正なら 400 を返す', async () => {
    const response = await asUser('/api/devices/import', { method: 'POST', body: [{ address: 'x' }] });
    expect(response.status).toBe(400);
  });
});

describe('PATCH /api/devices/:id', () => {
  it('名前・順序・非表示・高度を変更できる', async () => {
    await asUser('/api/devices/import', { method: 'POST', body: [{ address: SENSOR_A }] });
    const [device] = await devices();

    const response = await asUser(`/api/devices/${device.id}`, {
      method: 'PATCH',
      body: { name: '  書斎  ', sortOrder: 5, hidden: true, altitudeM: 380.4 },
    });
    expect(await response.json()).toMatchObject({ name: '書斎', sortOrder: 5, hidden: true, altitudeM: 380.4 });
  });

  it('空の名前は未設定に戻す', async () => {
    await asUser('/api/devices/import', { method: 'POST', body: [{ address: SENSOR_A, name: '書斎' }] });
    const [device] = await devices();

    const response = await asUser(`/api/devices/${device.id}`, { method: 'PATCH', body: { name: '' } });
    expect(await response.json()).toMatchObject({ name: null });
  });

  it.each([{ status: 'deleted' }, { hidden: 1 }, { sortOrder: 1.5 }, { altitudeM: '380' }, { name: 1 }, []])(
    '不正な値 %j は 400 を返す',
    async (body) => {
      await asUser('/api/devices/import', { method: 'POST', body: [{ address: SENSOR_A }] });
      const [device] = await devices();
      expect((await asUser(`/api/devices/${device.id}`, { method: 'PATCH', body })).status).toBe(400);
    },
  );

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
