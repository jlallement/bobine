/**
 * Texte de l'interface enregistré ou transmis sous forme de code (ADR-0014) : une clé et ses
 * valeurs, traduits au moment de l'affichage. Une conversation enregistrée s'affiche ainsi dans la
 * langue choisie, même après un changement.
 */
import i18next, { type ParseKeys } from 'i18next'

export interface Message {
  key: ParseKeys
  /** Valeurs des variables ; un `Message` imbriqué est traduit lui aussi. */
  params?: Readonly<Record<string, string | number | Message>>
}

export const isMessage = (value: unknown): value is Message =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { key?: unknown }).key === 'string'

/** Le message dans la langue courante. */
export function translate(message: Message): string {
  const params = Object.fromEntries(
    Object.entries(message.params ?? {}).map(([name, value]) => [
      name,
      isMessage(value) ? translate(value) : value
    ])
  )
  // Clé et variables connues seulement à l'exécution (elles ont été vérifiées à la création du
  // message) : la signature typée d'i18next ne peut pas s'appliquer ici.
  const t = i18next.t as unknown as (key: string, options: Record<string, unknown>) => string
  return t(message.key, params)
}
