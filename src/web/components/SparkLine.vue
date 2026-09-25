<script setup lang="ts">
// カードの中の直近 24 時間の小さなグラフ
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { formatNumber, formatTime } from '../lib/format';

interface Point {
  t: number;
  v: number;
}

const props = defineProps<{
  title: string;
  ts: number[];
  values: (number | null)[];
  from: number;
  to: number;
  dayStart: number;
  color: string;
  unit: string;
  digits: number;
  markers?: { max: Point; min: Point } | null;
  threshold?: number | null;
  range?: { min: number | null; max: number | null } | null;
}>();

const HEIGHT = 88;
const TOP = 16;
const BOTTOM = 62;
const PAD_X = 5;
const GAP_SECONDS = 300;

const root = ref<HTMLElement | null>(null);
const width = ref(280);
const hover = ref<number | null>(null);
let observer: ResizeObserver | undefined;

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    width.value = Math.max(120, Math.round(entry.contentRect.width));
  });
  if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => observer?.disconnect());

const points = computed(() => {
  const out: Point[] = [];
  props.ts.forEach((t, i) => {
    const v = props.values[i];
    if (v !== null && v !== undefined) out.push({ t, v });
  });
  return out;
});

const domain = computed(() => {
  const values = points.value.map((p) => p.v);
  if (props.threshold != null) values.push(props.threshold);
  if (props.range?.min != null) values.push(props.range.min);
  if (props.range?.max != null) values.push(props.range.max);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < 0.5) {
    lo -= 0.25;
    hi += 0.25;
  }
  return { lo, hi };
});

const x = (t: number) => PAD_X + ((t - props.from) / (props.to - props.from)) * (width.value - 2 * PAD_X);
const y = (v: number) => BOTTOM - ((v - domain.value.lo) / (domain.value.hi - domain.value.lo)) * (BOTTOM - TOP);

// 受信の間隔が空いたところで線を切る
const segments = computed(() => {
  const out: Point[][] = [];
  let current: Point[] = [];
  for (const p of points.value) {
    if (current.length && p.t - current[current.length - 1].t > GAP_SECONDS) {
      out.push(current);
      current = [];
    }
    current.push(p);
  }
  if (current.length) out.push(current);
  return out;
});

const linePath = computed(() =>
  segments.value.map((s) => 'M' + s.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('L')).join(''),
);
const areaPath = computed(() =>
  segments.value
    .map(
      (s) =>
        `M${x(s[0].t).toFixed(1)},${BOTTOM}L` +
        s.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('L') +
        `L${x(s[s.length - 1].t).toFixed(1)},${BOTTOM}Z`,
    )
    .join(''),
);

const last = computed(() => points.value[points.value.length - 1] ?? null);
const trailingGap = computed(() => (last.value && props.to - last.value.t > GAP_SECONDS ? x(last.value.t) + 3 : null));

// 右端の「いま」と重なる時刻の目盛りは出さない
const LABEL_CLEARANCE = 30;
const hours = computed(() =>
  [0, 6, 12, 18]
    .map((h) => ({ h, t: props.dayStart + h * 3600 }))
    .filter(({ t }) => t >= props.from && t <= props.to && x(t) < width.value - LABEL_CLEARANCE),
);

// 日付が変わった直後は最高・最低が右端に寄るので、重なる数値ラベルは出さない
const markerLabels = computed(() => {
  const m = props.markers;
  if (!m) return null;
  const maxX = x(m.max.t);
  const minX = x(m.min.t);
  const clear = (px: number) => px < width.value - LABEL_CLEARANCE;
  return {
    max: clear(maxX) ? { x: maxX, y: y(m.max.v) - 8 } : null,
    min: clear(minX) && Math.abs(minX - maxX) > 24 ? { x: minX + 8, y: y(m.min.v) + 4 } : null,
  };
});

const rangeBand = computed(() => {
  if (!props.range || (props.range.min == null && props.range.max == null)) return null;
  const top = props.range.max == null ? TOP - 6 : y(props.range.max);
  const bottom = props.range.min == null ? BOTTOM : y(props.range.min);
  return { top, height: Math.max(0, bottom - top) };
});

const hovered = computed(() => (hover.value === null ? null : (points.value[hover.value] ?? null)));

function onPointerMove(e: PointerEvent) {
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
  const t = props.from + ((e.clientX - rect.left - PAD_X) / (rect.width - 2 * PAD_X)) * (props.to - props.from);
  let best = -1;
  let bestDistance = Infinity;
  points.value.forEach((p, i) => {
    const d = Math.abs(p.t - t);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  hover.value = best >= 0 && bestDistance < 900 ? best : null;
}
</script>

<template>
  <div ref="root" class="spark">
    <div class="cap">
      <span>{{ title }}・24 時間</span>
      <span v-if="hovered">{{ formatTime(hovered.t) }} {{ formatNumber(hovered.v, digits) }}{{ unit }}</span>
      <span v-else-if="points.length">
        {{ formatNumber(domain.lo, digits) }}〜{{ formatNumber(domain.hi, digits) }}{{ unit }}
      </span>
    </div>
    <svg
      :viewBox="`0 0 ${width} ${HEIGHT}`"
      :height="HEIGHT"
      role="img"
      :aria-label="`${title}の直近 24 時間の推移`"
      @pointermove="onPointerMove"
      @pointerleave="hover = null"
    >
      <template v-if="rangeBand">
        <rect x="0" :y="rangeBand.top" :width="width" :height="rangeBand.height" class="range" />
      </template>
      <template v-if="threshold != null">
        <rect x="0" :y="TOP - 6" :width="width" :height="Math.max(0, y(threshold) - TOP + 6)" class="over" />
        <line x1="0" :x2="width" :y1="y(threshold)" :y2="y(threshold)" class="threshold" />
        <text class="axis" :x="width - 2" :y="y(threshold) + 12" text-anchor="end">{{ threshold }}</text>
      </template>
      <line x1="0" :x2="width" :y1="BOTTOM + 0.5" :y2="BOTTOM + 0.5" class="baseline" />
      <template v-for="hour in hours" :key="hour.h">
        <line v-if="hour.h === 0" :x1="x(hour.t)" :x2="x(hour.t)" :y1="TOP - 8" :y2="BOTTOM" class="midnight" />
        <line :x1="x(hour.t)" :x2="x(hour.t)" :y1="BOTTOM" :y2="BOTTOM + 4" class="baseline" />
        <text class="axis" :x="x(hour.t)" :y="HEIGHT - 6" text-anchor="middle">{{ hour.h }}時</text>
      </template>
      <text class="axis" :x="width" :y="HEIGHT - 6" text-anchor="end">いま</text>
      <rect
        v-if="trailingGap !== null"
        :x="trailingGap"
        :y="TOP - 6"
        :width="Math.max(6, width - trailingGap)"
        :height="BOTTOM - TOP + 6"
        rx="2"
        class="gap"
      />
      <path :d="areaPath" class="area" :style="{ fill: color }" />
      <path :d="linePath" class="line" :style="{ stroke: color }" />
      <template v-if="markers">
        <circle :cx="x(markers.max.t)" :cy="y(markers.max.v)" r="4" class="marker" :style="{ fill: color }" />
        <text
          v-if="markerLabels?.max"
          class="label"
          :x="markerLabels.max.x"
          :y="markerLabels.max.y"
          text-anchor="middle"
        >
          {{ formatNumber(markers.max.v, digits) }}
        </text>
        <circle :cx="x(markers.min.t)" :cy="y(markers.min.v)" r="4" class="marker" :style="{ fill: color }" />
        <text v-if="markerLabels?.min" class="label" :x="markerLabels.min.x" :y="markerLabels.min.y">
          {{ formatNumber(markers.min.v, digits) }}
        </text>
      </template>
      <circle v-if="last" :cx="x(last.t)" :cy="y(last.v)" r="3.5" class="marker" :style="{ fill: color }" />
      <g v-if="hovered">
        <line :x1="x(hovered.t)" :x2="x(hovered.t)" :y1="TOP - 8" :y2="BOTTOM" class="cross" />
        <circle :cx="x(hovered.t)" :cy="y(hovered.v)" r="4" class="marker" :style="{ fill: color }" />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.spark {
  min-width: 0;
}
.cap {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--on-surface-variant);
  margin-bottom: 2px;
}
svg {
  display: block;
  width: 100%;
  overflow: visible;
  touch-action: pan-y;
}
.axis {
  fill: var(--muted);
  font-size: 11px;
}
.label {
  fill: var(--on-surface-variant);
  font-size: 11px;
  font-weight: 500;
}
.baseline {
  stroke: var(--outline-variant);
  stroke-width: 1;
}
.midnight {
  stroke: var(--hairline);
  stroke-width: 1;
}
.threshold {
  stroke: var(--warn);
  stroke-width: 1;
}
.over {
  fill: var(--warn-container);
  opacity: 0.55;
}
.range {
  fill: var(--range-wash);
}
.gap {
  fill: var(--gap-wash);
}
.area {
  opacity: var(--wash-op);
}
.line {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.marker {
  stroke: var(--card);
  stroke-width: 2;
}
.cross {
  stroke: var(--outline);
  stroke-width: 1;
}
</style>
