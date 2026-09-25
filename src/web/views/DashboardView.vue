<script setup lang="ts">
import { computed } from 'vue';
import DeviceCard from '../components/DeviceCard.vue';
import { CARD_METRICS, useCardMetric } from '../composables/useCardMetric';
import { useNow } from '../composables/useNow';
import { useObservations } from '../composables/useObservations';
import { deviceColors } from '../lib/colors';
import { formatNumber } from '../lib/format';
import { icons } from '../lib/icons';
import { BATTERY_LOW, co2Level, STALE_SECONDS, temperatureRangeState } from '../lib/status';

const { latest, shownDevices, recentByDevice } = useObservations();
const now = useNow();
const cardMetric = useCardMetric();

const colors = computed(() => deviceColors(latest.value?.devices ?? []));
const nameOf = (d: { name: string | null; address: string }) => d.name ?? d.address;

// 注意が要るものだけを上に並べる。受信の途絶はカードの経過時間から確かめる
const alerts = computed(() => {
  const out: { key: string; text: string; icon: keyof typeof icons }[] = [];
  for (const d of shownDevices.value) {
    const r = d.lastReading;
    if (!r || now.value - d.lastSeenAt > STALE_SECONDS) continue;
    if (r.co2 != null && co2Level(r.co2).level !== 'good') {
      out.push({
        key: `co2-${d.id}`,
        icon: 'co2',
        text: `${nameOf(d)}の CO2 ${r.co2} ppm（${co2Level(r.co2).label}）`,
      });
    }
    const range = temperatureRangeState(r.temperature, d.temperatureMin, d.temperatureMax);
    if (range === 'above' || range === 'below') {
      out.push({
        key: `range-${d.id}`,
        icon: 'thermometer',
        text: `${nameOf(d)}が適正範囲より${range === 'above' ? '高い' : '低い'}（${formatNumber(r.temperature, 1)}℃）`,
      });
    }
    if (r.battery != null && r.battery < BATTERY_LOW) {
      out.push({ key: `bat-${d.id}`, icon: 'battery-alert', text: `${nameOf(d)}の電池 ${r.battery}%` });
    }
  }
  return out;
});
</script>

<template>
  <div class="dashboard">
    <div class="toolbar">
      <div class="alerts">
        <RouterLink v-if="latest && latest.pendingCount > 0" to="/devices" class="chip warn">
          <component :is="icons['how-to-reg']" />承認待ちのデバイスが {{ latest.pendingCount }} 台あります
        </RouterLink>
        <span v-for="a in alerts" :key="a.key" class="chip warn"><component :is="icons[a.icon]" />{{ a.text }}</span>
      </div>
      <div v-if="shownDevices.length" class="metric">
        <span class="fl">グラフ</span>
        <div class="seg" role="group" aria-label="カードのグラフに出す指標">
          <button
            v-for="m in CARD_METRICS"
            :key="m.key"
            type="button"
            :aria-pressed="cardMetric === m.key"
            @click="cardMetric = m.key"
          >
            {{ m.label }}
          </button>
        </div>
      </div>
    </div>

    <p v-if="latest && shownDevices.length === 0" class="empty">
      表示するデバイスがありません。<RouterLink to="/devices">デバイス</RouterLink>の画面で承認してください。
    </p>

    <div class="cards">
      <DeviceCard
        v-for="d in shownDevices"
        :key="d.id"
        :device="d"
        :recent="recentByDevice.get(d.id)"
        :color="colors.get(d.id) ?? 'var(--s1)'"
        :metric="cardMetric"
      />
    </div>

    <div v-if="shownDevices.length" class="legend">
      <span><i class="dot"></i>3 分以内に受信</span>
      <span><i class="dot warn"></i>5 分以内</span>
      <span><i class="dot bad"></i>5 分以上（途絶）</span>
      <span>経過時間を押すと受信時刻が出ます。↑↓ は今日の最高と最低</span>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: grid;
  gap: 16px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}
.alerts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.metric {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}
.fl {
  font-size: 12px;
  color: var(--on-surface-variant);
}
.seg {
  display: inline-flex;
  border: 1px solid var(--outline);
  border-radius: 18px;
  overflow: hidden;
}
.seg button {
  min-height: 32px;
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
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 296px), 1fr));
  gap: 16px;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  color: var(--on-surface-variant);
  font-size: 12px;
}
.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.legend .dot {
  width: 8px;
  height: 8px;
}
.empty {
  color: var(--on-surface-variant);
}
</style>
