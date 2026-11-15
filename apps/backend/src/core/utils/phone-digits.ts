/**
 * A phone as Proteus stores and compares it on a Customer: its digits only, so `+57 300 123 4567`
 * and `3001234567`'s country-coded form compare by what was dialled rather than how it was typed.
 * Null for no phone, or one with no digits at all.
 */
export function toPhoneDigits(phone: string | null | undefined): string | null {
  const digits = phone?.replace(/\D/g, '') ?? ''
  return digits === '' ? null : digits
}
