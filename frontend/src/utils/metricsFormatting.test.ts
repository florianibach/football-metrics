import {
  convertSpeedFromMetersPerSecond,
  convertSpeedToMetersPerSecond,
  convertSpeedToUnitValue,
  formatBandTriplet,
  formatBpmDrop,
  formatDistanceMetersOnly,
  formatHeartRateAverage,
  formatNumber,
  formatSignedNumber,
  formatSpeed
} from './metricsFormatting';

describe('metricsFormatting', () => {
  it('formats heart rate average and fallback', () => {
    expect(formatHeartRateAverage(148, 'en', 'n/a')).toBe('148 bpm');
    expect(formatHeartRateAverage(null, 'en', 'n/a')).toBe('n/a');
  });

  it('converts speeds from and to m/s', () => {
    expect(convertSpeedFromMetersPerSecond(10, 'km/h')).toBeCloseTo(36, 3);
    expect(convertSpeedToMetersPerSecond(36, 'km/h')).toBeCloseTo(10, 3);
    expect(convertSpeedFromMetersPerSecond(10, 'mph')).toBeCloseTo(22.369, 3);
  });

  it('formats speed per selected unit', () => {
    expect(formatSpeed(10, 'km/h', 'n/a')).toContain('36.0 km/h');
    expect(formatSpeed(10, 'mph', 'n/a')).toContain('22.4 mph');
    expect(formatSpeed(10, 'm/s', 'n/a')).toContain('10.00 m/s');
    expect(formatSpeed(0, 'min/km', 'n/a')).toBe('n/a');
  });

  it('formats numbers, signed numbers and bpm drop', () => {
    expect(formatNumber(1.2345, 'en', 'n/a', 2)).toBe('1.23');
    expect(formatSignedNumber(1.2345, 'en', 2)).toBe('+1.23');
    expect(formatBpmDrop(12, 'en', 'n/a')).toBe('12 bpm');
  });

  it('formats triplets and distance meters fallback', () => {
    expect(formatBandTriplet(1, 2, 3, 'n/a')).toBe('1 / 2 / 3');
    expect(formatBandTriplet(1, null, 3, 'n/a')).toBe('n/a');
    expect(formatDistanceMetersOnly(1550.55, 'en', 'n/a')).toBe('1,550.6 m');
  });

  it('converts speed to unit value with finite checks', () => {
    expect(convertSpeedToUnitValue(10, 'km/h')).toBeCloseTo(36, 3);
    expect(convertSpeedToUnitValue(0, 'min/km')).toBeNull();
    expect(convertSpeedToUnitValue(Number.NaN, 'km/h')).toBeNull();
  });
});
