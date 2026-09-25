import { formatNumber } from './format';

export function formatTemperatureRange(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) return `${formatNumber(min, 1)}〜${formatNumber(max, 1)}℃`;
  if (min !== null) return `${formatNumber(min, 1)}℃ 以上`;
  if (max !== null) return `${formatNumber(max, 1)}℃ 以下`;
  return null;
}
