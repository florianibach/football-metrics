import { normalizeLocaleTag } from './locale';

describe('locale utils', () => {
  it('normalizes german locales', () => {
    expect(normalizeLocaleTag('de')).toBe('de-DE');
    expect(normalizeLocaleTag('de-AT')).toBe('de-DE');
  });

  it('normalizes all non german locales to en-US fallback', () => {
    expect(normalizeLocaleTag('en')).toBe('en-US');
    expect(normalizeLocaleTag('fr')).toBe('en-US');
  });
});
