import type { MetricValues } from './metrics';

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
  sortOrder: number;
  hidden: boolean;
  altitudeM: number | null;
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
  sortOrder?: number;
  hidden?: boolean;
  altitudeM?: number | null;
  status?: DeviceStatus;
}

// 旧ダッシュボードの「Export」が出力する JSON の要素
export interface LegacyObservatorItem {
  address: string;
  name?: string;
  hidden?: boolean;
  result?: { type?: string };
}
