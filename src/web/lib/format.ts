const JST_OFFSET_MS = 9 * 3600 * 1000;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export interface JstParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
}

export function jst(seconds: number): JstParts {
  const d = new Date(seconds * 1000 + JST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    weekday: WEEKDAYS[d.getUTCDay()],
  };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatTime(seconds: number, withSeconds = false): string {
  const p = jst(seconds);
  return `${p.hour}:${pad2(p.minute)}${withSeconds ? ':' + pad2(p.second) : ''}`;
}

export function formatDate(seconds: number, withWeekday = false): string {
  const p = jst(seconds);
  return `${p.month}/${p.day}${withWeekday ? `(${p.weekday})` : ''}`;
}

export function formatDateLong(seconds: number): string {
  const p = jst(seconds);
  return `${p.month}月${p.day}日(${p.weekday})`;
}

// JST の 0 時（UNIX 秒）
export function startOfJstDay(seconds: number): number {
  return Math.floor((seconds + 9 * 3600) / 86400) * 86400 - 9 * 3600;
}

export function formatAgo(ageSeconds: number): string {
  const s = Math.max(0, Math.floor(ageSeconds));
  if (s < 60) return `${s} 秒前`;
  if (s < 3600) return `${Math.floor(s / 60)} 分前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 時間前`;
  return `${Math.floor(s / 86400)} 日前`;
}

// 負号は U+2212
export function formatNumber(value: number | null | undefined, digits: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '―';
  const text = Math.abs(value).toFixed(digits);
  return (value < 0 && Number(text) !== 0 ? '−' : '') + text;
}
