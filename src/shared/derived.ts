// 温度・湿度・気圧から求める指標。表示時に計算し、保存はしない

// Magnus の式の係数（水面上、-45〜60℃）
const MAGNUS_B = 17.62;
const MAGNUS_C = 243.12;

export function saturationVaporPressure(temperature: number): number {
  return 6.112 * Math.exp((MAGNUS_B * temperature) / (MAGNUS_C + temperature));
}

export function dewPoint(temperature: number, humidity: number): number {
  const gamma = Math.log(humidity / 100) + (MAGNUS_B * temperature) / (MAGNUS_C + temperature);
  return (MAGNUS_C * gamma) / (MAGNUS_B - gamma);
}

// g/m³
export function absoluteHumidity(temperature: number, humidity: number): number {
  return (216.7 * ((humidity / 100) * saturationVaporPressure(temperature))) / (273.15 + temperature);
}

export function discomfortIndex(temperature: number, humidity: number): number {
  return 0.81 * temperature + 0.01 * humidity * (0.99 * temperature - 14.3) + 46.3;
}

export function discomfortLabel(index: number): string {
  if (index < 55) return '寒い';
  if (index < 60) return '肌寒い';
  if (index < 65) return '何も感じない';
  if (index < 70) return '快い';
  if (index < 75) return '暑くない';
  if (index < 80) return 'やや暑い';
  if (index < 85) return '暑くて汗が出る';
  return '暑くてたまらない';
}

// 現地気圧と設置高度（m）から海面気圧を求める
export function seaLevelPressure(pressure: number, temperature: number, altitude: number): number {
  return pressure * Math.pow(1 - (0.0065 * altitude) / (temperature + 0.0065 * altitude + 273.15), -5.257);
}
