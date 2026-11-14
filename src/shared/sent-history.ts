/**
 * Historique de la saisie (fiche 225) : les messages envoyés d'une conversation, tels que tapés,
 * pour les rappeler par ↑ / ↓. Gardé par le main avec la conversation (`sentHistory` de son fil) ;
 * ce qui vient du renderer ou du disque est vérifié ici.
 */

/** Rôle d'un jeton posé au moment de l'envoi : son nom, et son libellé (rôle supprimé depuis). */
export interface SentRole {
  name: string
  label: string
}

export interface SentEntry {
  /** Texte tel que tapé (une commande « / » telle quelle, jamais sa consigne développée). */
  text: string
  /** Jetons de rôle de la saisie (fiche 223). */
  roles?: SentRole[]
  /** Pièces jointes du message (fichiers, images, « collé ») : elles ne reviennent pas. */
  attachments?: number
}

/** Entrées gardées au plus par conversation (les plus anciennes s'en vont). */
export const MAX_SENT_HISTORY = 100
/** Texte gardé au plus par entrée (au-delà, l'entrée est refusée, pas tronquée). */
export const MAX_SENT_TEXT = 100_000
const MAX_ROLES = 20
const MAX_ATTACHMENTS = 1000

const sameRoles = (a: readonly SentRole[] = [], b: readonly SentRole[] = []): boolean =>
  a.length === b.length && a.every((role, i) => role.name === b[i]?.name)

/** Même message : même texte et mêmes rôles (les pièces jointes ne comptent pas). */
export const sameEntry = (a: SentEntry, b: SentEntry): boolean =>
  a.text === b.text && sameRoles(a.roles, b.roles)

/**
 * Ajoute une entrée : rien d'un message vide ; un doublon du dernier le remplace (« continue » ×3
 * = une entrée) ; au plus `MAX_SENT_HISTORY`.
 */
export function addSentEntry(list: readonly SentEntry[], entry: SentEntry): SentEntry[] {
  if (!entry.text.trim() && !entry.roles?.length) return [...list]
  const last = list.at(-1)
  const kept = last && sameEntry(last, entry) ? list.slice(0, -1) : list
  return [...kept, entry].slice(-MAX_SENT_HISTORY)
}

function parseRoles(raw: unknown): SentRole[] | undefined {
  if (raw === undefined) return []
  if (!Array.isArray(raw) || raw.length > MAX_ROLES) return undefined
  const roles: SentRole[] = []
  for (const item of raw) {
    const r = item as Partial<SentRole> | null
    if (typeof r !== 'object' || r === null) return undefined
    if (typeof r.name !== 'string' || !r.name || r.name.length > 200) return undefined
    if (typeof r.label !== 'string' || r.label.length > 200) return undefined
    roles.push({ name: r.name, label: r.label || r.name })
  }
  return roles
}

/** Entrée vérifiée ; `undefined` si elle est mal formée. */
export function parseSentEntry(raw: unknown): SentEntry | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const { text, roles, attachments } = raw as Record<string, unknown>
  if (typeof text !== 'string' || text.length > MAX_SENT_TEXT) return undefined
  const parsedRoles = parseRoles(roles)
  if (!parsedRoles) return undefined
  if (
    attachments !== undefined &&
    (typeof attachments !== 'number' ||
      !Number.isInteger(attachments) ||
      attachments < 0 ||
      attachments > MAX_ATTACHMENTS)
  ) {
    return undefined
  }
  return {
    text,
    ...(parsedRoles.length ? { roles: parsedRoles } : {}),
    ...(typeof attachments === 'number' && attachments > 0 ? { attachments } : {})
  }
}

/** Historique lu du disque : les entrées mal formées sont laissées de côté, le reste est gardé. */
export function parseSentHistory(raw: unknown): SentEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(parseSentEntry)
    .filter((e): e is SentEntry => e !== undefined)
    .slice(-MAX_SENT_HISTORY)
}
