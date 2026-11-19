/**
 * Réglages de session propres à chaque conversation (fiche 256, ADR-0058) : mode, modèle, effort,
 * options, relevés quand la session est stable et réappliqués quand la conversation est rouverte.
 * Le dernier choix fait avec un profil (`settings.controls`) ne sert qu'aux sessions qui n'ont pas
 * de réglages à elles (nouvelles conversations).
 */
import type { AgentSnapshot, ControlValue } from '@shared/agent'
import type { AgentProfile } from '../agent/profiles'
import type { ConversationRecord } from './store'

/** Réglages d'une conversation, pour l'agent qui les a annoncés (identifiants propres à chacun). */
export interface ConversationControls {
  profileId: string
  values: Record<string, ControlValue>
}

/** Réglages lus sur le disque : `undefined` s'ils sont mal formés (retirés, pas la conversation). */
export function parseConversationControls(value: unknown): ConversationControls | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { profileId, values } = value as Partial<ConversationControls>
  if (typeof profileId !== 'string' || !profileId) return undefined
  if (typeof values !== 'object' || values === null || Array.isArray(values)) return undefined
  const entries = Object.entries(values)
  if (entries.length === 0) return undefined
  if (!entries.every(([, v]) => typeof v === 'string' || typeof v === 'boolean')) return undefined
  return { profileId, values: Object.fromEntries(entries) }
}

/**
 * Relève les réglages de la session d'une conversation dans sa fiche. Seulement quand la session
 * est ouverte et stable (`ready`, `busy`) : pendant l'ouverture, l'agent annonce encore ses
 * propres valeurs, pas encore celles de la conversation. Les valeurs relevées remplacent les
 * précédentes (un réglage disparu n'est plus réappliqué). Rend vrai si la fiche a changé.
 */
export function noteSessionControls(
  record: ConversationRecord,
  snapshot: Pick<AgentSnapshot, 'status' | 'controls'>
): boolean {
  if (snapshot.status !== 'ready' && snapshot.status !== 'busy') return false
  if (snapshot.controls.length === 0) return false
  const values = Object.fromEntries(snapshot.controls.map((c) => [c.id, c.currentValue]))
  const known = record.controls
  if (known?.profileId === record.profileId && sameValues(known.values, values)) return false
  record.controls = { profileId: record.profileId, values }
  return true
}

function sameValues(a: Record<string, ControlValue>, b: Record<string, ControlValue>): boolean {
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && a[k] === b[k])
  )
}

/**
 * Réglages à appliquer à l'ouverture d'une session de la conversation :
 * - les siens, s'ils ont été relevés avec ce même agent (réouverture, session neuve dans la même
 *   conversation, aparté) ;
 * - sinon, à une réouverture : aucun, la session rouverte garde ce qu'elle annonce (jamais le
 *   dernier choix fait dans une autre conversation, D3) ;
 * - sinon (nouvelle conversation) : le dernier choix fait avec ce profil, sinon ses défauts.
 */
export function openingControls(
  record: Pick<ConversationRecord, 'controls'>,
  profile: Pick<AgentProfile, 'id' | 'defaultControls'>,
  remembered: Record<string, ControlValue> | undefined,
  session: 'new' | 'reopened'
): Record<string, ControlValue> | undefined {
  const own = record.controls?.profileId === profile.id ? record.controls.values : undefined
  if (own) return { ...own }
  if (session === 'reopened') return undefined
  return { ...profile.defaultControls, ...remembered }
}
