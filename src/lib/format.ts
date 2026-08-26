/** Groups digits by 4, e.g. "4972003188465120" -> "4972 0031 8846 5120" */
export function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

export function stripSpaces(value: string): string {
  return value.replace(/\s+/g, '')
}

/** Parses a French-formatted amount string ("12,50") into integer cents. Returns null if invalid. */
export function parseAmountToCents(value: string): number | null {
  const trimmed = value.trim().replace(/\s/g, '').replace(',', '.')
  if (trimmed === '') return null
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  return Math.round(parseFloat(trimmed) * 100)
}
