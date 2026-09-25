import { ref, watch } from 'vue';

// ダッシュボードのカードの 24 時間グラフに出す指標。全カードで共通にし、端末ごとに覚える
export type CardMetric = 'temperature' | 'humidity' | 'pressure' | 'co2';

export const CARD_METRICS: { key: CardMetric; label: string }[] = [
  { key: 'temperature', label: '温度' },
  { key: 'humidity', label: '湿度' },
  { key: 'pressure', label: '気圧' },
  { key: 'co2', label: 'CO2' },
];

const STORAGE_KEY = 'observator.cardMetric';

function load(): CardMetric {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return CARD_METRICS.some((m) => m.key === value) ? (value as CardMetric) : 'temperature';
  } catch {
    return 'temperature';
  }
}

const metric = ref<CardMetric>(load());
watch(metric, (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // 保存できなくても、この画面を開いている間は切り替わる
  }
});

export function useCardMetric() {
  return metric;
}
