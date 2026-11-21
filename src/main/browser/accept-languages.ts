/**
 * Langues annoncées par le navigateur intégré (`Accept-Language`, fiche 272). Depuis que l'app
 * déclare ses seules langues à macOS (`CFBundleLocalizations` : en, fr), `app.getLocale()` ne vaut
 * plus que l'une d'elles : un Mac en allemand ferait demander des pages en anglais. Les pages
 * suivent donc les langues préférées de macOS (`app.getPreferredSystemLanguages()`), telles quelles,
 * chacune suivie de sa langue de base (`de-DE` puis `de`), sans doublon.
 */
export function acceptLanguages(preferred: readonly string[]): string {
  const out: string[] = []
  const add = (tag: string) => {
    if (tag && !out.some((t) => t.toLowerCase() === tag.toLowerCase())) out.push(tag)
  }
  for (const raw of preferred) {
    const tag = raw.replace(/_/g, '-').trim()
    add(tag)
    add(tag.split('-')[0] ?? '')
  }
  return out.join(',')
}
