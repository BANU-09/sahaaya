export const CARE_LOOKUPS = {
  todaySchedule: 'SCHEDULE',
  nextAppointment: 'APPOINTMENTS',
  estimatedStock: 'REFILLS',
  visitSummary: 'SUMMARY',
} as const;
export type CareIntent = (typeof CARE_LOOKUPS)[keyof typeof CARE_LOOKUPS] | 'EMERGENCY' | 'OTHER';

/** Local routing only. This never diagnoses or generates treatment instructions. */
export function careIntent(question: string): CareIntent {
  const value = question.toLowerCase();
  if (
    /chest pain|can't breathe|cannot breathe|unconscious|ఛాతీ నొప్పి|ఊపిరి|மார்பு வலி|மூச்சு|सीने में दर्द|सांस नहीं|ಎದೆ ನೋವು|ಉಸಿರಾಟ|നെഞ്ചുവേദന|ശ്വാസ/.test(
      value,
    )
  )
    return 'EMERGENCY';
  if (
    /diagnos|prescrib|double.{0,20}dose|(?:increase|decrease|stop|change).{0,30}(?:dose|medicine|medication)/.test(
      value,
    )
  )
    return 'OTHER';
  if (/summary|సారాంశ|சுருக்க|सारांश|ಸಾರಾಂಶ|സംഗ്രഹ/.test(value)) return 'SUMMARY';
  if (
    /appointment|doctor|వైద్య|సందర్శన|சந்திப்பு|மருத்துவர்|मुलाकात|डॉक्टर|ವೈದ್ಯ|ಭೇಟಿ|ഡോക്ടർ|സന്ദർശന/.test(value)
  )
    return 'APPOINTMENTS';
  if (/refill|stock|నిల్వ|இருப்பு|भंडार|ದಾಸ್ತಾನು|സ്റ്റോക്ക്/.test(value)) return 'REFILLS';
  if (/medicine|dose|today|మందు|మందులు|மருந்து|दवा|दवाई|औषध|ಔಷಧ|ಮದ್ದು|മരുന്ന്/.test(value))
    return 'SCHEDULE';
  return 'OTHER';
}
