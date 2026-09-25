<script setup lang="ts">
// PC の小窓やスマホのホーム画面から開く、温度と湿度だけの表示
import { computed } from 'vue';
import { seaLevelPressure } from '../../shared/derived';
import ReceptionStatus from '../components/ReceptionStatus.vue';
import { useNow } from '../composables/useNow';
import { useObservations } from '../composables/useObservations';
import { formatAgo, formatNumber, formatTime } from '../lib/format';
import { deviceIcon, icons } from '../lib/icons';
import { co2Level, isCentral, STALE_SECONDS, temperatureRangeState } from '../lib/status';

const { shownDevices, fetchedAt } = useObservations();
const now = useNow();

const rows = computed(() =>
  shownDevices.value.map((d) => {
    const r = d.lastReading;
    const central = isCentral(d.kind);
    const range = temperatureRangeState(r?.temperature, d.temperatureMin, d.temperatureMax);
    const p = r?.pressure ?? null;
    const t = r?.temperature ?? null;
    return {
      device: d,
      name: d.name ?? d.address,
      icon: deviceIcon(d.icon, central),
      central,
      stale: now.value - d.lastSeenAt > STALE_SECONDS,
      out: range === 'above' || range === 'below',
      temperature: t,
      humidity: r?.humidity ?? null,
      co2: r?.co2 ?? null,
      co2Warn: r?.co2 != null && co2Level(r.co2).level !== 'good',
      pressure:
        p === null
          ? null
          : d.altitudeM !== null && t !== null
            ? { label: '海面', value: seaLevelPressure(p, t, d.altitudeM) }
            : { label: '現地', value: p },
    };
  }),
);
</script>

<template>
  <div class="mini">
    <header class="top">
      <b>Observator</b>
      <span class="u">
        <component :is="icons.update" />{{ formatTime(now) }}
        <template v-if="fetchedAt">・{{ formatAgo(now - fetchedAt) }}</template>
      </span>
      <RouterLink to="/" class="icon-btn" aria-label="ダッシュボードを開く"
        ><component :is="icons.dashboard"
      /></RouterLink>
    </header>
    <ul class="list">
      <li v-for="row in rows" :key="row.device.id" class="row" :class="{ stale: row.stale }">
        <span class="nm">
          <component :is="row.icon" class="dim" /><span class="n dim">{{ row.name }}</span>
          <ReceptionStatus :last-seen-at="row.device.lastSeenAt" variant="icon" />
        </span>
        <span class="t dim" :class="{ out: row.out }">{{ formatNumber(row.temperature, 1) }}<small>℃</small></span>
        <span class="h dim">{{ formatNumber(row.humidity, 0) }}<small>%</small></span>
        <div v-if="row.central && (row.co2 !== null || row.pressure)" class="extra dim">
          <span v-if="row.co2 !== null" :class="{ w: row.co2Warn }" title="CO2">
            <component :is="icons.co2" /><b>{{ formatNumber(row.co2, 0) }}</b
            >ppm
          </span>
          <span v-if="row.pressure" :title="`${row.pressure.label}気圧`">
            <component :is="icons.speed" /><b>{{ formatNumber(row.pressure.value, 1) }}</b
            >hPa
          </span>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.mini {
  max-width: 560px;
  margin: 0 auto;
  min-height: 100vh;
  background: var(--surface);
}
.top {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 4px 20px;
  font-size: 12px;
  color: var(--on-surface-variant);
}
.top b {
  font-weight: 500;
  color: var(--on-surface);
  font-size: 14px;
}
.top .u {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.top .u svg {
  font-size: 16px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0 8px 12px;
}
.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: baseline;
  gap: 4px 12px;
  padding: 12px;
}
.row + .row {
  border-top: 1px solid var(--hairline);
}
.nm {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 500;
  align-self: center;
  min-width: 0;
}
.nm > svg {
  font-size: 20px;
  color: var(--on-surface-variant);
}
.nm .n {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.t {
  font-size: 38px;
  line-height: 1;
  letter-spacing: -0.5px;
}
.t.out {
  color: var(--warn);
}
.t small,
.h small {
  font-size: 15px;
  color: var(--on-surface-variant);
  margin-left: 1px;
  letter-spacing: 0;
}
.h {
  font-size: 24px;
  line-height: 1;
  min-width: 3.1em;
  text-align: right;
}
.extra {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  font-size: 14px;
  color: var(--on-surface-variant);
  padding-left: 28px;
}
.extra span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.extra b {
  font-size: 20px;
  font-weight: 400;
  color: var(--on-surface);
}
.extra svg {
  font-size: 18px;
}
.extra .w {
  color: var(--on-warn-container);
  background: var(--warn-container);
  border-radius: 8px;
  padding: 0 8px 0 4px;
}
.extra .w b {
  color: inherit;
}
.row.stale .dim {
  opacity: 0.42;
}
</style>
