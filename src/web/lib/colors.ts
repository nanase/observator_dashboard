import type { Device } from '../../shared/api';

const PALETTE_SIZE = 6;

// デバイスの色は、承認済みデバイスの並び順で決める。画面をまたいで同じ色になる
export function deviceColors(devices: Device[]): Map<number, string> {
  return new Map(devices.map((d, i) => [d.id, `var(--s${(i % PALETTE_SIZE) + 1})`]));
}
