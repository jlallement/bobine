/**
 * Préparation d'un nouveau worktree (fiche 175, ADR-0037) : fichiers ignorés copiés depuis le
 * dossier d'origine (`.worktreeinclude`), puis commande du projet (`.bobine/worktree.json`). Types
 * et fonctions pures partagés par le main (qui prépare) et le renderer (la carte du fil).
 */

import type { TranscriptItem, TranscriptState } from './transcript'

/** Fichier des motifs de copie, à la racine du dépôt (format de Claude Code, syntaxe `.gitignore`). */
export const WORKTREE_INCLUDE_FILE = '.worktreeinclude'
/** Commandes du projet, à la racine du dépôt. */
export const WORKTREE_CONFIG_FILE = '.bobine/worktree.json'

/** Plafonds de la copie : au-delà, le reste n'est pas copié (et la carte le dit). */
export const MAX_INCLUDED_FILES = 5000
export const MAX_INCLUDED_BYTES = 500 * 1024 * 1024
/** Chemins copiés gardés dans le fil (la carte en montre la liste dépliable) ; le reste : un nombre. */
export const LISTED_INCLUDED_FILES = 50

/** Délais des commandes. */
export const SETUP_TIMEOUT_MS = 15 * 60_000
export const ARCHIVE_TIMEOUT_MS = 2 * 60_000

/** Fin de sortie gardée dans la carte. */
export const OUTPUT_TAIL_CHARS = 8000
const OUTPUT_TAIL_LINES = 80

export interface WorktreeConfig {
  setup?: string
  archive?: string
}

export interface IncludedCopy {
  /** Nombre de fichiers copiés. */
  count: number
  /** Les premiers fichiers copiés (chemins relatifs au dépôt, `LISTED_INCLUDED_FILES` au plus). */
  files: string[]
  /** Fichiers retenus par les motifs mais pas copiés : liens, hors dépôt, déjà présents. */
  skipped: number
  /** Plafond atteint : fichiers restants non copiés. */
  truncated: number
  /** Une copie a échoué (lecture, écriture) : le premier message d'erreur. */
  error?: string
}

export type SetupState =
  /** Copie en cours, ou commande lancée. */
  | 'running'
  /** Commande réussie (ou rien à lancer : copie seule). */
  | 'done'
  /** Commande sortie en erreur, arrêtée au délai, ou impossible à lancer. */
  | 'failed'
  /** Commande du dépôt pas encore autorisée (ou modifiée depuis l'accord). */
  | 'approval'
  /** « Continuer sans préparer » : la commande n'a pas été lancée. */
  | 'skipped'

export interface WorktreeSetup {
  copy?: IncludedCopy
  /** Commande `setup` du projet, s'il y en a une. */
  command?: string
  state: SetupState
  /** Code de sortie (échec) ; absent si arrêtée au délai ou jamais lancée. */
  exitCode?: number
  /** Arrêtée au bout de `SETUP_TIMEOUT_MS`. */
  timedOut?: boolean
  /** Erreur de lancement (shell introuvable…). */
  error?: string
  /** Début et fin de la commande (ISO). */
  startedAt?: string
  endedAt?: string
  /** Fin de la sortie (stdout et stderr mêlés), sans séquences ANSI. */
  output?: string
  /**
   * Messages de l'utilisateur retenus : en attendant l'accord (ou « Continuer sans préparer »), ou
   * pendant que la commande tourne (ou « Arrêter », « Continuer sans attendre »).
   */
  held?: number
  /** Commande `archive` du projet, lancée avant la suppression du worktree : l'accord la couvre. */
  archive?: string
  /**
   * Empreinte des commandes montrées (état « à autoriser ») : le renderer la renvoie avec
   * « Autoriser », et rien ne tourne si le fichier a changé entre-temps.
   */
  signature?: string
  /** Le fichier a changé entre l'affichage et l'accord : nouvelles commandes, accord redemandé. */
  changed?: boolean
  /** Échec : la commande a été arrêtée par l'utilisateur (« Arrêter »). */
  stopped?: boolean
  /** « Continuer sans attendre » : les messages sont partis pendant que la commande tourne. */
  proceeded?: boolean
  /** Exécution sans surveillance (tâche planifiée) : non lancée faute d'accord, sans l'attendre. */
  unattended?: boolean
}

/** `.bobine/worktree.json` lu ; champs mal formés ignorés, commandes vides retirées. */
export function parseWorktreeConfig(raw: unknown): WorktreeConfig {
  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const command = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const setup = command(obj['setup'])
  const archive = command(obj['archive'])
  return { ...(setup ? { setup } : {}), ...(archive ? { archive } : {}) }
}

/** La config a-t-elle une commande à autoriser ? */
export const hasCommands = (config: WorktreeConfig): boolean => !!(config.setup || config.archive)

/**
 * Texte dont l'empreinte porte l'accord : les deux commandes telles quelles. Toute modification
 * de l'une ou l'autre redemande l'accord.
 */
export function configSignature(config: WorktreeConfig): string {
  return JSON.stringify([config.setup ?? '', config.archive ?? ''])
}

/** Sans les séquences d'échappement des terminaux (couleurs, effacements, titres). */
export function stripAnsi(text: string): string {
  return text.replace(
    /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[@-Z\\-_]/g,
    ''
  )
}

/** Fin de la sortie : retours chariot résolus (barres de progression), 80 lignes, 8 000 signes. */
export function tailOutput(text: string): string {
  const lines = stripAnsi(text)
    .split('\n')
    .map((line) => {
      const parts = line.replace(/\r+$/, '').split('\r')
      return parts[parts.length - 1] ?? ''
    })
  const tail = lines.slice(-OUTPUT_TAIL_LINES).join('\n')
  return tail.length > OUTPUT_TAIL_CHARS ? tail.slice(-OUTPUT_TAIL_CHARS) : tail
}

/**
 * Ligne de contexte jointe au premier message quand la préparation n'a pas abouti (en anglais,
 * pour l'agent : ADR-0014). `undefined` si tout va bien.
 */
export function setupContext(setup: WorktreeSetup | undefined): string | undefined {
  if (!setup?.command) return undefined
  if (setup.state === 'failed') {
    const why = setup.stopped
      ? 'was stopped by the user before it finished'
      : setup.timedOut
        ? 'was stopped after timing out'
        : setup.exitCode !== undefined
          ? `failed with exit code ${setup.exitCode}`
          : 'could not be started'
    return `Note: this worktree's setup command \`${setup.command}\` ${why}; dependencies or generated files may be missing. Its output is shown to the user in the app.`
  }
  if (setup.state === 'skipped' && setup.unattended) {
    return `Note: this worktree's setup command \`${setup.command}\` was not run (this is an unattended run and the user has not approved the command); dependencies or generated files may be missing.`
  }
  if (setup.state === 'skipped') {
    return `Note: this worktree's setup command \`${setup.command}\` was not run (the user chose to continue without it); dependencies or generated files may be missing.`
  }
  if (setup.state === 'approval') {
    return `Note: this worktree's setup command \`${setup.command}\` has not been run yet (it awaits the user's approval); dependencies may be missing.`
  }
  if (setup.state === 'running' && setup.proceeded) {
    return `Note: this worktree's setup command \`${setup.command}\` is still running (the user chose not to wait for it); dependencies or generated files may not be ready yet.`
  }
  return undefined
}

/** Durée de la commande en secondes (arrondie), si elle est finie. */
export function setupSeconds(setup: WorktreeSetup): number | undefined {
  if (!setup.startedAt || !setup.endedAt) return undefined
  const ms = Date.parse(setup.endedAt) - Date.parse(setup.startedAt)
  return Number.isFinite(ms) && ms >= 0 ? Math.max(1, Math.round(ms / 1000)) : undefined
}

/** Élément `worktree-setup` du fil : un seul, remplacé à chaque étape (son numéro gardé). */
export function reduceWorktreeSetup(state: TranscriptState, setup: WorktreeSetup): TranscriptState {
  const index = state.items.findLastIndex((i) => i.kind === 'worktree-setup')
  const current = state.items[index]
  if (!current) {
    const item: TranscriptItem = { kind: 'worktree-setup', id: state.nextId, ...setup }
    return { ...state, items: [...state.items, item], nextId: state.nextId + 1 }
  }
  const items = state.items.slice()
  items[index] = { kind: 'worktree-setup', id: current.id, ...setup }
  return { ...state, items }
}
