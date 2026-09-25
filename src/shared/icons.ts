// デバイスに設定できるアイコン（Material Symbols の名前）。画面側はこの一覧だけを読み込む
export const DEVICE_ICONS = [
  'thermostat',
  'sensors',
  'weekend',
  'living',
  'bed',
  'bedroom-parent',
  'child-care',
  'desk',
  'chair',
  'kitchen',
  'bathtub',
  'shower',
  'ac-unit',
  'door-front',
  'garage',
  'home',
  'cottage',
  'park',
  'yard',
  'nest-eco-leaf',
] as const;

export type DeviceIcon = (typeof DEVICE_ICONS)[number];

export function isDeviceIcon(value: unknown): value is DeviceIcon {
  return typeof value === 'string' && (DEVICE_ICONS as readonly string[]).includes(value);
}
