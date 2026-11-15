import { expect, it } from 'vitest';
import { careIntent } from '@/lib/companion-intent';
it.each([
  'Visit summary',
  'సందర్శన సారాంశం',
  'வருகைச் சுருக்கம்',
  'मुलाकात का सारांश',
  'ಭೇಟಿಯ ಸಾರಾಂಶ',
  'സന്ദർശന സംഗ്രഹം',
])('recognizes the summary shortcut in %s', (question) => {
  expect(careIntent(question)).toBe('SUMMARY');
});
it.each([
  'I have chest pain before my appointment',
  'ఛాతీ నొప్పి',
  'மார்பு வலி',
  'सीने में दर्द',
  'ಎದೆ ನೋವು',
  'നെഞ്ചുവേദന',
])('prioritizes emergency language: %s', (question) => {
  expect(careIntent(question)).toBe('EMERGENCY');
});
it('routes records without treating medication-change requests as ordinary schedules', () => {
  expect(careIntent('How much stock remains?')).toBe('REFILLS');
  expect(careIntent('When is my doctor appointment?')).toBe('APPOINTMENTS');
  expect(careIntent('Which medicines today?')).toBe('SCHEDULE');
  expect(careIntent('Should I increase my dose?')).toBe('OTHER');
  expect(careIntent('What does this diagnosis mean?')).toBe('OTHER');
});
