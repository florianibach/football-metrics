export type UiLocale = 'en' | 'de';

export function resolveInitialLocale(): UiLocale {
  if (typeof navigator === 'undefined') {
    return 'en';
  }

  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function normalizeLocaleTag(locale: string): 'de-DE' | 'en-US' {
  return locale.toLowerCase().startsWith('de') ? 'de-DE' : 'en-US';
}
