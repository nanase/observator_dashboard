import { describe, expect, it } from 'vitest';
import { absoluteHumidity, dewPoint, discomfortIndex, discomfortLabel, seaLevelPressure } from '../src/shared/derived';

describe('派生指標', () => {
  it('露点', () => {
    expect(dewPoint(25, 60)).toBeCloseTo(16.69, 2);
  });

  it('絶対湿度', () => {
    expect(absoluteHumidity(25, 60)).toBeCloseTo(13.78, 2);
  });

  it('不快指数と区分', () => {
    expect(discomfortIndex(25, 60)).toBeCloseTo(72.82, 2);
    expect(discomfortLabel(72.82)).toBe('暑くない');
    expect(discomfortLabel(54.9)).toBe('寒い');
    expect(discomfortLabel(85)).toBe('暑くてたまらない');
  });

  it('海面気圧', () => {
    expect(seaLevelPressure(968.2, 25.4, 380)).toBeCloseTo(1011.06, 1);
    expect(seaLevelPressure(1000, 20, 0)).toBe(1000);
  });
});
