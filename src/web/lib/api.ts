import type {
  Device,
  DevicePatch,
  LatestResponse,
  LegacyObservatorItem,
  Resolution,
  SeriesResponse,
} from '../../shared/api';
import type { Metric } from '../../shared/metrics';

// Access のセッションが切れると、API への要求はログイン画面へのリダイレクトになる
export class SessionExpiredError extends Error {
  constructor() {
    super('ログインの有効期限が切れました');
  }
}

export class ApiError extends Error {}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    redirect: 'manual',
    headers: init.body === undefined ? init.headers : { 'Content-Type': 'application/json', ...init.headers },
  });

  if (response.type === 'opaqueredirect' || response.status === 401) {
    throw new SessionExpiredError();
  }
  if (!(response.headers.get('Content-Type') ?? '').includes('application/json')) {
    throw new SessionExpiredError();
  }

  const body = await response.json();
  if (!response.ok) {
    throw new ApiError((body as { error?: string }).error ?? `HTTP ${response.status}`);
  }
  return body as T;
}

export interface SeriesQuery {
  deviceIds: number[];
  from: number;
  to: number;
  metrics: Metric[];
  resolution?: Resolution | 'auto';
}

export const api = {
  latest: () => request<LatestResponse>('/api/latest'),

  devices: async () => (await request<{ devices: Device[] }>('/api/devices')).devices,

  series: (query: SeriesQuery) => {
    const params = new URLSearchParams({
      devices: query.deviceIds.join(','),
      from: String(query.from),
      to: String(query.to),
      metrics: query.metrics.join(','),
      resolution: query.resolution ?? 'auto',
    });
    return request<SeriesResponse>(`/api/series?${params}`);
  },

  updateDevice: (id: number, patch: DevicePatch) =>
    request<Device>(`/api/devices/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  importLegacy: (items: LegacyObservatorItem[]) =>
    request<{ imported: number }>('/api/devices/import', { method: 'POST', body: JSON.stringify(items) }),
};
