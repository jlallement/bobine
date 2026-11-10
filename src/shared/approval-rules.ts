/**
 * Règles d'approbation globales d'un agent (fiche 215, ADR-0044) : ce que l'interface en voit et
 * ce qu'elle peut demander d'y changer. Seul Bob les déclare aujourd'hui (`~/.bob/settings/
 * settings.json`, section `approval`, format documenté par IBM : « approval settings »), partagées
 * avec Bob IDE et Bob Shell. Le main lit et écrit le fichier ; le renderer ne voit que ces types.
 */

/** Groupes d'outils de Bob (documentation IBM, « approval settings »). */
export const APPROVAL_GROUPS = [
  'read',
  'edit',
  'execute',
  'mcp',
  'skill',
  'todo',
  'subtask',
  'subagent',
  'mode'
] as const
export type ApprovalGroup = (typeof APPROVAL_GROUPS)[number]

export const isApprovalGroup = (value: unknown): value is ApprovalGroup =>
  typeof value === 'string' && (APPROVAL_GROUPS as readonly string[]).includes(value)

/**
 * Commandes autorisées par Bob 2.0.9 quand `allowedExecutors` est absent : la liste que Bob IDE
 * recopie dans le fichier à la première règle ajoutée (vu le 2026-11-09, fiche 213 ; exemple de la
 * documentation IBM, https://bob.ibm.com/docs/shell/configuration/approval-settings). Recopiées
 * avant la première modification, comme le fait Bob IDE : écrire la clé avec une seule commande
 * effacerait cette liste (vu le 2026-11-09).
 */
export const BOB_DEFAULT_ALLOWED_COMMANDS: readonly string[] = [
  'cat',
  'git diff',
  'git log',
  'git rev-parse',
  'git show',
  'git status',
  'grep',
  'head',
  'tail',
  'ls',
  'sort',
  'wc',
  'which',
  'du',
  'df'
]

/** Groupes permis quand `allowed_permissions` est absent (défaut de Bob 2.0.9). */
export const BOB_DEFAULT_GROUPS: readonly ApprovalGroup[] = ['read']

/** Longueur maximale d'un préfixe de commande accepté. */
export const MAX_COMMAND_PREFIX = 1000

export interface ApprovalGroupView {
  id: ApprovalGroup
  /** Permis pour toutes les tâches (`allowed_permissions`). */
  enabled: boolean
  /** Interdit par l'administration (`forbiddenApprovalGroups`) : ne peut pas être permis. */
  forbidden: boolean
  /** `permissionOptions[groupId].enableOutsideWorkspace` (absent : non). */
  outsideWorkspace: boolean
}

/** Règles globales lues dans le fichier de l'agent. */
export interface ApprovalRulesView {
  profileId: string
  /** Fichier, `~` pour le dossier personnel (affichage). */
  file: string
  /** Le fichier existe. */
  exists: boolean
  groups: ApprovalGroupView[]
  /** `allowed_permissions` absent : défaut de l'agent (`read`). */
  defaultGroups: boolean
  /** Groupes de `allowed_permissions` inconnus de Bobine, gardés tels quels. */
  otherGroups: string[]
  commands: {
    allowed: string[]
    denied: string[]
    /** `allowedExecutors` absent : `allowed` est la liste par défaut de l'agent. */
    defaultList: boolean
  }
  /** `outsideWorkspaceAllowed` : les outils peuvent travailler hors du dossier. */
  outsideWorkspaceAllowed: boolean
  /**
   * `autoApprovalEnabled` (lu seulement) : faux, l'agent n'approuve plus rien de lui-même, ni
   * groupe ni commande de la liste. L'interface peut le dire.
   */
  autoApprovalEnabled: boolean
  /** `forbiddenApprovalGroups`, tel quel (lu seulement, jamais écrit par Bobine). */
  forbiddenGroups: string[]
}

/** Liste de commandes d'une règle. */
export type CommandList = 'allowed' | 'denied'

/** Changement demandé par l'utilisateur, toujours sur une action explicite (ADR-0044). */
export type ApprovalRulesChange =
  /**
   * « Autoriser cette commande partout » (carte) : ajoute aux autorisées, retire des refusées et,
   * si besoin, permet aussi le groupe `execute` (sans lui la liste n'a aucun effet).
   */
  | { type: 'allowCommandEverywhere'; prefix: string }
  /** Ajoute une commande à une liste (et la retire de l'autre), sans toucher aux groupes. */
  | { type: 'addCommand'; prefix: string; list: CommandList }
  /** Retire une commande d'une liste. */
  | { type: 'removeCommand'; prefix: string; list: CommandList }
  | { type: 'setGroup'; group: ApprovalGroup; enabled: boolean }
  | { type: 'setOutsideWorkspaceAllowed'; enabled: boolean }
  | { type: 'setGroupOutsideWorkspace'; group: ApprovalGroup; enabled: boolean }

export type ApprovalRulesErrorCode =
  /** Le profil ne déclare pas de règles d'approbation. */
  | 'unsupported'
  /** Fichier impossible à lire (droits, disque). */
  | 'unreadable'
  /** Pas du JSON (ou JSON avec commentaires, que l'agent ne lirait pas). */
  | 'invalid-json'
  /** JSON, mais une clé attendue n'a pas le type documenté (`detail` : la clé). */
  | 'unexpected-format'
  /** Groupe interdit par l'administration (`forbiddenApprovalGroups`). */
  | 'forbidden-group'
  /** Préfixe vide ou trop long. */
  | 'invalid-command'
  /** Fichier modifié par un autre outil à chaque essai : rien écrit. */
  | 'changed'
  /** Écriture impossible (droits, disque plein). */
  | 'write-failed'

export interface ApprovalRulesError {
  code: ApprovalRulesErrorCode
  /** Fichier en cause (affichage, `~`). */
  file?: string
  /** Précision technique (clé en cause, message du système), non traduite. */
  detail?: string
  /** JSON invalide : ligne de la première erreur (1 pour la première). */
  line?: number
}

/** Ce que l'interface doit dire après un changement. */
export interface ApprovalRulesNotice {
  /** Préfixe tel qu'écrit (normalisé). */
  prefix?: string
  /** Préfixe d'un seul mot (`git`) : il couvre toutes les commandes qui commencent ainsi. */
  singleWord?: boolean
  /**
   * « Autoriser partout » : `added` la première fois (le groupe `execute` vient d'être permis pour
   * tous les projets, l'interface le dit), `already` s'il l'était, `forbidden` si l'administration
   * l'interdit (la commande est dans la liste, mais Bob demandera quand même).
   */
  executeGroup?: 'added' | 'already' | 'forbidden'
  /** Rien n'a changé (règle déjà en place) : le fichier n'a pas été réécrit. */
  unchanged?: boolean
}

export type ApprovalRulesRead =
  { ok: true; rules: ApprovalRulesView } | { ok: false; error: ApprovalRulesError }

export type ApprovalRulesResult =
  | { ok: true; rules: ApprovalRulesView; notice: ApprovalRulesNotice }
  | { ok: false; error: ApprovalRulesError }

/**
 * Préfixe de commande tel qu'il sera écrit : espaces de début et de fin retirés, suites
 * d'espaces (tabulations, retours à la ligne) réduites à une espace. `undefined` : vide ou trop
 * long. `singleWord` : un seul mot, à signaler (rapport PromptArmor : un préfixe large peut servir
 * à lancer d'autres commandes).
 */
export function normalizeCommandPrefix(
  input: string
): { prefix: string; singleWord: boolean } | undefined {
  const prefix = input.trim().replace(/\s+/g, ' ')
  if (!prefix || prefix.length > MAX_COMMAND_PREFIX) return undefined
  return { prefix, singleWord: !prefix.includes(' ') }
}

const LISTS: readonly CommandList[] = ['allowed', 'denied']

/**
 * Changement venu du renderer : rendu seulement s'il a exactement la forme attendue (le main ne
 * fait confiance qu'à ce qu'il vérifie). `undefined` sinon.
 */
export function parseApprovalRulesChange(value: unknown): ApprovalRulesChange | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const v = value as Record<string, unknown>
  const prefix = typeof v['prefix'] === 'string' ? v['prefix'] : undefined
  const enabled = typeof v['enabled'] === 'boolean' ? v['enabled'] : undefined
  const list = LISTS.find((l) => l === v['list'])
  const group = isApprovalGroup(v['group']) ? v['group'] : undefined
  switch (v['type']) {
    case 'allowCommandEverywhere':
      return prefix === undefined ? undefined : { type: 'allowCommandEverywhere', prefix }
    case 'addCommand':
    case 'removeCommand':
      return prefix === undefined || !list ? undefined : { type: v['type'], prefix, list }
    case 'setGroup':
    case 'setGroupOutsideWorkspace':
      return !group || enabled === undefined ? undefined : { type: v['type'], group, enabled }
    case 'setOutsideWorkspaceAllowed':
      return enabled === undefined ? undefined : { type: 'setOutsideWorkspaceAllowed', enabled }
    default:
      return undefined
  }
}

/** Mots d'une commande ou d'une règle, comme Bob les compare (espaces quelconques). */
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean)

/** Nombre de mots de la plus longue règle qui commence la commande (mot à mot) ; -1 : aucune. */
function longestRule(command: readonly string[], rules: readonly string[]): number {
  let best = -1
  for (const rule of rules) {
    const r = words(rule)
    if (r.length === 0 || r.length > command.length) continue
    if (r.every((w, i) => w === command[i]) && r.length > best) best = r.length
  }
  return best
}

/**
 * Ce que les listes de Bob décident déjà pour une commande (une partie d'une commande enchaînée),
 * comme le documente IBM (« approval settings ») et comme vu sur Bob 2.0.9 : une règle couvre la commande si ses mots en
 * sont les premiers (`wc` couvre `wc -l x`, pas `wcx`) ; la plus longue gagne, égalité =
 * autorisée. `undefined` : aucune règle, Bob demande.
 */
export function commandCoverage(
  command: string,
  allowed: readonly string[],
  denied: readonly string[]
): 'allowed' | 'denied' | undefined {
  const cmd = words(command)
  if (cmd.length === 0) return undefined
  const allow = longestRule(cmd, allowed)
  const deny = longestRule(cmd, denied)
  if (allow < 0 && deny < 0) return undefined
  return allow >= deny ? 'allowed' : 'denied'
}

/**
 * Première partie d'une commande (enchaînée ou non) que les listes de l'agent refusent partout
 * (`commandCoverage`), ou `undefined`. Sert aux outils de l'app qui lancent des commandes : une
 * commande refusée partout ne passe pas non plus par eux (recette QA de la fiche 213).
 */
export function deniedPart(
  command: string,
  lists: { allowed: readonly string[]; denied: readonly string[] },
  workspace?: string
): string | undefined {
  return commandParts(command, workspace).find(
    (part) => commandCoverage(part, lists.allowed, lists.denied) === 'denied'
  )
}

/** Séparateurs de commandes que Bob compare une à une (`&&`, `||`, `;`, `|`, retour à la ligne). */
const SEPARATORS = ['&&', '||', ';', '|', '\n']

/**
 * Parties d'une commande enchaînée, telles que Bob les compare une à une à ses listes (fiche 215,
 * décision Q6) : la commande entière ne correspondrait jamais à une règle. Un `cd` vers le dossier
 * de la conversation (`workspace`) est ignoré : il ne dit rien de ce qu'on autorise. Guillemets
 * (simples, doubles) et échappement respectés : `git commit -m "feat(x): a && b"` est une seule
 * partie. Seule une construction réellement ambiguë rend la commande entière (Bobine ne devine pas
 * comment Bob la découperait) : guillemet non fermé, substitution (`$( … )`, accents graves, même
 * entre guillemets doubles), sous-shell ou `<( … )` / `>( … )` hors guillemets.
 */
export function commandParts(command: string, workspace?: string): string[] {
  const whole = command.trim()
  if (!whole) return []
  const parts: string[] = []
  let current = ''
  let quote: '"' | "'" | undefined
  for (let i = 0; i < whole.length; i++) {
    const c = whole[i] ?? ''
    // Entre guillemets simples, rien n'est spécial jusqu'au guillemet fermant.
    if (quote === "'") {
      if (c === "'") quote = undefined
      current += c
      continue
    }
    // Caractère échappé : gardé tel quel, jamais pris pour un séparateur ou un guillemet.
    if (c === '\\') {
      current += c + (whole[i + 1] ?? '')
      i++
      continue
    }
    // Substitution de commande, même entre guillemets doubles.
    if (c === '`' || (c === '$' && whole[i + 1] === '(')) return [whole]
    if (quote === '"') {
      if (c === '"') quote = undefined
      current += c
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      current += c
      continue
    }
    // Sous-shell, `<( … )`, `>( … )` hors guillemets.
    if (c === '(' || c === ')') return [whole]
    const sep = SEPARATORS.find((s) => whole.startsWith(s, i))
    if (sep) {
      parts.push(current)
      current = ''
      i += sep.length - 1
      continue
    }
    current += c
  }
  if (quote) return [whole]
  parts.push(current)
  const cleaned = parts.map((p) => p.trim().replace(/\s+/g, ' ')).filter(Boolean)
  const kept = cleaned.filter((p) => !isCdTo(p, workspace))
  return kept.length > 0 ? [...new Set(kept)] : [whole]
}

/** `cd` vers le dossier de la conversation (`cd <dossier>`, entre guillemets ou non, `cd .`). */
function isCdTo(part: string, workspace: string | undefined): boolean {
  const match = /^cd\s+(.+)$/.exec(part)
  if (!match?.[1]) return false
  const target = match[1].replace(/^(['"])(.*)\1$/, '$2').replace(/(.)\/+$/, '$1')
  if (target === '.') return true
  return !!workspace && target === workspace.replace(/(.)\/+$/, '$1')
}
