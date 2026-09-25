export const METRICS = ['temperature', 'humidity', 'pressure', 'co2', 'battery', 'rssi'] as const;

export type Metric = (typeof METRICS)[number];

export type MetricValues = { [M in Metric]?: number | null };

// センサーの仕様上ありえない値を弾くための範囲。外れた値は欠測として扱う
export const METRIC_RANGES: { [M in Metric]: readonly [min: number, max: number] } = {
  temperature: [-40, 85],
  humidity: [0, 100],
  pressure: [300, 1100],
  co2: [0, 10000],
  battery: [0, 100],
  rssi: [-127, 0],
};

export function sanitizeMetric(metric: Metric, value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const [min, max] = METRIC_RANGES[metric];
  return value >= min && value <= max ? value : null;
}
