<script setup lang="ts">
// フェーズ 4 で本来の画面に置き換えるまでの、受信確認用の仮画面
import { onMounted, onUnmounted, ref } from 'vue';
import type { LatestResponse } from '../shared/api';

const latest = ref<LatestResponse | null>(null);
const error = ref<string | null>(null);
let timer: ReturnType<typeof setInterval> | undefined;

async function refresh() {
  try {
    const response = await fetch('/api/latest');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    latest.value = await response.json();
    error.value = null;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

function format(value: number | null | undefined, digits: number): string {
  return value === null || value === undefined ? '-' : value.toFixed(digits);
}

onMounted(() => {
  refresh();
  timer = setInterval(refresh, 30_000);
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <main>
    <h1>Observator</h1>
    <p v-if="error">取得に失敗しました: {{ error }}</p>
    <p v-if="latest && latest.pendingCount > 0">承認待ちのデバイスが {{ latest.pendingCount }} 台あります</p>
    <table v-if="latest">
      <thead>
        <tr>
          <th>名前</th>
          <th>温度</th>
          <th>湿度</th>
          <th>気圧</th>
          <th>CO2</th>
          <th>電池</th>
          <th>最終受信</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="device in latest.devices" :key="device.id">
          <td>{{ device.name ?? device.address }}</td>
          <td>{{ format(device.lastReading?.temperature, 1) }} ℃</td>
          <td>{{ format(device.lastReading?.humidity, 0) }} %</td>
          <td>{{ format(device.lastReading?.pressure, 1) }} hPa</td>
          <td>{{ format(device.lastReading?.co2, 0) }} ppm</td>
          <td>{{ format(device.lastReading?.battery, 0) }} %</td>
          <td>{{ formatTime(device.lastSeenAt) }}</td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<style>
:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
}

table {
  border-collapse: collapse;
}

th,
td {
  padding: 0.25rem 0.75rem;
  text-align: right;
}

td:first-child,
th:first-child {
  text-align: left;
}
</style>
