import {
  formatDistance,
  formatDistanceComparison,
  formatDistanceDeltaMeters,
  formatDuration,
  formatSecondsMmSs,
  toDateInputValue
} from './formatting';

describe('formatting utils', () => {
  it('formats date to yyyy-mm-dd', () => {
    expect(toDateInputValue(new Date('2026-03-01T18:22:10.000Z'))).toBe('2026-03-01');
  });

  it('formats mm:ss with left-padding', () => {
    expect(formatSecondsMmSs(65)).toBe('01:05');
    expect(formatSecondsMmSs(0)).toBe('00:00');
  });

  it('formats duration and not-available fallback', () => {
    expect(formatDuration(125, 'n/a')).toBe('2 min 5 s');
    expect(formatDuration(null, 'n/a')).toBe('n/a');
  });

  it('formats distance and comparison values', () => {
    expect(formatDistance(1500, 'en', 'n/a')).toContain('1.5 km');
    expect(formatDistanceComparison(1500, 'en', 'n/a')).toContain('1.500 km (1,500 m)');
  });

  it('formats distance deltas with tiny positive threshold handling', () => {
    expect(formatDistanceDeltaMeters(0.0005, 'en', 'n/a')).toBe('< 0.001 m');
    expect(formatDistanceDeltaMeters(1.23456, 'en', 'n/a')).toBe('1.235 m');
    expect(formatDistanceDeltaMeters(null, 'en', 'n/a')).toBe('n/a');
  });
});
