<script setup lang="ts">
// PC の小窓やスマホのホーム画面から開く、温度と湿度を中心にした表示
import { computed } from 'vue';
import { seaLevelPressure } from '../../shared/derived';
import ReceptionStatus from '../components/ReceptionStatus.vue';
import { useNow } from '../composables/useNow';
import { useObservations } from '../composables/useObservations';
import { deviceColors } from '../lib/colors';
import { formatAgo, formatNumber, formatTime } from '../lib/format';
import { batteryIcon, deviceIcon, icons, signalIcon } from '../lib/icons';
import { BATTERY_LOW, co2Level, isCentral, STALE_SECONDS, temperatureRangeState } from '../lib/status';

const { latest, shownDevices, fetchedAt } = useObservations();
const now = useNow();
const colors = computed(() => deviceColors(latest.value?.devices ?? []));

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
      color: colors.value.get(d.id) ?? 'var(--s1)',
      central,
      stale: now.value - d.lastSeenAt > STALE_SECONDS,
      out: range === 'above' || range === 'below',
      temperature: t,
      humidity: r?.humidity ?? null,
      battery: r?.battery ?? null,
      rssi: r?.rssi ?? null,
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
      <span class="u">
        <component :is="icons.update" />{{ formatTime(now) }}
        <template v-if="fetchedAt">・{{ formatAgo(now - fetchedAt) }}</template>
      </span>
      <RouterLink to="/" class="icon-btn" aria-label="ダッシュボードを開く"
        ><component :is="icons.dashboard"
      /></RouterLink>
    </header>
    <ul class="list">
      <li
        v-for="row in rows"
        :key="row.device.id"
        class="row"
        :class="{ stale: row.stale }"
        :style="{ '--c': row.color }"
      >
        <span class="avatar dim"><component :is="row.icon" /></span>
        <div class="who">
          <span class="nm">
            <span class="n dim">{{ row.name }}</span>
            <span v-if="row.device.assetTag" class="tag dim">{{ row.device.assetTag }}</span>
            <ReceptionStatus :last-seen-at="row.device.lastSeenAt" variant="icon" />
          </span>
          <span class="sig dim">
            <span
              v-if="row.battery !== null"
              class="it"
              :class="{ warn: row.battery < BATTERY_LOW }"
              :title="`電池 ${row.battery}%`"
            >
              <component :is="icons[batteryIcon(row.battery)]" /><span class="sr">電池 </span>{{ row.battery }}%
            </span>
            <span v-if="row.rssi !== null" class="it" :title="row.central ? 'Wi-Fi の電波' : 'BLE の電波'">
              <component :is="icons[signalIcon(row.rssi, row.central)]" /><span class="sr">電波 </span
              >{{ formatNumber(row.rssi, 0) }}<small>dBm</small>
            </span>
          </span>
        </div>
        <span class="vals dim">
          <span class="t" :class="{ out: row.out }">{{ formatNumber(row.temperature, 1) }}<small>℃</small></span>
          <span class="h">{{ formatNumber(row.humidity, 0) }}<small>%</small></span>
        </span>
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
  justify-content: flex-end;
  gap: 8px;
  padding: 4px 8px 0 16px;
  font-size: 12px;
  color: var(--on-surface-variant);
}
.top .u {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.top .u svg {
  font-size: 16px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0 8px 8px;
}
.row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 2px 10px;
  padding: 8px 8px;
}
.row + .row {
  border-top: 1px solid var(--hairline);
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--c) 22%, var(--surface));
  color: color-mix(in srgb, var(--c) 70%, var(--on-surface));
  font-size: 19px;
}
.who {
  display: grid;
  min-width: 0;
  line-height: 1.3;
}
.nm {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
}
.nm .n {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nm .tag {
  flex: none;
  font-size: 11px;
  font-weight: 400;
  color: var(--muted);
}
.sig {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--on-surface-variant);
  white-space: nowrap;
}
.sig .it {
  display: inline-flex;
  align-items: center;
  gap: 1px;
}
.sig svg {
  font-size: 13px;
}
.sig small {
  font-size: 10px;
  margin-left: 1px;
}
.sig .it.warn {
  color: var(--on-warn-container);
  background: var(--warn-container);
  border-radius: 4px;
  padding: 0 4px 0 1px;
}
.vals {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.t {
  font-size: 28px;
  line-height: 1;
  letter-spacing: -0.5px;
}
.t.out {
  color: var(--warn);
}
.t small,
.h small {
  font-size: 13px;
  color: var(--on-surface-variant);
  margin-left: 1px;
  letter-spacing: 0;
}
.h {
  font-size: 20px;
  line-height: 1;
  min-width: 2.8em;
  text-align: right;
}
.extra {
  grid-column: 2 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  font-size: 12px;
  color: var(--on-surface-variant);
}
.extra span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.extra b {
  font-size: 17px;
  font-weight: 400;
  color: var(--on-surface);
}
.extra svg {
  font-size: 16px;
}
.extra .w {
  color: var(--on-warn-container);
  background: var(--warn-container);
  border-radius: 6px;
  padding: 0 6px 0 3px;
}
.extra .w b {
  color: inherit;
}
.row.stale .dim {
  opacity: 0.42;
}
</style>
