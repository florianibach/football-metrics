import { normalizeLocaleTag } from './locale';

export type SpeedUnit = 'km/h' | 'mph' | 'm/s' | 'min/km';

export function formatHeartRateAverage(value: number | null, locale: string, notAvailable: string): string {
  if (value === null) {
    return notAvailable;
  }

  return `${value.toLocaleString(normalizeLocaleTag(locale), { maximumFractionDigits: 0 })} bpm`;
}

export function convertSpeedFromMetersPerSecond(valueMetersPerSecond: number, unit: SpeedUnit): number {
  if (unit === 'km/h') {
    return valueMetersPerSecond * 3.6;
  }

  if (unit === 'mph') {
    return valueMetersPerSecond * 2.2369362921;
  }

  if (unit === 'min/km') {
    if (valueMetersPerSecond <= 0) {
      return 0;
    }

    return 1000 / (valueMetersPerSecond * 60);
  }

  return valueMetersPerSecond;
}

export function convertSpeedToMetersPerSecond(value: number, unit: SpeedUnit): number {
  if (unit === 'km/h') {
    return value / 3.6;
  }

  if (unit === 'mph') {
    return value / 2.2369362921;
  }

  if (unit === 'min/km') {
    if (value <= 0) {
      return 0;
    }

    return 1000 / (value * 60);
  }

  return value;
}

export function formatSpeed(valueMetersPerSecond: number | null, unit: SpeedUnit, notAvailableText: string): string {
  if (valueMetersPerSecond === null) {
    return notAvailableText;
  }

  if (unit === 'km/h') {
    return `${(valueMetersPerSecond * 3.6).toFixed(1)} km/h`;
  }

  if (unit === 'mph') {
    return `${(valueMetersPerSecond * 2.2369362921).toFixed(1)} mph`;
  }

  if (unit === 'min/km') {
    if (valueMetersPerSecond <= 0) {
      return notAvailableText;
    }

    const minutesPerKilometer = 1000 / (valueMetersPerSecond * 60);
    return `${minutesPerKilometer.toFixed(2)} min/km`;
  }

  return `${valueMetersPerSecond.toFixed(2)} m/s`;
}

export function formatNumber(value: number | null | undefined, locale: string, notAvailable: string, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return notAvailable;
  }

  return value.toLocaleString(normalizeLocaleTag(locale), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatBpmDrop(value: number | null | undefined, locale: string, notAvailable: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return notAvailable;
  }

  return `${value.toLocaleString(normalizeLocaleTag(locale), { maximumFractionDigits: 0 })} bpm`;
}

export function formatSignedNumber(value: number, locale: string, digits = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString(normalizeLocaleTag(locale), { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function formatBandTriplet(
  moderate: number | null | undefined,
  high: number | null | undefined,
  veryHigh: number | null | undefined,
  notAvailable: string
): string {
  if (moderate === null || moderate === undefined || high === null || high === undefined || veryHigh === null || veryHigh === undefined) {
    return notAvailable;
  }

  return `${moderate} / ${high} / ${veryHigh}`;
}

export function formatDistanceMetersOnly(distanceMeters: number | null, locale: string, notAvailable: string): string {
  if (distanceMeters === null) {
    return notAvailable;
  }

  return `${distanceMeters.toLocaleString(normalizeLocaleTag(locale), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`;
}

export function convertSpeedToUnitValue(valueMetersPerSecond: number, unit: SpeedUnit): number | null {
  if (!Number.isFinite(valueMetersPerSecond)) {
    return null;
  }

  if (unit === 'km/h') {
    return valueMetersPerSecond * 3.6;
  }

  if (unit === 'mph') {
    return valueMetersPerSecond * 2.2369362921;
  }

  if (unit === 'min/km') {
    if (valueMetersPerSecond <= 0) {
      return null;
    }

    return 1000 / (valueMetersPerSecond * 60);
  }

  return valueMetersPerSecond;
}
