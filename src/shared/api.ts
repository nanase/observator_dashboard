import type { DeviceIcon } from './icons';
import type { Metric, MetricValues } from './metrics';

export type DeviceStatus = 'pending' | 'active' | 'ignored';

export interface IngestReading extends MetricValues {
  address: string;
  kind: string;
  observedAt: number;
}

export interface IngestRequest {
  central: string;
  sentAt: number;
  readings: IngestReading[];
}

export interface IngestResponse {
  accepted: number;
  pending: number;
  ignored: number;
  rejected: number;
}

export interface LastReading extends MetricValues {
  observedAt: number;
}

export interface Device {
  id: number;
  address: string;
  kind: string;
  status: DeviceStatus;
  name: string | null;
  icon: DeviceIcon | null;
  sortOrder: number;
  hidden: boolean;
  altitudeM: number | null;
  // 温度の適正範囲（℃）。片方だけの指定もある
  temperatureMin: number | null;
  temperatureMax: number | null;
  firstSeenAt: number;
  lastSeenAt: number;
  lastReading: LastReading | null;
}

export interface LatestResponse {
  now: number;
  pendingCount: number;
  devices: Device[];
}

export interface DevicePatch {
  name?: string | null;
  icon?: DeviceIcon | null;
  sortOrder?: number;
  hidden?: boolean;
  altitudeM?: number | null;
  temperatureMin?: number | null;
  temperatureMax?: number | null;
  status?: DeviceStatus;
}

export type Resolution = '1m' | '10m' | '1d';

export interface SeriesValues {
  avg: (number | null)[];
  // 1 分粒度では集計しないので持たない
  min?: (number | null)[];
  max?: (number | null)[];
}

export interface Series {
  deviceId: number;
  ts: number[];
  values: { [M in Metric]?: SeriesValues };
}

export interface SeriesResponse {
  resolution: Resolution;
  step: number;
  from: number;
  to: number;
  series: Series[];
}
