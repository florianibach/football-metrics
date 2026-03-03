import { normalizeLocaleTag } from './locale';

export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatSecondsMmSs(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const remaining = Math.floor(Math.max(0, seconds) % 60);
  return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
}

export function formatDuration(durationSeconds: number | null, notAvailable: string): string {
  if (durationSeconds === null) {
    return notAvailable;
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.round(durationSeconds % 60);
  return `${minutes} min ${seconds} s`;
}

export function formatDistance(distanceMeters: number | null, locale: string, notAvailable: string): string {
  if (distanceMeters === null) {
    return notAvailable;
  }

  return `${(distanceMeters / 1000).toLocaleString(normalizeLocaleTag(locale), { maximumFractionDigits: 2 })} km`;
}

export function formatDistanceComparison(distanceMeters: number | null, locale: string, notAvailable: string): string {
  if (distanceMeters === null) {
    return notAvailable;
  }

  const normalizedLocale = normalizeLocaleTag(locale);
  return `${(distanceMeters / 1000).toLocaleString(normalizedLocale, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} km (${distanceMeters.toLocaleString(normalizedLocale, { maximumFractionDigits: 1 })} m)`;
}

export function formatDistanceDeltaMeters(distanceDeltaMeters: number | null, locale: string, notAvailable: string): string {
  if (distanceDeltaMeters === null) {
    return notAvailable;
  }

  if (distanceDeltaMeters > 0 && distanceDeltaMeters < 0.001) {
    return '< 0.001 m';
  }

  return `${distanceDeltaMeters.toLocaleString(normalizeLocaleTag(locale), { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m`;
}
