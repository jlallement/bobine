/**
 * Avis de l'app en haut de la fenêtre (fiche 194) : ce qui n'appartient à aucune conversation.
 * Le main les garde ; la fenêtre les lit au chargement puis suit leurs changements.
 */
export type AppAlert =
  /** Exceptions non rattrapées dans le main depuis le lancement : leur nombre, la première. */
  | { kind: 'internal-error'; count: number; detail: string }
  /** Le lancement précédent s'est arrêté sans quitter : rapport local rangé dans ce dossier. */
  | { kind: 'crashed'; report: string }

export type AppAlertKind = AppAlert['kind']

export const APP_ALERT_KINDS: readonly AppAlertKind[] = ['internal-error', 'crashed']

export const isAppAlertKind = (value: unknown): value is AppAlertKind =>
  typeof value === 'string' && (APP_ALERT_KINDS as readonly string[]).includes(value)
