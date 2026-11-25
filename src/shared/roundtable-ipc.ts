/**
 * Canaux IPC du tour de table (fiche 285, ADR-0072), à part comme ceux des rôles (`roles-ipc.ts`,
 * taille bornée, fiche 089). Le lot 1 côté main les ajoute à `IpcInvokeContract` (`extends`) et à
 * `IPC_CHANNELS`, avec leurs gestionnaires (`main/roundtable/ipc.ts`), leur classement dans
 * `read-only-guard.ts` (`ROUNDTABLE_READ_ONLY_SAFE`) et le preload.
 *
 * La conversation est désignée par son identifiant, jamais par un chemin ; le main fait autorité
 * sur tout le reste (agents, modèles, places, phase). Les arguments venus du renderer sont vérifiés
 * par les fonctions `parse…` ci-dessous. Les changements de l'élément arrivent par le flux
 * d'évènements existant : aucun canal d'abonnement.
 */
import { parseAttachments, type PromptAttachment } from './attachments'
import type { DataDestination, HandoverModel } from './handover'
import {
  ROUNDTABLE_LETTERS,
  ROUNDTABLE_MAX_SEATS,
  choiceKey,
  type RoundtableArbiter,
  type RoundtableChoice,
  type RoundtableLetter,
  type RoundtableReadOnly,
  type RoundtableSelectionProblem
} from './roundtable'

/** Question d'un tour, au plus (même ordre de grandeur qu'un long message tapé). */
export const ROUNDTABLE_QUESTION_MAX = 100_000
/** Identifiants (conversation, tour), au plus. */
const ID_MAX = 200
/** Identifiant de profil : celui des profils fournis et des agents déclarés (`custom-…`). */
const PROFILE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/
/** Champs d'un modèle (identifiant du réglage, valeur, nom), au plus. */
const MODEL_FIELD_MAX = 300

/** `/roundtable <question>` envoyé : ce que le renderer demande. */
export interface RoundtableStartRequest {
  question: string
  /** Les participants retenus dans le menu, dans l'ordre du menu. */
  participants: RoundtableChoice[]
  /** Pièces jointes de la saisie : elles partent à chaque participant. */
  attachments?: PromptAttachment[]
}

/**
 * Pourquoi un tour ne part pas (rien n'est lancé, jamais un tour partiel) :
 * - `selection` : participants invalides (`problem`) ;
 * - `slots` : places de travaux manquantes (`missing`) ;
 * - `running` : un tour de table est déjà en cours dans cette conversation ;
 * - `task` : la conversation est un travail (un travail n'a pas de travaux, ADR-0019) ;
 * - `archived`, `discussion` : conversation archivée, ou espace Discussion (pas de dossier de code) ;
 * - `question` : question plus longue que `QUESTION_CHARS` (participants et arbitre lisent la même,
 *   entière : elle n'est jamais coupée en silence).
 */
export type RoundtableStartError =
  'selection' | 'slots' | 'running' | 'task' | 'archived' | 'discussion' | 'question'

export type RoundtableStartResult =
  | { ok: true; roundtableId: string }
  | {
      ok: false
      error: RoundtableStartError
      problem?: RoundtableSelectionProblem
      /** `slots` : places qui manquent. */
      missing?: number
    }

/** Un agent proposé dans le menu des participants. */
export interface RoundtableAgentOption {
  profileId: string
  label: string
  available: boolean
  /** Pourquoi il est indisponible. */
  reason?: string
  /** Le modèle se choisit (`childModelChoice`) ; sinon une seule ligne, sans modèle (Bob). */
  modelChoice: boolean
  /** Identifiant du réglage de modèle connu pour cet agent. */
  controlId?: string
  /** Lecture seule attendue pour un participant de cet agent, dans ce dossier. */
  readOnly: RoundtableReadOnly
  /** Destination sans modèle choisi (fiche 108). */
  destination: DataDestination
  /** Modèles récemment utilisés, d'abord (décision 6 du 2026-11-24). */
  recent: HandoverModel[]
  /** Les autres modèles connus, derrière « Autres modèles… ». */
  others: HandoverModel[]
  /**
   * Agent à choix de modèle dont aucun modèle n'est encore connu (contre-recette N2) :
   * `loading` — Bobine les demande à l'agent, relire `roundtable:options` un peu plus tard ;
   * `default` — inconnus : l'agent se propose seul, « <agent> · modèle par défaut ».
   */
  modelsState?: 'loading' | 'default'
}

/** Ce qu'il faut à la ligne du tour de table et au menu des participants. */
export interface RoundtableOptions {
  agents: RoundtableAgentOption[]
  /** Places de travaux libres (« Travaux en même temps, au plus », moins les travaux en cours). */
  freeSlots: number
  /** Le dossier est dans un dépôt git (sinon, lecture seule demandée non vérifiée). */
  inGit: boolean
  /** La conversation a un dernier échange, qui partira avec la question (infobulle). */
  lastExchange: boolean
  /** Le tour ne peut pas partir d'ici, quelle que soit la sélection. */
  refused?: Exclude<RoundtableStartError, 'selection' | 'slots' | 'question'>
  /**
   * L'arbitre (agent et modèle de cette conversation) : jamais participant (problème `arbiter`).
   * Un agent sans choix de modèle qui arbitre est aussi rendu indisponible, avec sa raison.
   */
  arbiter?: RoundtableArbiter
}

export interface RoundtableIpcContract {
  /** Agents et modèles proposés, places libres, ce qui partira (lecture seule). */
  'roundtable:options': { args: [conversationId: string]; result: RoundtableOptions }
  /** Lance le tour : places réservées ensemble, ou rien. */
  'roundtable:start': {
    args: [conversationId: string, request: RoundtableStartRequest]
    result: RoundtableStartResult
  }
  /**
   * « Synthétiser sans attendre » (au moins deux avis, les autres arrêtés), ou « Synthétiser avec
   * N avis » après un redémarrage. Refusé par le main hors de sa phase.
   */
  'roundtable:synthesize': {
    args: [conversationId: string, roundtableId: string]
    result: undefined
  }
  /** « Faire réagir les participants » : une seule fois par tour, garanti par le main. */
  'roundtable:rebuttal': { args: [conversationId: string, roundtableId: string]; result: undefined }
  /** Décision demandée de nouveau après un redémarrage pendant la réplique. */
  'roundtable:decide': { args: [conversationId: string, roundtableId: string]; result: undefined }
  /** « Relancer » un participant sans avis. */
  'roundtable:relaunch': {
    args: [conversationId: string, roundtableId: string, letter: RoundtableLetter]
    result: undefined
  }
  /** « Arrêter » un participant (`letter`), ou tout le tour de table (sans lettre). */
  'roundtable:stop': {
    args: [conversationId: string, roundtableId: string, letter?: RoundtableLetter]
    result: undefined
  }
}

export const ROUNDTABLE_CHANNELS = [
  'roundtable:options',
  'roundtable:start',
  'roundtable:synthesize',
  'roundtable:rebuttal',
  'roundtable:decide',
  'roundtable:relaunch',
  'roundtable:stop'
] as const

export type RoundtableChannel = (typeof ROUNDTABLE_CHANNELS)[number]

/** Sûrs dans un profil en lecture seule (fiche 196) : ils ne changent rien. */
export const ROUNDTABLE_READ_ONLY_SAFE: readonly RoundtableChannel[] = ['roundtable:options']

/** Identifiant venu du renderer (conversation, tour) : une chaîne courte, sans caractère de contrôle. */
export function parseRoundtableId(value: unknown, name = 'roundtableId'): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > ID_MAX ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new Error(`Paramètre invalide : ${name}`)
  return value
}

/** Lettre d'un participant. */
export function parseRoundtableLetter(value: unknown): RoundtableLetter {
  if (!ROUNDTABLE_LETTERS.includes(value as RoundtableLetter))
    throw new Error('Paramètre invalide : letter')
  return value as RoundtableLetter
}

/** Lettre facultative (`roundtable:stop`). */
export function parseOptionalLetter(value: unknown): RoundtableLetter | undefined {
  return value === undefined || value === null ? undefined : parseRoundtableLetter(value)
}

const shortText = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > MODEL_FIELD_MAX)
    throw new Error(`Paramètre invalide : ${name}`)
  return value
}

/** Un participant venu du renderer, vérifié champ par champ. */
export function parseRoundtableChoice(value: unknown, index = 0): RoundtableChoice {
  if (typeof value !== 'object' || value === null)
    throw new Error(`Paramètre invalide : participants[${index}]`)
  const { profileId, model } = value as Record<string, unknown>
  if (typeof profileId !== 'string' || !PROFILE_ID.test(profileId))
    throw new Error(`Paramètre invalide : participants[${index}].profileId`)
  if (model === undefined || model === null) return { profileId }
  if (typeof model !== 'object')
    throw new Error(`Paramètre invalide : participants[${index}].model`)
  const m = model as Record<string, unknown>
  return {
    profileId,
    model: {
      controlId: shortText(m['controlId'], `participants[${index}].model.controlId`),
      value: shortText(m['value'], `participants[${index}].model.value`),
      name: shortText(m['name'], `participants[${index}].model.name`).trim()
    }
  }
}

/**
 * `roundtable:start`, vérifié : question non vide et bornée, 1 à 5 participants bien formés et
 * sans doublon, pièces jointes vérifiées comme celles d'un message. Le nombre minimal, la place
 * unique d'un agent sans choix de modèle et la disponibilité se vérifient au main contre les
 * profils (`selectionProblem`), qui rend une erreur lisible.
 */
export function parseRoundtableStartRequest(value: unknown): RoundtableStartRequest {
  if (typeof value !== 'object' || value === null) throw new Error('Requête invalide')
  const { question, participants, attachments } = value as Record<string, unknown>
  if (typeof question !== 'string' || !question.trim())
    throw new Error('Paramètre invalide : question')
  if (question.length > ROUNDTABLE_QUESTION_MAX) throw new Error('Paramètre invalide : question')
  if (
    !Array.isArray(participants) ||
    participants.length === 0 ||
    participants.length > ROUNDTABLE_MAX_SEATS
  )
    throw new Error('Paramètre invalide : participants')
  const choices = participants.map((p, index) => parseRoundtableChoice(p, index))
  if (new Set(choices.map(choiceKey)).size !== choices.length)
    throw new Error('Paramètre invalide : participants (doublon)')
  const files = parseAttachments(attachments)
  return {
    question: question.trim(),
    participants: choices,
    ...(files.length ? { attachments: files } : {})
  }
}

/**
 * Participants retenus lus des préférences (dernier choix du menu) : indulgent, une entrée abîmée
 * est écartée, les doublons aussi, 5 au plus. Jamais d'erreur au chargement.
 */
export function parseRoundtableChoices(raw: unknown): RoundtableChoice[] {
  if (!Array.isArray(raw)) return []
  const kept: RoundtableChoice[] = []
  const keys = new Set<string>()
  for (const entry of raw) {
    if (kept.length >= ROUNDTABLE_MAX_SEATS) break
    try {
      const choice = parseRoundtableChoice(entry)
      const key = choiceKey(choice)
      if (keys.has(key)) continue
      keys.add(key)
      kept.push(choice)
    } catch {
      // Entrée abîmée : écartée, les autres restent.
    }
  }
  return kept
}
