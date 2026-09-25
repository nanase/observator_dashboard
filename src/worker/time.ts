const JST_OFFSET = 9 * 3600;

export const MINUTE = 60;
export const HOUR = 3600;
export const DAY = 86400;

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function floorTo(ts: number, step: number): number {
  return Math.floor(ts / step) * step;
}

// JST の 0 時を UNIX 秒で返す
export function floorToJstDay(ts: number): number {
  return floorTo(ts + JST_OFFSET, DAY) - JST_OFFSET;
}
