import { METRICS } from '../shared/metrics';
import { DAY, MINUTE } from './time';

// ESP32 の送信遅れを見込み、バケットの終了からこの時間が過ぎてから集計する。
// これより遅れて届いた値も、受信時に集計待ちへ積み直されるので取りこぼさない
const ROLLUP_GRACE = 2 * MINUTE;
const BUCKETS_PER_BATCH = 100;
const MAX_BATCHES_PER_RUN = 10;

export const RETENTION_1M = 366 * DAY;
export const RETENTION_10M = 3 * 366 * DAY;

const AGGREGATE_COLUMNS = METRICS.flatMap((m) => [`${m}_avg`, `${m}_min`, `${m}_max`]);
const UPSERT_AGGREGATE = `ON CONFLICT (device_id, ts) DO UPDATE SET n = excluded.n, ${AGGREGATE_COLUMNS.map(
  (c) => `${c} = excluded.${c}`,
).join(', ')}`;

const ROLLUP_10M = `
  INSERT INTO readings_10m (device_id, ts, n, ${AGGREGATE_COLUMNS.join(', ')})
  SELECT device_id, ?2, COUNT(*), ${METRICS.map((m) => `AVG(${m}), MIN(${m}), MAX(${m})`).join(', ')}
  FROM readings_1m WHERE device_id = ?1 AND ts >= ?2 AND ts < ?2 + ${10 * MINUTE}
  GROUP BY device_id
  ${UPSERT_AGGREGATE}`;

// 1 日の平均は 10 分平均を件数で重み付けして求める
const ROLLUP_1D = `
  INSERT INTO readings_1d (device_id, ts, n, ${AGGREGATE_COLUMNS.join(', ')})
  SELECT device_id, ?2, SUM(n), ${METRICS.map(
    (m) => `SUM(${m}_avg * n) / SUM(CASE WHEN ${m}_avg IS NULL THEN NULL ELSE n END), MIN(${m}_min), MAX(${m}_max)`,
  ).join(', ')}
  FROM readings_10m WHERE device_id = ?1 AND ts >= ?2 AND ts < ?2 + ${DAY}
  GROUP BY device_id
  ${UPSERT_AGGREGATE}`;

interface QueueEntry {
  device_id: number;
  bucket_ts: number;
}

async function processQueue(db: D1Database, granularity: '10m' | '1d', dueQuery: string, rollup: string, now: number) {
  let processed = 0;

  for (let i = 0; i < MAX_BATCHES_PER_RUN; i++) {
    const { results } = await db.prepare(dueQuery).bind(now, BUCKETS_PER_BATCH).all<QueueEntry>();
    if (results.length === 0) break;

    // 削除と集計を同じトランザクションで行う。集計の後に届いた値は集計待ちに積み直される
    await db.batch(
      results.flatMap(({ device_id, bucket_ts }) => [
        db
          .prepare('DELETE FROM rollup_queue WHERE granularity = ? AND device_id = ? AND bucket_ts = ?')
          .bind(granularity, device_id, bucket_ts),
        db.prepare(rollup).bind(device_id, bucket_ts),
      ]),
    );
    processed += results.length;
    if (results.length < BUCKETS_PER_BATCH) break;
  }

  return processed;
}

export async function processRollups(db: D1Database, now: number): Promise<{ tenMinutes: number; days: number }> {
  const tenMinutes = await processQueue(
    db,
    '10m',
    `SELECT device_id, bucket_ts FROM rollup_queue
     WHERE granularity = '10m' AND bucket_ts + ${10 * MINUTE + ROLLUP_GRACE} <= ?
     ORDER BY bucket_ts LIMIT ?`,
    ROLLUP_10M,
    now,
  );

  // 1 日の集計は 10 分集計から作るので、その日の 10 分集計が残っていれば待つ
  const days = await processQueue(
    db,
    '1d',
    `SELECT q.device_id, q.bucket_ts FROM rollup_queue q
     WHERE q.granularity = '1d' AND q.bucket_ts + ${DAY + ROLLUP_GRACE} <= ?
       AND NOT EXISTS (
         SELECT 1 FROM rollup_queue p
         WHERE p.granularity = '10m' AND p.device_id = q.device_id
           AND p.bucket_ts >= q.bucket_ts AND p.bucket_ts < q.bucket_ts + ${DAY}
       )
     ORDER BY q.bucket_ts LIMIT ?`,
    ROLLUP_1D,
    now,
  );

  return { tenMinutes, days };
}

export async function purgeExpired(db: D1Database, now: number): Promise<void> {
  // 主キーの範囲で消すため、デバイスごとに文を分ける
  const { results } = await db.prepare('SELECT id FROM devices').all<{ id: number }>();
  const statements = results.flatMap(({ id }) => [
    db.prepare('DELETE FROM readings_1m WHERE device_id = ? AND ts < ?').bind(id, now - RETENTION_1M),
    db.prepare('DELETE FROM readings_10m WHERE device_id = ? AND ts < ?').bind(id, now - RETENTION_10M),
  ]);

  if (statements.length > 0) {
    await db.batch(statements);
  }
}
