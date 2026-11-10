/**
 * Contraste des couleurs (fiche 134) : luminance relative et rapport de contraste de WCAG 2.x, et le
 * mélange de `color-mix(in srgb, …)`. Couleurs en hexadécimal `#rrggbb`.
 */

function channels(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!match) throw new Error(`Couleur attendue en #rrggbb : ${hex}`)
  return [match[1], match[2], match[3]].map((part) => parseInt(part ?? '0', 16)) as [
    number,
    number,
    number
  ]
}

/** Luminance relative (0 : noir, 1 : blanc). */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const c = value / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Rapport de contraste entre deux couleurs, de 1 à 21, dans un sens ou dans l'autre. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

/** `color-mix(in srgb, a percent%, b)`. */
export function mix(a: string, percent: number, b: string): string {
  const x = channels(a)
  const y = channels(b)
  const p = percent / 100
  return `#${x
    .map((value, i) => Math.round(value * p + (y[i] ?? 0) * (1 - p)))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`
}
