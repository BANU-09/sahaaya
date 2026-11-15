import { describe, it, expect } from 'vitest';
import { LOCALES, dictionaries, getText, normalizeLocale, formatDate } from '@/lib/i18n';
describe('six-language interface', () => {
  it.each(Object.keys(LOCALES))('has a value for every essential key in %s', (locale) => {
    const dictionary = dictionaries[normalizeLocale(locale)];
    expect(Object.keys(dictionary)).toEqual(Object.keys(dictionaries.en));
    for (const value of Object.values(dictionary)) expect(value.trim().length).toBeGreaterThan(0);
  });
  it('falls back to English for unsupported locales', () =>
    expect(normalizeLocale('fr')).toBe('en'));
  it('translates server errors and audit events', () => {
    expect(getText('te', 'forbidden')).not.toBe(getText('en', 'forbidden'));
    expect(getText('hi', 'doseTAKEN')).toBe(getText('hi', 'TAKEN'));
  });
  it('formats times using the patient timezone', () =>
    expect(
      formatDate('2026-11-15T02:30:00Z', 'en', 'Asia/Kolkata', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    ).toBe('08:00'));
});
