import type { DeviceStatus, IngestResponse, LastReading } from '../shared/api';
import { METRICS, sanitizeMetric, type MetricValues } from '../shared/metrics';
import { countPendingDevices, MAC_ADDRESS_PATTERN } from './devices';
import { floorTo, floorToJstDay, HOUR, MINUTE } from './time';

export const MAX_READINGS_PER_REQUEST = 100;
export const MAX_PENDING_DEVICES = 20;
// ESP32 の送信バッファが保持しうる期間
const MAX_READING_AGE = 24 * HOUR;
// ESP32 と Worker の時計のずれの許容幅
const MAX_READING_SKEW = 5 * MINUTE;

interface ValidReading {
  address: string;
  kind: string;
  observedAt: number;
  values: Required<MetricValues>;
}

interface ParsedIngest {
  central: string;
  readings: ValidReading[];
  rejected: number;
}

function parseReading(input: unknown, now: number): ValidReading | null {
  if (typeof input !== 'object' || input === null) return null;

  const { address, kind, observedAt } = input as Record<string, unknown>;
  if (typeof address !== 'string' || !MAC_ADDRESS_PATTERN.test(address.toLowerCase())) return null;
  if (typeof kind !== 'string' || kind === '' || kind.length > 32) return null;
  if (!Number.isInteger(observedAt)) return null;

  const ts = observedAt as number;
  if (ts < now - MAX_READING_AGE || ts > now + MAX_READING_SKEW) return null;

  const values = Object.fromEntries(
    METRICS.map((metric) => [metric, sanitizeMetric(metric, (input as Record<string, unknown>)[metric])]),
  ) as Required<MetricValues>;
  if (METRICS.every((metric) => values[metric] === null)) return null;

  return { address: address.toLowerCase(), kind, observedAt: ts, values };
}

export function parseIngestRequest(body: unknown, now: number): ParsedIngest | string {
  if (typeof body !== 'object' || body === null) return 'body must be an object';

  const { central, readings } = body as Record<string, unknown>;
  if (typeof central !== 'string' || !MAC_ADDRESS_PATTERN.test(central.toLowerCase())) return 'central is invalid';
  if (!Array.isArray(readings)) return 'readings must be an array';
  if (readings.length > MAX_READINGS_PER_REQUEST) return `readings must not exceed ${MAX_READINGS_PER_REQUEST}`;

  const valid: ValidReading[] = [];
  for (const reading of readings) {
    const parsed = parseReading(reading, now);
    if (parsed !== null) valid.push(parsed);
  }

  return { central: central.toLowerCase(), readings: valid, rejected: readings.length - valid.length };
}

interface KnownDevice {
  id: number;
  status: DeviceStatus;
}

async function resolveDevices(
  db: D1Database,
  central: string,
  readings: ValidReading[],
  now: number,
): Promise<Map<string, KnownDevice>> {
  const kinds = new Map(readings.map((reading) => [reading.address, reading.kind]));
  const addresses = [...kinds.keys()];
  if (addresses.length === 0) return new Map();

  const select = () =>
    db
      .prepare(`SELECT id, address, status FROM devices WHERE address IN (${addresses.map(() => '?').join(', ')})`)
      .bind(...addresses)
      .all<KnownDevice & { address: string }>();

  let { results } = await select();
  const unknown = addresses.filter((address) => !results.some((row) => row.address === address));
  if (unknown.length === 0) {
    return new Map(results.map((row) => [row.address, row]));
  }

  // セントラル自身はサービストークンで認証済みなので承認を待たない。
  // それ以外の未知のデバイスは承認待ちとし、近隣の機器で埋め尽くされないよう件数を抑える
  let pendingSlots = MAX_PENDING_DEVICES - (await countPendingDevices(db));
  const inserts: D1PreparedStatement[] = [];
  for (const address of unknown) {
    const isCentral = address === central;
    if (!isCentral && pendingSlots <= 0) continue;
    if (!isCentral) pendingSlots--;

    inserts.push(
      db
        .prepare(
          `INSERT INTO devices (address, kind, status, first_seen_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)
           ON CONFLICT (address) DO NOTHING`,
        )
        .bind(address, kinds.get(address), isCentral ? 'active' : 'pending', now),
    );
  }
  if (inserts.length > 0) {
    await db.batch(inserts);
    ({ results } = await select());
  }

  return new Map(results.map((row) => [row.address, row]));
}

export async function ingest(db: D1Database, parsed: ParsedIngest, now: number): Promise<IngestResponse> {
  const devices = await resolveDevices(db, parsed.central, parsed.readings, now);
  const response: IngestResponse = { accepted: 0, pending: 0, ignored: 0, rejected: parsed.rejected };
  const statements: D1PreparedStatement[] = [];
  const queued = new Set<string>();
  const latest = new Map<number, ValidReading>();

  for (const reading of parsed.readings) {
    const device = devices.get(reading.address);
    if (device === undefined || device.status === 'ignored') {
      response.ignored++;
      continue;
    }

    const current = latest.get(device.id);
    if (current === undefined || current.observedAt <= reading.observedAt) {
      latest.set(device.id, reading);
    }

    if (device.status === 'pending') {
      response.pending++;
      continue;
    }

    response.accepted++;
    const ts = floorTo(reading.observedAt, MINUTE);
    const values = METRICS.map((metric) => reading.values[metric]);
    statements.push(
      db
        .prepare(
          `INSERT INTO readings_1m (device_id, ts, ${METRICS.join(', ')}) VALUES (?, ?, ${METRICS.map(() => '?').join(', ')})
           ON CONFLICT (device_id, ts) DO UPDATE SET ${METRICS.map((m) => `${m} = excluded.${m}`).join(', ')}`,
        )
        .bind(device.id, ts, ...values),
    );

    for (const [granularity, bucket] of [
      ['10m', floorTo(ts, 10 * MINUTE)],
      ['1d', floorToJstDay(ts)],
    ] as const) {
      const key = `${granularity}:${device.id}:${bucket}`;
      if (queued.has(key)) continue;
      queued.add(key);
      statements.push(
        db
          .prepare(`INSERT OR IGNORE INTO rollup_queue (granularity, device_id, bucket_ts) VALUES (?, ?, ?)`)
          .bind(granularity, device.id, bucket),
      );
    }
  }

  // 送信バッファから古い値が遅れて届いても、最新値を巻き戻さない
  for (const [id, reading] of latest) {
    const lastReading: LastReading = { observedAt: reading.observedAt, ...reading.values };
    statements.push(
      db
        .prepare(
          `UPDATE devices SET kind = ?1, last_seen_at = ?2, last_reading = ?3, updated_at = ?4
           WHERE id = ?5 AND last_seen_at <= ?2`,
        )
        .bind(reading.kind, reading.observedAt, JSON.stringify(lastReading), now, id),
    );
  }

  if (statements.length > 0) {
    await db.batch(statements);
  }
  return response;
}
