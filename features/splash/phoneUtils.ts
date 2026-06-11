export type Country = { code: string; dial: string; flag: string; name: string; format: string }

export const COUNTRIES: Country[] = [
  { code: 'US', dial: '+1', flag: '🇺🇸', name: 'United States', format: 'XXX-XXX-XXXX' },
  { code: 'CA', dial: '+1', flag: '🇨🇦', name: 'Canada', format: 'XXX-XXX-XXXX' },
  { code: 'GB', dial: '+44', flag: '🇬🇧', name: 'United Kingdom', format: 'XXXX XXXXXX' },
  { code: 'AU', dial: '+61', flag: '🇦🇺', name: 'Australia', format: 'X XXXX XXXX' },
  { code: 'NZ', dial: '+64', flag: '🇳🇿', name: 'New Zealand', format: 'XX XXX XXXX' },
  { code: 'SG', dial: '+65', flag: '🇸🇬', name: 'Singapore', format: 'XXXX XXXX' },
  { code: 'HK', dial: '+852', flag: '🇭🇰', name: 'Hong Kong', format: 'XXXX XXXX' },
  { code: 'TW', dial: '+886', flag: '🇹🇼', name: 'Taiwan', format: 'XXX XXX XXX' },
  { code: 'JP', dial: '+81', flag: '🇯🇵', name: 'Japan', format: 'XX XXXX XXXX' },
  { code: 'KR', dial: '+82', flag: '🇰🇷', name: 'South Korea', format: 'XX XXXX XXXX' },
  { code: 'CN', dial: '+86', flag: '🇨🇳', name: 'China', format: 'XXX XXXX XXXX' },
  { code: 'IN', dial: '+91', flag: '🇮🇳', name: 'India', format: 'XXXXX XXXXX' },
  { code: 'DE', dial: '+49', flag: '🇩🇪', name: 'Germany', format: 'XXX XXXXXXX' },
  { code: 'FR', dial: '+33', flag: '🇫🇷', name: 'France', format: 'X XX XX XX XX' },
  { code: 'ES', dial: '+34', flag: '🇪🇸', name: 'Spain', format: 'XXX XXX XXX' },
  { code: 'IT', dial: '+39', flag: '🇮🇹', name: 'Italy', format: 'XXX XXX XXXX' },
  { code: 'NL', dial: '+31', flag: '🇳🇱', name: 'Netherlands', format: 'X XX XXX XXXX' },
  { code: 'SE', dial: '+46', flag: '🇸🇪', name: 'Sweden', format: 'XX XXX XXXX' },
  { code: 'NO', dial: '+47', flag: '🇳🇴', name: 'Norway', format: 'XXXX XXXX' },
  { code: 'DK', dial: '+45', flag: '🇩🇰', name: 'Denmark', format: 'XXXX XXXX' },
  { code: 'FI', dial: '+358', flag: '🇫🇮', name: 'Finland', format: 'XX XXX XXXX' },
  { code: 'BR', dial: '+55', flag: '🇧🇷', name: 'Brazil', format: 'XX XXXXX-XXXX' },
  { code: 'MX', dial: '+52', flag: '🇲🇽', name: 'Mexico', format: 'XX XXXX XXXX' },
  { code: 'ZA', dial: '+27', flag: '🇿🇦', name: 'South Africa', format: 'XX XXX XXXX' },
  { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'UAE', format: 'XX XXX XXXX' },
]

export function formatLocalNumber(digits: string, format: string): string {
  let result = ''
  let di = 0
  for (let fi = 0; fi < format.length && di < digits.length; fi++) {
    if (format[fi] === 'X') {
      result += digits[di++]
    } else {
      result += format[fi]
    }
  }
  return result
}

export function toE164(dial: string, local: string): string {
  return `${dial}${local.replace(/\D/g, '')}`
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone)
}
