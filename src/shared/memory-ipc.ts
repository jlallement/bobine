/**
 * Canaux IPC de la mémoire commune (fiche 182), sortis de `ipc.ts` (taille bornée, fiche 089) :
 * le contrat `IpcInvokeContract` les reprend (`extends`), `IPC_CHANNELS` aussi.
 */
import type {
  MemoryDecision,
  MemoryDecisionResult,
  MemoryEntryView,
  MemoryError,
  MemoryKeyState,
  MemoryPlace,
  MemoryProjectView,
  MemoryType
} from './memory'

export interface MemoryIpcContract {
  /**
   * Mémoire commune (fiche 182). `memory:decide` : « Retenir » / « Oublier » / « Non » d'une carte
   * (la proposition est relue dans le fil du main). Le reste sert l'écran « Mémoire » : projets,
   * souvenirs d'une mémoire (et fichiers illisibles mis de côté), modification par l'utilisateur
   * (refusée sur version dépassée : `changed`), suppression, tout effacer (rend le nombre).
   */
  'memory:decide': { args: [decision: MemoryDecision]; result: MemoryDecisionResult }
  /** Projets qui ont une mémoire ; celui de `workspace` (conversation en cours) marqué `current`. */
  'memory:projects': {
    args: [workspace?: string]
    result: { projects: MemoryProjectView[]; keyState: MemoryKeyState; current?: string }
  }
  'memory:list': {
    args: [place: MemoryPlace]
    result: { entries: MemoryEntryView[]; broken: string[] }
  }
  'memory:save': {
    args: [
      place: MemoryPlace,
      entry: { name: string; description: string; type: MemoryType; body: string },
      expected: string | null
    ]
    result: { ok: true } | { ok: false; error: MemoryError } | { ok: false; changed: true }
  }
  'memory:remove': { args: [place: MemoryPlace, name: string, expected?: string]; result: boolean }
  'memory:clear': { args: [place: MemoryPlace]; result: number }
  /**
   * « Garder ces modifications » d'un souvenir modifié hors de Bobine : sa version actuelle est
   * validée et redonnée aux agents ; `false` s'il a changé entre-temps.
   */
  'memory:approve': {
    args: [place: MemoryPlace, name: string, version: string]
    result: { ok: true } | { ok: false; reason: 'changed' | 'secret' | 'locked' }
  }
  /** Déplace un souvenir (« Vous » ↔ projet) ; `exists` si le nom est pris de l'autre côté. */
  'memory:move': {
    args: [from: MemoryPlace, to: MemoryPlace, name: string, expected?: string]
    result: { ok: true } | { ok: false; reason: 'changed' | 'exists' | 'full' }
  }
  /** Rattache un projet introuvable à un dossier choisi (dialogue natif) : nombre rattaché, `null` si annulé. */
  'memory:attach': { args: [projectId: string, folder?: string]; result: number | null }
  /** Exporte une mémoire en un fichier Markdown (« Enregistrer sous ») : chemin, `null` si annulé. */
  'memory:export': { args: [place: MemoryPlace]; result: string | null }
  /** Montre le dossier d'une mémoire dans le Finder. */
  'memory:reveal': { args: [place: MemoryPlace]; result: undefined }
}

export const MEMORY_CHANNELS = [
  'memory:decide',
  'memory:projects',
  'memory:list',
  'memory:save',
  'memory:remove',
  'memory:clear',
  'memory:approve',
  'memory:move',
  'memory:attach',
  'memory:export',
  'memory:reveal'
] as const
