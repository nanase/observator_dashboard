import type { Resolution, Series, SeriesResponse } from '../shared/api';
import { METRICS, type Metric } from '../shared/metrics';
import { RETENTION_1M, RETENTION_10M } from './rollup';
import { DAY, MINUTE } from './time';

export const MAX_POINTS_PER_SERIES = 5000;
const MAX_DEVICES_PER_REQUEST = 20;

const RESOLUTIONS: { resolution: Resolution; step: number; retention: number; table: string }[] = [
  { resolution: '1m', step: MINUTE, retention: RETENTION_1M, table: 'readings_1m' },
  { resolution: '10m', step: 10 * MINUTE, retention: RETENTION_10M, table: 'readings_10m' },
  { resolution: '1d', step: DAY, retention: Infinity, table: 'readings_1d' },
];

export interface SeriesQuery {
  deviceIds: number[];
  from: number;
  to: number;
  metrics: Metric[];
  resolution: Resolution | 'auto';
}

export function parseSeriesQuery(params: URLSearchParams): SeriesQuery | string {
  const deviceIds = (params.get('devices') ?? '').split(',').filter((s) => s !== '');
  if (
    deviceIds.length === 0 ||
    deviceIds.length > MAX_DEVICES_PER_REQUEST ||
    !deviceIds.every((s) => /^\d+$/.test(s))
  ) {
    return `devices must be 1 to ${MAX_DEVICES_PER_REQUEST} comma-separated ids`;
  }

  const from = Number(params.get('from'));
  const to = Number(params.get('to'));
  if (!Number.isInteger(from) || !Number.isInteger(to) || from >= to) {
    return 'from and to must be integers with from < to';
  }

  const metricsParam = params.get('metrics');
  const metrics = metricsParam === null ? [...METRICS] : metricsParam.split(',');
  if (metrics.length === 0 || !metrics.every((m): m is Metric => (METRICS as readonly string[]).includes(m))) {
    return 'metrics is invalid';
  }

  const resolution = params.get('resolution') ?? 'auto';
  if (resolution !== 'auto' && !RESOLUTIONS.some((r) => r.resolution === resolution)) {
    return 'resolution is invalid';
  }

  return {
    deviceIds: [...new Set(deviceIds.map(Number))],
    from,
    to,
    metrics,
    resolution: resolution as SeriesQuery['resolution'],
  };
}

// 要求範囲が保持期間に収まり、点数が上限以下になる最も細かい粒度を選ぶ
export function chooseResolution(from: number, to: number, now: number): Resolution {
  const choice = RESOLUTIONS.find((r) => from >= now - r.retention && (to - from) / r.step <= MAX_POINTS_PER_SERIES);
  return (choice ?? RESOLUTIONS[RESOLUTIONS.length - 1]).resolution;
}

export async function querySeries(db: D1Database, query: SeriesQuery, now: number): Promise<SeriesResponse> {
  const resolution = query.resolution === 'auto' ? chooseResolution(query.from, query.to, now) : query.resolution;
  const { step, table } = RESOLUTIONS.find((r) => r.resolution === resolution)!;
  const aggregated = resolution !== '1m';
  const columns = query.metrics.flatMap((m) => (aggregated ? [`${m}_avg`, `${m}_min`, `${m}_max`] : [m]));

  // 1 系列の点数を上限で打ち切る。粒度を明示したときに範囲が広すぎても重くならないようにする
  const statements = query.deviceIds.map((id) =>
    db
      .prepare(
        `SELECT ts, ${columns.join(', ')} FROM ${table}
         WHERE device_id = ? AND ts >= ? AND ts < ? ORDER BY ts LIMIT ${MAX_POINTS_PER_SERIES}`,
      )
      .bind(id, query.from, query.to),
  );
  const results = await db.batch<Record<string, number | null>>(statements);

  const series = results.map(({ results: rows }, index): Series => {
    const values: Series['values'] = {};
    for (const metric of query.metrics) {
      values[metric] = aggregated
        ? {
            avg: rows.map((row) => row[`${metric}_avg`]),
            min: rows.map((row) => row[`${metric}_min`]),
            max: rows.map((row) => row[`${metric}_max`]),
          }
        : { avg: rows.map((row) => row[metric]) };
    }
    return { deviceId: query.deviceIds[index], ts: rows.map((row) => row.ts as number), values };
  });

  return { resolution, step, from: query.from, to: query.to, series };
}
