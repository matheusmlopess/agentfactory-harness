import type { FieldType } from './providers.js'

/**
 * Single masking rule for secret values across the UI (gap 7).
 * URLs render unmasked; keys/tokens show a short recognizable prefix
 * (up to the first `-` after index 3, else the first 6 chars) then `…▓▓▓▓`.
 */
export function maskSecret(value: string, fieldType: FieldType = 'apikey'): string {
  if (fieldType === 'url') return value
  if (value.length === 0) return ''
  const dashIdx = value.indexOf('-', 3)
  const prefix = dashIdx > 0 ? value.slice(0, dashIdx + 1) : value.slice(0, Math.min(6, value.length))
  return `${prefix}…▓▓▓▓`
}
