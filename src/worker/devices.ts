import type { Device, DevicePatch, DeviceStatus, LastReading, LegacyObservatorItem } from '../shared/api';
import { isDeviceIcon, type DeviceIcon } from '../shared/icons';
import { METRIC_RANGES } from '../shared/metrics';

export interface DeviceRow {
  id: number;
  address: string;
  kind: string;
  status: DeviceStatus;
  name: string | null;
  icon: string | null;
  sort_order: number;
  hidden: number;
  altitude_m: number | null;
  temperature_min: number | null;
  temperature_max: number | null;
  first_seen_at: number;
  last_seen_at: number;
  last_reading: string | null;
}

export const DEVICE_STATUSES: readonly DeviceStatus[] = ['pending', 'active', 'ignored'];

export const MAC_ADDRESS_PATTERN = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/;

export function toDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    address: row.address,
    kind: row.kind,
    status: row.status,
    name: row.name,
    icon: isDeviceIcon(row.icon) ? row.icon : null,
    sortOrder: row.sort_order,
    hidden: row.hidden === 1,
    altitudeM: row.altitude_m,
    temperatureMin: row.temperature_min,
    temperatureMax: row.temperature_max,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    lastReading: row.last_reading === null ? null : (JSON.parse(row.last_reading) as LastReading),
  };
}

export async function listDevices(db: D1Database, status?: DeviceStatus): Promise<Device[]> {
  const where = status === undefined ? '' : 'WHERE status = ?';
  const statement = db.prepare(`SELECT * FROM devices ${where} ORDER BY sort_order, id`);
  const { results } = await (status === undefined ? statement : statement.bind(status)).all<DeviceRow>();
  return results.map(toDevice);
}

export async function countPendingDevices(db: D1Database): Promise<number> {
  return (await db.prepare(`SELECT COUNT(*) AS n FROM devices WHERE status = 'pending'`).first<number>('n')) ?? 0;
}

export function parseDevicePatch(body: unknown): DevicePatch | string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return 'body must be an object';
  }

  const input = body as Record<string, unknown>;
  const patch: DevicePatch = {};

  if ('name' in input) {
    if (input.name !== null && typeof input.name !== 'string') return 'name must be a string or null';
    const name = typeof input.name === 'string' ? input.name.trim() : null;
    if (name !== null && name.length > 64) return 'name is too long';
    patch.name = name === '' ? null : name;
  }
  if ('icon' in input) {
    if (input.icon !== null && !isDeviceIcon(input.icon)) return 'icon is invalid';
    patch.icon = input.icon as DeviceIcon | null;
  }
  if ('sortOrder' in input) {
    if (!Number.isInteger(input.sortOrder)) return 'sortOrder must be an integer';
    patch.sortOrder = input.sortOrder as number;
  }
  if ('hidden' in input) {
    if (typeof input.hidden !== 'boolean') return 'hidden must be a boolean';
    patch.hidden = input.hidden;
  }
  if ('altitudeM' in input) {
    const altitude = input.altitudeM;
    if (altitude !== null && (typeof altitude !== 'number' || !Number.isFinite(altitude))) {
      return 'altitudeM must be a number or null';
    }
    patch.altitudeM = altitude;
  }
  for (const key of ['temperatureMin', 'temperatureMax'] as const) {
    if (!(key in input)) continue;
    const value = input[key];
    const [min, max] = METRIC_RANGES.temperature;
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)) {
      return `${key} must be a number between ${min} and ${max} or null`;
    }
    patch[key] = value;
  }
  if (
    typeof patch.temperatureMin === 'number' &&
    typeof patch.temperatureMax === 'number' &&
    patch.temperatureMin >= patch.temperatureMax
  ) {
    return 'temperatureMin must be less than temperatureMax';
  }
  if ('status' in input) {
    if (!DEVICE_STATUSES.includes(input.status as DeviceStatus)) return 'status is invalid';
    patch.status = input.status as DeviceStatus;
  }

  return patch;
}

export async function updateDevice(
  db: D1Database,
  id: number,
  patch: DevicePatch,
  now: number,
): Promise<Device | null> {
  const columns: Record<keyof DevicePatch, string> = {
    name: 'name',
    icon: 'icon',
    sortOrder: 'sort_order',
    hidden: 'hidden',
    altitudeM: 'altitude_m',
    temperatureMin: 'temperature_min',
    temperatureMax: 'temperature_max',
    status: 'status',
  };
  const assignments: string[] = [];
  const values: unknown[] = [];

  for (const key of Object.keys(columns) as (keyof DevicePatch)[]) {
    if (patch[key] === undefined) continue;
    assignments.push(`${columns[key]} = ?`);
    values.push(key === 'hidden' ? Number(patch[key]) : patch[key]);
  }

  const row = await db
    .prepare(`UPDATE devices SET ${[...assignments, 'updated_at = ?'].join(', ')} WHERE id = ? RETURNING *`)
    .bind(...values, now, id)
    .first<DeviceRow>();
  return row === null ? null : toDevice(row);
}

// 旧ダッシュボードの種別名は実機と食い違っていたので読み替える
const LEGACY_KIND_ALIASES: Record<string, string> = { W3200010: 'W3400010' };

export function parseLegacyExport(body: unknown): LegacyObservatorItem[] | string {
  if (!Array.isArray(body)) return 'body must be an array';
  if (body.length > 100) return 'too many items';

  const items: LegacyObservatorItem[] = [];
  for (const entry of body) {
    if (typeof entry !== 'object' || entry === null) return 'each item must be an object';
    const { address, name, hidden, result } = entry as Record<string, unknown>;
    if (typeof address !== 'string' || !MAC_ADDRESS_PATTERN.test(address.toLowerCase())) {
      return 'each item must have a valid address';
    }
    items.push({
      address: address.toLowerCase(),
      name: typeof name === 'string' ? name.trim().slice(0, 64) : undefined,
      hidden: hidden === true,
      result:
        typeof result === 'object' && result !== null && typeof (result as { type?: unknown }).type === 'string'
          ? { type: (result as { type: string }).type }
          : undefined,
    });
  }
  return items;
}

// 取り込んだデバイスは承認済みとし、並び順は配列の順に従う
export async function importLegacyDevices(db: D1Database, items: LegacyObservatorItem[], now: number): Promise<number> {
  const statements = items.map((item, index) => {
    const legacyKind = item.result?.type;
    const kind = legacyKind === undefined ? 'unknown' : (LEGACY_KIND_ALIASES[legacyKind] ?? legacyKind);
    const name = item.name === undefined || item.name === '' || item.name === item.address ? null : item.name;

    return db
      .prepare(
        `INSERT INTO devices (address, kind, status, name, sort_order, hidden, first_seen_at, updated_at)
         VALUES (?1, ?2, 'active', ?3, ?4, ?5, ?6, ?6)
         ON CONFLICT (address) DO UPDATE SET
           status = 'active', name = excluded.name, sort_order = excluded.sort_order,
           hidden = excluded.hidden, updated_at = excluded.updated_at`,
      )
      .bind(item.address, kind, name, index, Number(item.hidden === true), now);
  });

  if (statements.length > 0) {
    await db.batch(statements);
  }
  return statements.length;
}
