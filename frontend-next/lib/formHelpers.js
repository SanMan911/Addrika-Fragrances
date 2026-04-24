// Shared form input helpers
// - Title-cases every word as the user types (except email which is lowercased)
// - Country-code list for WhatsApp/phone fields

export function titleCase(value) {
  if (!value) return '';
  return value
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

export function lowerEmail(value) {
  return (value || '').toLowerCase().trim();
}

// Common country codes for WhatsApp / phone inputs. India default first.
export const COUNTRY_CODES = [
  { code: '+91', label: 'IN (+91)' },
  { code: '+1', label: 'US/CA (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+971', label: 'AE (+971)' },
  { code: '+966', label: 'SA (+966)' },
  { code: '+974', label: 'QA (+974)' },
  { code: '+965', label: 'KW (+965)' },
  { code: '+968', label: 'OM (+968)' },
  { code: '+973', label: 'BH (+973)' },
  { code: '+65', label: 'SG (+65)' },
  { code: '+60', label: 'MY (+60)' },
  { code: '+61', label: 'AU (+61)' },
  { code: '+64', label: 'NZ (+64)' },
  { code: '+33', label: 'FR (+33)' },
  { code: '+49', label: 'DE (+49)' },
  { code: '+86', label: 'CN (+86)' },
  { code: '+81', label: 'JP (+81)' },
];

export const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
