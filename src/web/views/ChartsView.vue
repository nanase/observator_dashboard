<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue';
import type { Device, SeriesResponse } from '../../shared/api';
import { absoluteHumidity, dewPoint, discomfortIndex, seaLevelPressure } from '../../shared/derived';
import type { Metric } from '../../shared/metrics';
import SeriesChart, { type ChartPoint, type ChartSeries } from '../components/SeriesChart.vue';
import { handleApiError, useObservations } from '../composables/useObservations';
import { api } from '../lib/api';
import { deviceColors } from '../lib/colors';
import { formatDate } from '../lib/format';
import { isCentral } from '../lib/status';

type RangeKey = '24h' | '7d' | '30d' | '1y' | 'custom';
type ChartMetric = 'temp' | 'hum' | 'dew' | 'ah' | 'di' | 'co2' | 'slp';

const RANGES: { key: RangeKey; label: string; seconds?: number }[] = [
  { key: '24h', label: '24 時間', seconds: 86400 },
  { key: '7d', label: '7 日', seconds: 7 * 86400 },
  { key: '30d', label: '30 日', seconds: 30 * 86400 },
  { key: '1y', label: '1 年', seconds: 365 * 86400 },
  { key: 'custom', label: '任意' },
];

const METRICS: Record<
  ChartMetric,
  { label: string; unit: string; digits: number; source: Metric[]; centralOnly?: boolean; derived?: boolean }
> = {
  temp: { label: '温度', unit: '℃', digits: 1, source: ['temperature'] },
  hum: { label: '湿度', unit: '%', digits: 0, source: ['humidity'] },
  dew: { label: '露点', unit: '℃', digits: 1, source: ['temperature', 'humidity'], derived: true },
  ah: { label: '絶対湿度', unit: 'g/m³', digits: 1, source: ['temperature', 'humidity'], derived: true },
  di: { label: '不快指数', unit: '', digits: 0, source: ['temperature', 'humidity'], derived: true },
  co2: { label: 'CO2', unit: 'ppm', digits: 0, source: ['co2'], centralOnly: true },
  slp: { label: '海面気圧', unit: 'hPa', digits: 1, source: ['pressure', 'temperature'], centralOnly: true },
};

const GRANULARITY: Record<string, string> = {
  '1m': '1 分ごとの値',
  '10m': '10 分ごとの最小〜最大（帯）と平均（線）',
  '1d': '1 日ごとの最小〜最大（帯）と平均（線）',
};

const STORAGE_KEY = 'observator.charts';
const { latest } = useObservations();

const today = () => {
  const p = new Date(Date.now() + 9 * 3600 * 1000);
  return p.toISOString().slice(0, 10);
};

const state = reactive({
  range: '24h' as RangeKey,
  metric: 'temp' as ChartMetric,
  selected: [] as number[],
  customFrom: '',
  customTo: today(),
});
try {
  Object.assign(state, JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'));
} catch {
  // 保存した条件が読めなければ既定のまま
}
watch(state, () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 保存できなくても表示には影響しない
  }
});

const devices = computed<Device[]>(() => latest.value?.devices ?? []);
const colors = computed(() => deviceColors(devices.value));
const metric = computed(() => METRICS[state.metric]);

// 初回は先頭の 3 台を選ぶ
watch(
  devices,
  (list) => {
    const ids = new Set(list.map((d) => d.id));
    state.selected = state.selected.filter((id) => ids.has(id));
    if (state.selected.length === 0)
      state.selected = list
        .filter((d) => !d.hidden)
        .slice(0, 3)
        .map((d) => d.id);
  },
  { immediate: true },
);

const jstDate = (s: string) => Date.parse(`${s}T00:00:00+09:00`) / 1000;

const period = computed(() => {
  const now = Math.floor(Date.now() / 1000);
  if (state.range === 'custom') {
    const from = state.customFrom ? jstDate(state.customFrom) : now - 7 * 86400;
    const to = state.customTo ? jstDate(state.customTo) + 86400 : now;
    return { from: Math.min(from, to - 3600), to: Math.min(Math.max(from + 3600, to), now) };
  }
  const seconds = RANGES.find((r) => r.key === state.range)!.seconds!;
  return { from: now - seconds, to: now };
});

const targets = computed(() =>
  devices.value.filter((d) => state.selected.includes(d.id) && (!metric.value.centralOnly || isCentral(d.kind))),
);

const response = shallowRef<SeriesResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
let sequence = 0;

watch(
  () => [targets.value.map((d) => d.id).join(','), period.value.from, period.value.to, metric.value.source.join(',')],
  async () => {
    const ids = targets.value.map((d) => d.id);
    const current = ++sequence;
    if (ids.length === 0) {
      response.value = null;
      return;
    }
    loading.value = true;
    try {
      const result = await api.series({ deviceIds: ids, ...period.value, metrics: metric.value.source });
      if (current === sequence) {
        response.value = result;
        error.value = null;
      }
    } catch (e) {
      if (current === sequence) error.value = handleApiError(e);
    } finally {
      if (current === sequence) loading.value = false;
    }
  },
  { immediate: true },
);

const band = computed(() => response.value !== null && response.value.resolution !== '1m' && !metric.value.derived);
const usesLocalPressure = computed(() => state.metric === 'slp' && targets.value.some((d) => d.altitudeM === null));

const chartSeries = computed<ChartSeries[]>(() => {
  const r = response.value;
  if (!r) return [];
  const offset = r.resolution === '1m' ? 0 : r.step / 2;
  return r.series.flatMap((s) => {
    const device = devices.value.find((d) => d.id === s.deviceId);
    if (!device) return [];
    const v = s.values;
    const at = (m: Metric, k: 'avg' | 'min' | 'max', i: number) => v[m]?.[k]?.[i] ?? v[m]?.avg[i] ?? null;
    const points: ChartPoint[] = [];
    s.ts.forEach((ts, i) => {
      const t = ts + offset;
      const T = at('temperature', 'avg', i);
      const H = at('humidity', 'avg', i);
      switch (state.metric) {
        case 'temp':
        case 'hum':
        case 'co2': {
          const m: Metric = state.metric === 'temp' ? 'temperature' : state.metric === 'hum' ? 'humidity' : 'co2';
          const mean = at(m, 'avg', i);
          if (mean !== null) points.push({ t, mean, lo: at(m, 'min', i) ?? mean, hi: at(m, 'max', i) ?? mean });
          break;
        }
        case 'dew':
        case 'ah':
        case 'di': {
          if (T === null || H === null || H <= 0) break;
          const f = state.metric === 'dew' ? dewPoint : state.metric === 'ah' ? absoluteHumidity : discomfortIndex;
          points.push({ t, mean: f(T, H) });
          break;
        }
        case 'slp': {
          const p = at('pressure', 'avg', i);
          if (p === null) break;
          const convert = (x: number | null) => {
            const local = x ?? p;
            return device.altitudeM !== null && T !== null ? seaLevelPressure(local, T, device.altitudeM) : local;
          };
          points.push({
            t,
            mean: convert(p),
            lo: convert(at('pressure', 'min', i)),
            hi: convert(at('pressure', 'max', i)),
          });
          break;
        }
      }
    });
    return [
      { id: device.id, name: device.name ?? device.address, color: colors.value.get(device.id) ?? 'var(--s1)', points },
    ];
  });
});

const chartRange = computed(() => {
  if (state.metric !== 'temp' || targets.value.length !== 1) return null;
  const d = targets.value[0];
  return d.temperatureMin === null && d.temperatureMax === null
    ? null
    : { min: d.temperatureMin, max: d.temperatureMax };
});

const subtitle = computed(() => {
  const r = response.value;
  const { from, to } = period.value;
  const span = `${formatDate(from)} 〜 ${formatDate(to)}`;
  if (!r) return span;
  return `${span} · ${metric.value.derived ? GRANULARITY[r.resolution].replace(/最小〜最大（帯）と/, '') + '（平均から計算）' : GRANULARITY[r.resolution]}`;
});

function toggle(id: number) {
  state.selected = state.selected.includes(id) ? state.selected.filter((x) => x !== id) : [...state.selected, id];
}
</script>

<template>
  <section class="charts">
    <div class="filters" role="group" aria-label="グラフの条件">
      <div class="fg">
        <span class="fl">期間</span>
        <div class="seg" role="group" aria-label="期間">
          <button
            v-for="r in RANGES"
            :key="r.key"
            type="button"
            :aria-pressed="state.range === r.key"
            @click="state.range = r.key"
          >
            {{ r.label }}
          </button>
        </div>
        <span v-if="state.range === 'custom'" class="custom">
          <label
            ><span class="sr">開始日</span><input v-model="state.customFrom" type="date" :max="state.customTo"
          /></label>
          <span>〜</span>
          <label><span class="sr">終了日</span><input v-model="state.customTo" type="date" :max="today()" /></label>
        </span>
      </div>
      <div class="fg">
        <label class="fl" for="metric">指標</label>
        <select id="metric" v-model="state.metric" class="sel">
          <option v-for="(m, key) in METRICS" :key="key" :value="key">{{ m.label }}</option>
        </select>
      </div>
      <div class="fg">
        <span class="fl">デバイス</span>
        <div class="chips" role="group" aria-label="表示するデバイス">
          <button
            v-for="d in devices"
            :key="d.id"
            type="button"
            class="dchip"
            :class="{ na: metric.centralOnly && !isCentral(d.kind) }"
            :aria-pressed="state.selected.includes(d.id)"
            :style="{ '--c': colors.get(d.id) }"
            :title="metric.centralOnly && !isCentral(d.kind) ? 'この指標は測っていません' : undefined"
            @click="toggle(d.id)"
          >
            <span class="key"></span>{{ d.name ?? d.address }}
          </button>
        </div>
      </div>
    </div>

    <div class="panel">
      <h2 class="title">
        {{ usesLocalPressure ? '気圧' : metric.label }}<span v-if="metric.unit" class="unit">{{ metric.unit }}</span>
      </h2>
      <p class="sub">{{ subtitle }}</p>
      <ul class="legend">
        <li v-for="s in chartSeries" :key="s.id" :style="{ '--c': s.color }"><span class="key"></span>{{ s.name }}</li>
        <li v-if="band && chartSeries.length"><span class="bandkey"></span>帯 = 最小〜最大、線 = 平均</li>
        <li v-if="chartRange"><span class="rangekey"></span>適正範囲</li>
      </ul>
      <p v-if="error" class="message">グラフを読み込めませんでした（{{ error }}）</p>
      <p v-else-if="targets.length === 0" class="message">
        {{
          metric.centralOnly
            ? 'この指標を測っているのはセントラルだけです。セントラルを選んでください。'
            : '表示するデバイスを選んでください。'
        }}
      </p>
      <p v-else-if="!loading && chartSeries.every((s) => s.points.length === 0)" class="message">
        この期間のデータはありません。
      </p>
      <SeriesChart
        v-else-if="response"
        :series="chartSeries"
        :from="period.from"
        :to="period.to"
        :step="response.step"
        :band="band"
        :unit="metric.unit"
        :digits="metric.digits"
        :label="`${metric.label}の推移`"
        :range="chartRange"
        :class="{ loading }"
      />
      <p class="note">
        <template v-if="metric.derived">露点・絶対湿度・不快指数は、温度と湿度の平均から計算した近似値です。</template>
        <template v-if="usesLocalPressure">標高が未設定のデバイスは現地気圧で描いています。</template>
        <template v-if="response?.resolution === '1d'">1 日ごとの集計は前日までです。</template>
      </p>
    </div>
  </section>
</template>

<style scoped>
.charts {
  display: grid;
  gap: 16px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  align-items: center;
}
.fg {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}
.fl {
  font-size: 12px;
  color: var(--on-surface-variant);
}
.seg {
  display: inline-flex;
  flex-wrap: wrap;
  border: 1px solid var(--outline);
  border-radius: 20px;
  overflow: hidden;
}
.seg button {
  min-height: 36px;
  padding: 0 14px;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}
.seg button + button {
  border-left: 1px solid var(--outline);
}
.seg button:hover {
  background: var(--state-hover);
}
.seg button[aria-pressed='true'] {
  background: var(--secondary-container);
  color: var(--on-secondary-container);
}
.custom {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.custom input,
.sel {
  min-height: 36px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--outline);
  background: var(--card);
  color: var(--on-surface);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dchip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 12px 0 10px;
  border-radius: 8px;
  border: 1px solid var(--outline);
  background: transparent;
  color: var(--on-surface-variant);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.dchip:hover {
  background: var(--state-hover);
}
.dchip .key {
  width: 14px;
  height: 3px;
  border-radius: 2px;
  background: var(--outline-variant);
}
.dchip[aria-pressed='true'] {
  background: var(--secondary-container);
  color: var(--on-secondary-container);
  border-color: transparent;
}
.dchip[aria-pressed='true'] .key {
  background: var(--c);
}
.dchip.na {
  opacity: 0.45;
}
.title {
  font-size: 18px;
  font-weight: 500;
}
.title .unit {
  font-size: 14px;
  font-weight: 400;
  color: var(--on-surface-variant);
  margin-left: 6px;
}
.sub {
  font-size: 13px;
  color: var(--on-surface-variant);
  margin-top: 2px;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  list-style: none;
  padding: 0;
  margin: 10px 0 6px;
  font-size: 12px;
  color: var(--on-surface-variant);
}
.legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.legend .key {
  width: 16px;
  height: 2px;
  border-radius: 1px;
  background: var(--c);
}
.legend .bandkey {
  width: 16px;
  height: 10px;
  border-radius: 2px;
  background: var(--muted);
  opacity: 0.35;
}
.legend .rangekey {
  width: 16px;
  height: 10px;
  border-radius: 2px;
  background: var(--range-wash);
  box-shadow: inset 0 0 0 1px var(--range-line);
}
.message {
  padding: 48px 0;
  text-align: center;
  color: var(--on-surface-variant);
}
.note {
  font-size: 12px;
  color: var(--muted);
  margin-top: 8px;
}
.loading {
  opacity: 0.6;
  transition: opacity 0.2s;
}
</style>
