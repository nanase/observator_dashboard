<script setup lang="ts">
// 複数デバイスの推移を重ねるグラフ。集計済みの粒度では最小〜最大の帯と平均の線で描く
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { formatDate, formatNumber, formatTime, jst } from '../lib/format';

export interface ChartPoint {
  t: number;
  mean: number;
  lo?: number;
  hi?: number;
}

export interface ChartSeries {
  id: number;
  name: string;
  color: string;
  points: ChartPoint[];
}

const props = defineProps<{
  series: ChartSeries[];
  from: number;
  to: number;
  step: number;
  band: boolean;
  unit: string;
  digits: number;
  label: string;
  range?: { min: number | null; max: number | null } | null;
}>();

const root = ref<HTMLElement | null>(null);
const width = ref(720);
let observer: ResizeObserver | undefined;
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    width.value = Math.max(280, Math.round(entry.contentRect.width));
  });
  if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => observer?.disconnect());

const height = computed(() => (width.value < 560 ? 260 : 340));
const showLabels = computed(() => width.value >= 560 && props.series.length <= 4);
const pad = computed(() => ({ l: 44, r: showLabels.value ? 88 : 10, t: 10, b: 26 }));
const plotW = computed(() => width.value - pad.value.l - pad.value.r);
const plotH = computed(() => height.value - pad.value.t - pad.value.b);

function niceTicks(a: number, b: number, n: number) {
  if (a === b) {
    a -= 1;
    b += 1;
  }
  const raw = (b - a) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
  const lo = Math.floor(a / step) * step;
  const hi = Math.ceil(b / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
  return { lo, hi, step, ticks };
}

const yScale = computed(() => {
  let min = Infinity;
  let max = -Infinity;
  for (const s of props.series) {
    for (const p of s.points) {
      min = Math.min(min, props.band && p.lo !== undefined ? p.lo : p.mean);
      max = Math.max(max, props.band && p.hi !== undefined ? p.hi : p.mean);
    }
  }
  if (props.range?.min != null) min = Math.min(min, props.range.min);
  if (props.range?.max != null) max = Math.max(max, props.range.max);
  if (!Number.isFinite(min)) return niceTicks(0, 1, 4);
  return niceTicks(min, max, height.value < 300 ? 4 : 5);
});
const tickDigits = computed(() => (yScale.value.step < 1 ? (yScale.value.step < 0.1 ? 2 : 1) : 0));

const X = (t: number) => pad.value.l + ((t - props.from) / (props.to - props.from)) * plotW.value;
const Y = (v: number) => pad.value.t + (1 - (v - yScale.value.lo) / (yScale.value.hi - yScale.value.lo)) * plotH.value;

const xTicks = computed(() => {
  const span = props.to - props.from;
  const dayStart = (t: number) => Math.floor((t + 9 * 3600) / 86400) * 86400 - 9 * 3600;
  const out: { t: number; label: string }[] = [];
  if (span <= 2 * 86400) {
    for (let t = dayStart(props.from); t <= props.to; t += 3 * 3600) {
      if (t < props.from) continue;
      const p = jst(t);
      out.push({ t, label: p.hour === 0 ? formatDate(t) : `${p.hour}時` });
    }
  } else if (span <= 16 * 86400) {
    for (let t = dayStart(props.from) + 86400; t <= props.to; t += 86400)
      out.push({ t, label: formatDate(t, plotW.value / (span / 86400) >= 64) });
  } else if (span <= 100 * 86400) {
    for (let t = dayStart(props.to); t >= props.from; t -= 7 * 86400) out.unshift({ t, label: formatDate(t) });
  } else {
    let { year, month } = jst(props.from);
    for (;;) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      const t = Date.UTC(year, month - 1, 1) / 1000 - 9 * 3600;
      if (t > props.to) break;
      out.push({ t, label: month === 1 ? `${year}年1月` : `${month}月` });
    }
  }
  const per = out.length > 1 ? plotW.value / out.length : plotW.value;
  const every = Math.max(1, Math.ceil(58 / per));
  return out.filter((_, i) => (out.length - 1 - i) % every === 0);
});

// 間隔が空いたところ（欠測）で線と帯を切る
function segments(points: ChartPoint[]): ChartPoint[][] {
  const out: ChartPoint[][] = [];
  let current: ChartPoint[] = [];
  const gap = Math.max(props.step * 2.5, 300);
  for (const p of points) {
    if (current.length && p.t - current[current.length - 1].t > gap) {
      out.push(current);
      current = [];
    }
    current.push(p);
  }
  if (current.length) out.push(current);
  return out;
}

const paths = computed(() =>
  props.series.map((s) => {
    const segs = segments(s.points);
    const line = segs.map((g) => 'M' + g.map((p) => `${X(p.t).toFixed(1)} ${Y(p.mean).toFixed(1)}`).join('L')).join('');
    const band = props.band
      ? segs
          .filter((g) => g.length > 1)
          .map(
            (g) =>
              'M' +
              g.map((p) => `${X(p.t).toFixed(1)} ${Y(p.hi ?? p.mean).toFixed(1)}`).join('L') +
              'L' +
              g
                .slice()
                .reverse()
                .map((p) => `${X(p.t).toFixed(1)} ${Y(p.lo ?? p.mean).toFixed(1)}`)
                .join('L') +
              'Z',
          )
          .join('')
      : '';
    const last = s.points[s.points.length - 1];
    return { s, line, band, end: last ? { x: X(last.t), y: Y(last.mean), v: last.mean } : null };
  }),
);

const endLabels = computed(() => {
  const labels = paths.value
    .filter((p) => p.end)
    .map((p) => ({ s: p.s, x: p.end!.x, y: p.end!.y, ly: p.end!.y, v: p.end!.v }))
    .sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < labels.length; i++) labels[i].ly = Math.max(labels[i].ly, labels[i - 1].ly + 15);
  const over = labels.length ? labels[labels.length - 1].ly - (pad.value.t + plotH.value) : 0;
  if (over > 0) labels.forEach((l) => (l.ly -= over));
  return labels;
});

const rangeBand = computed(() => {
  if (!props.range || (props.range.min == null && props.range.max == null)) return null;
  const top = props.range.max == null ? pad.value.t : Y(props.range.max);
  const bottom = props.range.min == null ? pad.value.t + plotH.value : Y(props.range.min);
  return { top, height: Math.max(0, bottom - top) };
});

// ツールチップ
const timeline = computed(() => {
  const set = new Set<number>();
  for (const s of props.series) for (const p of s.points) set.add(p.t);
  return [...set].sort((a, b) => a - b);
});
const cursor = ref<number | null>(null);

function nearestIndex(t: number): number {
  const xs = timeline.value;
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < t) lo = mid;
    else hi = mid;
  }
  return t - xs[lo] < xs[hi] - t ? lo : hi;
}

const tooltip = computed(() => {
  if (cursor.value === null || timeline.value.length === 0) return null;
  const t = timeline.value[cursor.value];
  const rows = props.series.map((s) => {
    let best: ChartPoint | null = null;
    for (const p of s.points)
      if (Math.abs(p.t - t) <= props.step / 2 + 1 && (!best || Math.abs(p.t - t) < Math.abs(best.t - t))) best = p;
    return { s, p: best };
  });
  const x = X(t);
  return { t, x, rows, left: x + 14 + 220 > width.value ? Math.max(0, x - 14 - 220) : x + 14 };
});

function tooltipTime(t: number): string {
  if (props.step >= 86400) {
    const p = jst(t);
    return `${p.year}年${p.month}月${p.day}日(${p.weekday})`;
  }
  const start = t - props.step / 2;
  return props.step > 60
    ? `${formatDate(start, true)} ${formatTime(start)}〜${formatTime(start + props.step)}`
    : `${formatDate(t, true)} ${formatTime(t)}`;
}

function onPointerMove(e: PointerEvent) {
  if (!timeline.value.length) return;
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * width.value;
  const t = props.from + ((px - pad.value.l) / plotW.value) * (props.to - props.from);
  cursor.value = nearestIndex(t);
}
function onKeyDown(e: KeyboardEvent) {
  const n = timeline.value.length;
  if (!n) return;
  const step = e.shiftKey ? 10 : 1;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const current = cursor.value ?? n - 1;
    cursor.value = Math.min(n - 1, Math.max(0, current + (e.key === 'ArrowLeft' ? -step : step)));
  } else if (e.key === 'Escape') {
    cursor.value = null;
  }
}
</script>

<template>
  <div ref="root" class="chart">
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      :height="height"
      role="img"
      tabindex="0"
      :aria-label="`${label}。左右キーで時刻を移動できます`"
      @pointermove="onPointerMove"
      @pointerleave="cursor = null"
      @focus="cursor = cursor ?? timeline.length - 1"
      @blur="cursor = null"
      @keydown="onKeyDown"
    >
      <rect v-if="rangeBand" :x="pad.l" :y="rangeBand.top" :width="plotW" :height="rangeBand.height" class="range" />
      <template v-for="v in yScale.ticks" :key="`y${v}`">
        <line
          :class="v === yScale.lo ? 'axis' : 'grid'"
          :x1="pad.l"
          :x2="pad.l + plotW"
          :y1="Math.round(Y(v)) + 0.5"
          :y2="Math.round(Y(v)) + 0.5"
        />
        <text class="tick" :x="pad.l - 8" :y="Y(v) + 3.5" text-anchor="end">{{ formatNumber(v, tickDigits) }}</text>
      </template>
      <template v-for="tk in xTicks" :key="`x${tk.t}`">
        <line
          class="grid"
          :x1="Math.round(X(tk.t)) + 0.5"
          :x2="Math.round(X(tk.t)) + 0.5"
          :y1="pad.t + plotH"
          :y2="pad.t + plotH + 4"
        />
        <text class="tick" :x="X(tk.t)" :y="height - 6" text-anchor="middle">{{ tk.label }}</text>
      </template>
      <path
        v-for="p in paths"
        v-show="band"
        :key="`b${p.s.id}`"
        :d="p.band"
        class="band"
        :style="{ fill: p.s.color }"
      />
      <path v-for="p in paths" :key="`l${p.s.id}`" :d="p.line" class="line" :style="{ stroke: p.s.color }" />
      <template v-for="p in paths" :key="`e${p.s.id}`">
        <circle v-if="p.end" class="end" r="4" :cx="p.end.x" :cy="p.end.y" :style="{ fill: p.s.color }" />
      </template>
      <template v-if="showLabels">
        <g v-for="l in endLabels" :key="`n${l.s.id}`">
          <path class="leader" :d="`M${l.x + 5} ${l.y}L${pad.l + plotW + 8} ${l.ly}`" />
          <text class="elabel" :x="pad.l + plotW + 10" :y="l.ly + 4">
            {{ l.s.name }}{{ band ? '' : ' ' + formatNumber(l.v, digits) }}
          </text>
        </g>
      </template>
      <g v-if="tooltip">
        <line class="cross" :x1="tooltip.x" :x2="tooltip.x" :y1="pad.t" :y2="pad.t + plotH" />
        <template v-for="row in tooltip.rows" :key="`h${row.s.id}`">
          <circle v-if="row.p" class="end" r="4" :cx="tooltip.x" :cy="Y(row.p.mean)" :style="{ fill: row.s.color }" />
        </template>
      </g>
    </svg>
    <div v-if="tooltip" class="tip" :style="{ left: `${tooltip.left}px`, top: `${pad.t}px` }">
      <div class="when">{{ tooltipTime(tooltip.t) }}</div>
      <div v-for="row in tooltip.rows" :key="row.s.id" class="row">
        <i :style="{ background: row.s.color }"></i>
        <b>{{ row.p ? formatNumber(row.p.mean, digits) : '欠測' }}</b>
        <span class="nm">{{ row.s.name }}</span>
        <span v-if="band && row.p" class="rg"
          >{{ formatNumber(row.p.lo, digits) }}〜{{ formatNumber(row.p.hi, digits) }}</span
        >
      </div>
      <div v-if="band" class="when">平均（最小〜最大）</div>
    </div>
  </div>
</template>

<style scoped>
.chart {
  position: relative;
  min-width: 0;
}
svg {
  display: block;
  width: 100%;
  overflow: visible;
  touch-action: pan-y;
}
.grid {
  stroke: var(--hairline);
  stroke-width: 1;
}
.axis {
  stroke: var(--outline-variant);
  stroke-width: 1;
}
.tick {
  fill: var(--muted);
  font-size: 11px;
}
.range {
  fill: var(--range-wash);
}
.band {
  stroke: none;
  fill-opacity: var(--band-op);
}
.line {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.end {
  stroke: var(--card);
  stroke-width: 2;
}
.leader {
  stroke: var(--outline-variant);
  stroke-width: 1;
  fill: none;
}
.elabel {
  fill: var(--on-surface-variant);
  font-size: 12px;
}
.cross {
  stroke: var(--outline);
  stroke-width: 1;
}
.tip {
  position: absolute;
  z-index: 5;
  pointer-events: none;
  width: 220px;
  background: var(--tooltip-bg);
  color: var(--tooltip-fg);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.55;
  box-shadow: var(--shadow-high);
}
.when {
  color: var(--tooltip-muted);
}
.row {
  display: grid;
  grid-template-columns: 12px auto 1fr;
  align-items: baseline;
  gap: 0 8px;
}
.row i {
  width: 12px;
  height: 2px;
  border-radius: 1px;
  align-self: center;
}
.row b {
  font-weight: 500;
  font-size: 13px;
}
.row .nm {
  color: var(--tooltip-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row .rg {
  grid-column: 2 / -1;
  color: var(--tooltip-muted);
  font-size: 11px;
  margin-top: -3px;
}
</style>
