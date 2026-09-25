// この時間を超えて受信がないデバイスは途絶とみなす
export const STALE_SECONDS = 300;
// ESP32 は 1 分ごとに送るので、2〜3 分の遅れは平常の範囲
const FRESH_SECONDS = 180;

export const CO2_CAUTION = 1000;
export const CO2_WARNING = 1500;
export const BATTERY_LOW = 20;

export type Freshness = 'ok' | 'warn' | 'bad';

export function freshness(ageSeconds: number): Freshness {
  if (ageSeconds <= FRESH_SECONDS) return 'ok';
  if (ageSeconds <= STALE_SECONDS) return 'warn';
  return 'bad';
}

export interface Co2Level {
  level: 'good' | 'caution' | 'warning';
  label: string;
  note: string;
}

export function co2Level(ppm: number): Co2Level {
  if (ppm > CO2_WARNING) return { level: 'warning', label: '警告', note: `${CO2_WARNING} ppm 超` };
  if (ppm > CO2_CAUTION) return { level: 'caution', label: '注意', note: `${CO2_CAUTION} ppm 超` };
  return { level: 'good', label: '良好', note: `${CO2_CAUTION} ppm 以下` };
}

export function isCentral(kind: string): boolean {
  return kind === 'ESP32-Central';
}

export function kindLabel(kind: string): string {
  if (isCentral(kind)) return 'セントラル';
  if (kind === 'W3400010') return '防水温湿度計';
  return kind;
}

export type RangeState = 'below' | 'above' | 'within';

// 適正範囲が設定されていなければ null
export function temperatureRangeState(
  temperature: number | null | undefined,
  min: number | null,
  max: number | null,
): RangeState | null {
  if (temperature === null || temperature === undefined || (min === null && max === null)) return null;
  if (min !== null && temperature < min) return 'below';
  if (max !== null && temperature > max) return 'above';
  return 'within';
}
