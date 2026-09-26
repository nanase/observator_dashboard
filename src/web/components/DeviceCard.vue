<script setup lang="ts">
import { computed } from 'vue';
import type { Device } from '../../shared/api';
import { absoluteHumidity, dewPoint, discomfortIndex, discomfortLabel, seaLevelPressure } from '../../shared/derived';
import type { CardMetric } from '../composables/useCardMetric';
import type { RecentSeries } from '../composables/useObservations';
import { useNow } from '../composables/useNow';
import { formatNumber, formatTime, startOfJstDay } from '../lib/format';
import { batteryIcon, deviceIcon, icons, signalIcon } from '../lib/icons';
import { formatTemperatureRange } from '../lib/range';
import {
  BATTERY_LOW,
  CO2_CAUTION,
  co2Level,
  isCentral,
  kindLabel,
  STALE_SECONDS,
  temperatureRangeState,
} from '../lib/status';
import ReceptionStatus from './ReceptionStatus.vue';
import SparkLine from './SparkLine.vue';

const props = defineProps<{ device: Device; recent?: RecentSeries; color: string; metric: CardMetric }>();

const now = useNow();
const central = computed(() => isCentral(props.device.kind));
const reading = computed(() => props.device.lastReading);
const stale = computed(() => now.value - props.device.lastSeenAt > STALE_SECONDS);
const name = computed(() => props.device.name ?? props.device.address);
const icon = computed(() => deviceIcon(props.device.icon, central.value));

const temperature = computed(() => reading.value?.temperature ?? null);
const humidity = computed(() => reading.value?.humidity ?? null);
const derived = computed(() => {
  const t = temperature.value;
  const h = humidity.value;
  if (t === null || h === null || h <= 0) return null;
  const di = discomfortIndex(t, h);
  return { dew: dewPoint(t, h), absolute: absoluteHumidity(t, h), di, diLabel: discomfortLabel(di) };
});

const rangeText = computed(() => formatTemperatureRange(props.device.temperatureMin, props.device.temperatureMax));
const rangeState = computed(() =>
  temperatureRangeState(temperature.value, props.device.temperatureMin, props.device.temperatureMax),
);

const co2 = computed(() => reading.value?.co2 ?? null);
const co2State = computed(() => (co2.value === null ? null : co2Level(co2.value)));
const pressure = computed(() => {
  const p = reading.value?.pressure ?? null;
  if (p === null) return null;
  const t = temperature.value;
  const altitude = props.device.altitudeM;
  return {
    local: p,
    seaLevel: altitude !== null && t !== null ? seaLevelPressure(p, t, altitude) : null,
    altitude,
  };
});

const battery = computed(() => reading.value?.battery ?? null);
const rssi = computed(() => reading.value?.rssi ?? null);

const window24h = computed(() => ({ from: now.value - 86400, to: now.value, dayStart: startOfJstDay(now.value) }));

// 今日（0 時から）の最高・最低と、その時刻
const today = computed(() => {
  const s = props.recent;
  if (!s) return null;
  let max: { t: number; v: number } | null = null;
  let min: { t: number; v: number } | null = null;
  s.ts.forEach((t, i) => {
    const v = s.temperature[i];
    if (t < window24h.value.dayStart || v === null || v === undefined) return;
    if (!max || v > max.v) max = { t, v };
    if (!min || v < min.v) min = { t, v };
  });
  return max && min ? { max: max as { t: number; v: number }, min: min as { t: number; v: number } } : null;
});

interface SparkConfig {
  title: string;
  values: (number | null)[];
  unit: string;
  digits: number;
  markers?: { max: { t: number; v: number }; min: { t: number; v: number } } | null;
  range?: { min: number | null; max: number | null } | null;
  threshold?: number | null;
}

// 測っていない指標なら null
function sparkFor(metric: CardMetric): SparkConfig | null {
  const s = props.recent;
  const r = reading.value;
  if (!s || !r) return null;
  switch (metric) {
    case 'temperature':
      return {
        title: '温度',
        values: s.temperature,
        unit: '℃',
        digits: 1,
        markers: today.value,
        range: rangeText.value ? { min: props.device.temperatureMin, max: props.device.temperatureMax } : null,
      };
    case 'humidity':
      return r.humidity == null ? null : { title: '湿度', values: s.humidity, unit: '%', digits: 0 };
    case 'pressure': {
      if (r.pressure == null) return null;
      const altitude = props.device.altitudeM;
      if (altitude === null) return { title: '現地気圧', values: s.pressure, unit: ' hPa', digits: 1 };
      const values = s.pressure.map((p, i) =>
        p == null ? null : seaLevelPressure(p, s.temperature[i] ?? temperature.value ?? 15, altitude),
      );
      return { title: '海面気圧', values, unit: ' hPa', digits: 1 };
    }
    case 'co2':
      return r.co2 == null ? null : { title: 'CO2', values: s.co2, unit: ' ppm', digits: 0, threshold: CO2_CAUTION };
  }
}

// 選んだ指標を測っていなければ温度にする。セントラルは CO2（CO2 を選んだときは温度）も並べる
const sparks = computed(() => {
  const primary = sparkFor(props.metric) ?? sparkFor('temperature');
  if (!primary) return [];
  const list = [primary];
  if (central.value) {
    const second = sparkFor(props.metric === 'co2' ? 'temperature' : 'co2');
    if (second && second.title !== primary.title) list.push(second);
  }
  return list;
});
</script>

<template>
  <article class="card" :class="{ central, stale }" :style="{ '--c': color }" :aria-label="name">
    <div class="head">
      <span class="avatar"><component :is="icon" /></span>
      <div class="ttl">
        <h3>
          {{ name }}<span v-if="device.assetTag" class="asset-tag">{{ device.assetTag }}</span>
        </h3>
        <p class="sub">{{ kindLabel(device.kind) }}</p>
      </div>
      <div class="meta">
        <ReceptionStatus :last-seen-at="device.lastSeenAt" />
        <div class="signal">
          <span v-if="battery !== null" class="it" :class="{ warn: battery < BATTERY_LOW }" :title="`電池 ${battery}%`">
            <component :is="icons[batteryIcon(battery)]" /><span class="sr">電池 </span>{{ battery }}%
          </span>
          <span v-if="rssi !== null" class="it" :title="central ? 'Wi-Fi の電波' : 'BLE の電波'">
            <component :is="icons[signalIcon(rssi, central)]" /><span class="sr">電波 </span
            >{{ formatNumber(rssi, 0) }} dBm
          </span>
        </div>
      </div>
    </div>

    <div class="body">
      <div class="col">
        <div class="now dim">
          <div>
            <span class="lbl"
              >温度<span v-if="rangeText" class="range-text">適正 {{ rangeText }}</span></span
            >
            <div class="big-t" :class="{ out: rangeState === 'above' || rangeState === 'below' }">
              <span class="num">{{ formatNumber(temperature, 1) }}</span
              ><span class="unit">℃</span>
            </div>
          </div>
          <div class="hilo">
            <span title="今日の最高">
              <component :is="icons['arrow-upward']" /><span class="sr">今日の最高 </span>
              <b>{{ formatNumber(today?.max.v, 1) }}</b
              >℃<time v-if="today">{{ formatTime(today.max.t) }}</time>
            </span>
            <span title="今日の最低">
              <component :is="icons['arrow-downward']" /><span class="sr">今日の最低 </span>
              <b>{{ formatNumber(today?.min.v, 1) }}</b
              >℃<time v-if="today">{{ formatTime(today.min.t) }}</time>
            </span>
          </div>
          <div>
            <span class="lbl">湿度</span>
            <div class="big-h">
              <component :is="icons.humidity" /><span class="num">{{ formatNumber(humidity, 0) }}</span
              ><span class="unit">%</span>
            </div>
          </div>
        </div>
        <p v-if="rangeState === 'above' || rangeState === 'below'" class="out-note">
          <component :is="icons.warning" />適正範囲より{{ rangeState === 'above' ? '高い' : '低い' }}
        </p>

        <div v-if="central && (co2State || pressure)" class="tiles dim">
          <div v-if="co2 !== null && co2State" class="tile" :class="{ warn: co2State.level !== 'good' }">
            <div class="k"><component :is="icons.co2" />CO2</div>
            <div class="v">{{ formatNumber(co2, 0) }}<small>ppm</small></div>
            <div class="note">
              <span class="nw"
                ><component :is="icons.warning" v-if="co2State.level !== 'good'" />{{ co2State.label }}</span
              >
              <span class="nw">{{ co2State.note }}</span>
            </div>
          </div>
          <div v-if="pressure" class="tile">
            <template v-if="pressure.seaLevel !== null">
              <div class="k"><component :is="icons.speed" />海面気圧</div>
              <div class="v">{{ formatNumber(pressure.seaLevel, 1) }}<small>hPa</small></div>
              <div class="note">
                <span class="nw">現地 {{ formatNumber(pressure.local, 1) }} hPa</span>
                <span class="nw">標高 {{ formatNumber(pressure.altitude, 0) }} m</span>
              </div>
            </template>
            <template v-else>
              <div class="k"><component :is="icons.speed" />現地気圧</div>
              <div class="v">{{ formatNumber(pressure.local, 1) }}<small>hPa</small></div>
              <div class="note">標高を設定すると海面気圧を出します</div>
            </template>
          </div>
        </div>
      </div>

      <div class="col sparks dim">
        <SparkLine
          v-for="spark in sparks"
          :key="spark.title"
          :title="spark.title"
          :ts="recent!.ts"
          :values="spark.values"
          :from="window24h.from"
          :to="window24h.to"
          :day-start="window24h.dayStart"
          :color="color"
          :unit="spark.unit"
          :digits="spark.digits"
          :markers="spark.markers"
          :range="spark.range"
          :threshold="spark.threshold"
        />
      </div>
    </div>

    <div v-if="derived" class="derived dim">
      <div>
        <div class="k"><component :is="icons['dew-point']" />露点</div>
        <div class="v">{{ formatNumber(derived.dew, 1) }}<small>℃</small></div>
      </div>
      <div>
        <div class="k"><component :is="icons['water-drop']" />絶対湿度</div>
        <div class="v">{{ formatNumber(derived.absolute, 1) }}<small>g/m³</small></div>
      </div>
      <div>
        <div class="k"><component :is="icons.mood" />不快指数</div>
        <div class="v">
          {{ formatNumber(derived.di, 0) }}<span class="d">{{ derived.diLabel }}</span>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.card {
  background: var(--card);
  border-radius: 16px;
  box-shadow: var(--shadow);
  border: 1px solid var(--card-border);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.card.stale {
  background: var(--card-stale);
  box-shadow: none;
  border-color: var(--outline-variant);
}
.card.stale .dim {
  opacity: 0.5;
}
.head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex: none;
  background: color-mix(in srgb, var(--c) 18%, var(--card));
  font-size: 22px;
}
.meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.signal {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 2px 10px;
  font-size: 12px;
  color: var(--on-surface-variant);
  white-space: nowrap;
}
.signal .it {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.signal svg {
  font-size: 16px;
}
.signal .it.warn {
  color: var(--on-warn-container);
  background: var(--warn-container);
  border-radius: 6px;
  padding: 0 6px 0 2px;
}
.hilo {
  display: grid;
  line-height: 1.3;
  /* 見出しの分だけ下げ、温度の数値と横に並べる */
  margin-top: 22px;
  font-size: 12px;
  color: var(--on-surface-variant);
  white-space: nowrap;
}
.hilo > span {
  display: inline-flex;
  align-items: baseline;
}
.hilo svg {
  font-size: 14px;
  align-self: center;
  margin-right: 2px;
}
.hilo b {
  font-size: 15px;
  font-weight: 500;
  color: var(--on-surface);
  margin-right: 1px;
}
.hilo time {
  margin-left: 8px;
  color: var(--muted);
}
.derived .v .d {
  font-size: 11px;
  font-weight: 400;
  color: var(--muted);
  margin-left: 6px;
}
.ttl {
  min-width: 0;
  flex: 1;
}
.ttl h3 {
  font-size: 16px;
  font-weight: 500;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.asset-tag {
  font-size: 12px;
  font-weight: 400;
  color: var(--muted);
  margin-left: 8px;
}
.sub {
  font-size: 12px;
  color: var(--on-surface-variant);
}
.body,
.col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

/* 「温度」「湿度」の見出しを上端でそろえる */
.now {
  display: flex;
  align-items: flex-start;
  gap: 8px 20px;
  flex-wrap: wrap;
}
.lbl {
  display: flex;
  flex-wrap: wrap;
  gap: 0 8px;
  font-size: 12px;
  color: var(--on-surface-variant);
  margin-bottom: 4px;
  line-height: 1.3;
}
.range-text {
  color: var(--muted);
}
.big-t {
  display: flex;
  align-items: flex-start;
  line-height: 1;
}
.big-t .num {
  font-size: 44px;
  letter-spacing: -1px;
}
.big-t .unit {
  font-size: 18px;
  margin: 4px 0 0 2px;
  color: var(--on-surface-variant);
}
.big-t.out {
  color: var(--warn);
}
.big-h {
  display: flex;
  align-items: baseline;
  gap: 2px;
  line-height: 1;
  padding-bottom: 4px;
}
.big-h svg {
  font-size: 22px;
  color: var(--on-surface-variant);
  align-self: center;
  margin-right: 2px;
}
.big-h .num {
  font-size: 28px;
}
.big-h .unit {
  font-size: 16px;
  color: var(--on-surface-variant);
}
.out-note {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  margin-top: -6px;
  padding: 2px 8px 2px 4px;
  border-radius: 8px;
  background: var(--warn-container);
  color: var(--on-warn-container);
  font-size: 12px;
  font-weight: 500;
}
.out-note svg {
  font-size: 16px;
}

.tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.tile {
  background: var(--surface);
  border-radius: 12px;
  padding: 10px 12px;
  min-width: 0;
}
.tile .k {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--on-surface-variant);
}
.tile .k svg {
  font-size: 18px;
}
.tile .v {
  font-size: 24px;
  line-height: 1.25;
  margin-top: 2px;
  white-space: nowrap;
}
.tile .v small {
  font-size: 13px;
  color: var(--on-surface-variant);
  margin-left: 2px;
}
.tile .note {
  display: flex;
  flex-wrap: wrap;
  gap: 0 8px;
  font-size: 12px;
  color: var(--on-surface-variant);
}
.tile.warn {
  background: var(--warn-container);
}
.tile.warn .k,
.tile.warn .v,
.tile.warn .v small,
.tile.warn .note {
  color: var(--on-warn-container);
}
.nw {
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-weight: 500;
}

.derived {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid var(--hairline);
  padding-top: 10px;
}
.derived > div {
  padding: 0 8px;
  min-width: 0;
}
.derived > div + div {
  border-left: 1px solid var(--hairline);
}
.derived > div:first-child {
  padding-left: 0;
}
.derived .k {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--on-surface-variant);
  white-space: nowrap;
}
.derived .k svg {
  font-size: 16px;
}
.derived .v {
  font-size: 16px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.derived .v small {
  font-size: 12px;
  font-weight: 400;
  color: var(--on-surface-variant);
  margin-left: 1px;
}

@media (min-width: 720px) {
  .card.central {
    grid-column: span 2;
  }
  .card.central .body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 14px 24px;
  }
}
</style>
