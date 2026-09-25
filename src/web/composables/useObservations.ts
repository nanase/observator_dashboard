import { computed, ref, shallowRef } from 'vue';
import type { Device, LatestResponse, SeriesResponse } from '../../shared/api';
import { api, SessionExpiredError } from '../lib/api';

const LATEST_INTERVAL_MS = 30_000;
const RECENT_INTERVAL_MS = 5 * 60_000;

const latest = shallowRef<LatestResponse | null>(null);
const recent = shallowRef<SeriesResponse | null>(null);
const error = ref<string | null>(null);
const sessionExpired = ref(false);
const fetchedAt = ref<number | null>(null);

let started = false;
let recentFetchedAt = 0;
let recentKey = '';

export function handleApiError(e: unknown): string | null {
  if (e instanceof SessionExpiredError) {
    sessionExpired.value = true;
    return null;
  }
  return e instanceof Error ? e.message : String(e);
}

async function refreshRecent(devices: Device[]) {
  const ids = devices.map((d) => d.id);
  const key = ids.join(',');
  if (ids.length === 0 || (key === recentKey && Date.now() - recentFetchedAt < RECENT_INTERVAL_MS)) return;

  const now = Math.floor(Date.now() / 1000);
  recent.value = await api.series({
    deviceIds: ids,
    from: now - 86400,
    to: now + 60,
    metrics: ['temperature', 'humidity', 'pressure', 'co2'],
    resolution: '1m',
  });
  recentKey = key;
  recentFetchedAt = Date.now();
}

async function refresh() {
  if (sessionExpired.value) return;
  try {
    const response = await api.latest();
    latest.value = response;
    fetchedAt.value = Math.floor(Date.now() / 1000);
    error.value = null;
    await refreshRecent(response.devices);
  } catch (e) {
    error.value = handleApiError(e);
  }
}

function start() {
  if (started) return;
  started = true;
  refresh();
  setInterval(() => {
    if (document.visibilityState === 'visible') refresh();
  }, LATEST_INTERVAL_MS);
  // 裏に回っていた画面が戻ったら、すぐに最新にする
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
}

export interface RecentSeries {
  ts: number[];
  temperature: (number | null)[];
  humidity: (number | null)[];
  pressure: (number | null)[];
  co2: (number | null)[];
}

export function useObservations() {
  start();

  const shownDevices = computed(() => (latest.value?.devices ?? []).filter((d) => !d.hidden));
  const recentByDevice = computed(() => {
    const map = new Map<number, RecentSeries>();
    for (const s of recent.value?.series ?? []) {
      map.set(s.deviceId, {
        ts: s.ts,
        temperature: s.values.temperature?.avg ?? [],
        humidity: s.values.humidity?.avg ?? [],
        pressure: s.values.pressure?.avg ?? [],
        co2: s.values.co2?.avg ?? [],
      });
    }
    return map;
  });

  return { latest, shownDevices, recentByDevice, error, sessionExpired, fetchedAt, refresh };
}

// 設定を変えたあとに呼ぶ。直近の系列も取り直す
export function invalidateObservations() {
  recentKey = '';
  return refresh();
}

export function useSessionState() {
  return { sessionExpired };
}
