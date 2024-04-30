export function convertRSSILevel(level: number): string {
  if (level >= -65) {
    return '-4';
  } else if (level >= -75) {
    return '-3';
  } else if (level >= -85) {
    return '-2';
  } else if (level >= -95) {
    return '-1';
  } else {
    return '-outline';
  }
}

export function convertBatteryLevel(level: number): string {
  const value = Math.round(level / 10) * 10;

  if (value === 100) {
    return '';
  } else if (value === 0) {
    return '-outline';
  } else {
    return `-${value}`;
  }
}

export function fill(text: string, filler: string): string {
  return text.length === 0 ? filler : text;
}
