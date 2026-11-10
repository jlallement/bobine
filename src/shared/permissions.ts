/**
 * « Toujours autoriser » d'une conversation à l'autre (fiche 042). Un agent comme Bob ne garde ce
 * choix que pour la tâche en cours : l'app le retient, par agent et par outil, pour les outils qui
 * ne touchent ni aux fichiers ni aux commandes (ex. « Updating todo list » de Bob, un outil MCP).
 */
import { t, type ParseKeys } from 'i18next'
import type { PermissionOption, PermissionOptionKind } from './acp-sdk.mts'

/** Genres d'outils jamais retenus : ils modifient des fichiers ou lancent des commandes. */
const UNSAFE_KINDS = new Set(['edit', 'delete', 'move', 'execute'])

/** Un chemin dans le titre : l'autorisation porterait sur un fichier précis, pas sur un outil. */
const PATH_IN_TITLE = /(^|[\s"'(`])(\/|~\/|\.\.?\/)\S|[A-Za-z]:\\/

/**
 * Titre sous lequel retenir l'autorisation, ou `undefined` si cet appel ne doit jamais être
 * autorisé d'office d'une conversation à l'autre.
 */
export function rememberableTool(toolCall: {
  title?: string | null
  kind?: string | null
}): string | undefined {
  const title = toolCall.title?.trim()
  if (!title || title.length > 200) return undefined
  if (toolCall.kind && UNSAFE_KINDS.has(toolCall.kind)) return undefined
  if (PATH_IN_TITLE.test(title)) return undefined
  return title
}

/** Demande d'autorisation d'un outil, telle que le fil la garde. */
export interface ToolPermission {
  requestId: string
  options: PermissionOption[]
  state: 'pending' | 'cancelled' | { optionId: string; name: string; kind: PermissionOptionKind }
  /** Repérés par le main (fiche 211) ; absent dans les conversations enregistrées avant. */
  risks?: PermissionRisk[]
}

/**
 * Ce qu'une demande d'autorisation a de risqué (fiche 211), calculé dans le main
 * (`permission-risk.ts`) et montré en bandeau sur la carte. Un avertissement, jamais une
 * garantie : une liste vide ne dit pas que l'appel est sûr. Un chemin n'y figure qu'une fois, avec
 * sa raison la plus précise (système, puis fichier caché du dossier personnel, puis hors du
 * dossier). Les chemins sont des chaînes d'affichage (`~` pour le dossier personnel), passées par
 * `visibleText` à l'affichage.
 */
export type PermissionRisk =
  /** Écrit (ou modifie, supprime) hors du dossier de la conversation. */
  | { kind: 'outside-folder'; path: string }
  /** Écrit dans un fichier ou dossier caché du dossier personnel (`~/.zshrc`, `~/.ssh/…`), hors du dossier. */
  | { kind: 'home-dotfile'; path: string }
  /** Écrit dans un dossier du système (`/etc`, `/usr`, `/var`, `/Library`…). */
  | { kind: 'system-path'; path: string }
  /** Demande les droits d'administrateur. */
  | { kind: 'privilege'; via: PrivilegeCommand }

/** Commandes qui demandent les droits d'administrateur, signalées sur la carte. */
export const PRIVILEGE_COMMANDS = ['sudo', 'su', 'doas', 'pkexec'] as const
export type PrivilegeCommand = (typeof PRIVILEGE_COMMANDS)[number]

/**
 * Autorisation en attente, avec ses risques s'il y en a : une demande sans risque n'en porte pas
 * la clé (le fil reste celui d'avant la fiche 211).
 */
export const pendingWith = (
  risks: PermissionRisk[] | undefined
): { state: 'pending'; risks?: PermissionRisk[] } =>
  risks?.length ? { state: 'pending', risks } : { state: 'pending' }

/** Genres d'option d'autorisation d'ACP, traduits par l'app (recette 0.11, C5). */
const OPTION_KINDS = ['allow_once', 'allow_always', 'reject_once', 'reject_always'] as const
type OptionKind = (typeof OPTION_KINDS)[number]
const OPTION_KEYS = {
  allow_once: 'permissionOption.allow_once',
  allow_always: 'permissionOption.allow_always',
  reject_once: 'permissionOption.reject_once',
  reject_always: 'permissionOption.reject_always'
} as const satisfies Record<OptionKind, string>

/**
 * Libellé d'une option d'autorisation : celui de l'app pour son genre ACP (« Autoriser une fois »…)
 * quand ce genre est connu et n'apparaît qu'une fois parmi les options de la demande ; sinon le nom
 * donné par l'agent (deux options du même genre ne se distinguent que par lui). Générique ACP.
 * `siblings` absent (réponse déjà donnée, seule l'option retenue est connue) : le genre suffit.
 */
export function permissionOptionLabel(
  option: { kind: string; name: string },
  siblings?: readonly { kind: string }[]
): { key: (typeof OPTION_KEYS)[OptionKind] } | { text: string } {
  const kind = OPTION_KINDS.find((k) => k === option.kind)
  const unique = !siblings || siblings.filter((o) => o.kind === option.kind).length === 1
  return kind && unique ? { key: OPTION_KEYS[kind] } : { text: option.name }
}

/**
 * Titres d'outils que des agents envoient en anglais et que l'app sait dire dans la langue de
 * l'interface (fiche 214) : Bob titre sa liste de tâches « Updating todo list ». Clé : le titre en
 * minuscules. Un titre inconnu reste tel que l'agent l'a écrit (rien n'est deviné).
 */
const KNOWN_TOOL_TITLES = {
  'updating todo list': 'settings.privacy.tools.known.todoList'
} as const

/**
 * Texte d'un outil « toujours autorisé » dans Réglages : sa traduction si le titre est connu, sinon
 * le titre de l'agent. Pour l'affichage seulement : l'outil retenu, et révoqué, reste désigné par
 * son titre exact.
 */
export function rememberedToolText(title: string): string {
  const key = (KNOWN_TOOL_TITLES as Record<string, ParseKeys | undefined>)[
    title.trim().toLowerCase()
  ]
  return key ? t(key) : title
}
