/**
 * Règles d'approbation de Bob (fiche 215, ADR-0044) : section `approval` de
 * `~/.bob/settings/settings.json`, partagée avec Bob IDE et Bob Shell. Format documenté par IBM
 * (« approval settings », https://bob.ibm.com/docs/shell/configuration/approval-settings) ;
 * valeurs par défaut et façon d'écrire de Bob IDE constatées sur Bob 2.0.9 et Bob IDE 2.3.0
 * (fiche 213).
 *
 * Le fichier est à l'utilisateur et à Bob : Bobine n'y écrit que sur une action explicite, ne
 * change que les clés en cause (le reste, clés inconnues, ordre et mise en forme compris, est gardé
 * par `jsonc-parser`), écrit d'un coup après une copie de sauvegarde, et refuse d'écrire un
 * fichier qu'elle ne comprend pas. `forbiddenApprovalGroups` (clé d'administration) n'est jamais
 * écrit.
 */
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  applyEdits,
  modify,
  parse,
  printParseErrorCode,
  type JSONPath,
  type ParseError
} from 'jsonc-parser'
import {
  APPROVAL_GROUPS,
  BOB_DEFAULT_ALLOWED_COMMANDS,
  BOB_DEFAULT_GROUPS,
  normalizeCommandPrefix,
  type ApprovalGroup,
  type ApprovalRulesChange,
  type ApprovalRulesError,
  type ApprovalRulesNotice,
  type ApprovalRulesRead,
  type ApprovalRulesResult,
  type ApprovalRulesView,
  type CommandList
} from '@shared/approval-rules'
import { log } from '../log'
import { writeFileAtomic } from '../storage'
import { FORMATTING } from './config-prune'
import type { ApprovalRulesHooks, ApprovalRulesSource, ApprovalRulesStore } from './approval-rules'

/** Outil de Bob dont les commandes sont réglées par `allowedExecutors`. */
export const EXECUTE_TOOL = 'execute_command'

/** Copie de sauvegarde, à côté du fichier ; pas `settings.json.bak`, que Bob IDE utilise. */
export const BACKUP_SUFFIX = '.bobine.bak'

/** Essais d'écriture quand le fichier change entre la lecture et l'écriture. */
const ATTEMPTS = 3

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'string')

/** Contenu relu et compris du fichier (`text` vide : fichier absent). */
interface Parsed {
  exists: boolean
  text: string
  data: Json
  approval: Json
}

type Failure = { error: ApprovalRulesError }

/**
 * Lit le texte comme Bob : JSON simple. Un commentaire ou une virgule de trop, que Bob ne lirait
 * pas, rendent le fichier invalide : il n'est alors jamais réécrit.
 */
export function parseSettings(text: string, exists: boolean): Parsed | Failure {
  if (!exists) return { exists, text: '', data: {}, approval: {} }
  const errors: ParseError[] = []
  const data: unknown = parse(text, errors, {
    disallowComments: true,
    allowTrailingComma: false,
    allowEmptyContent: false
  })
  if (errors.length > 0) {
    const first = errors[0]
    // Ligne de la première erreur, pour que l'utilisateur sache où corriger.
    const line = first ? text.slice(0, first.offset).split('\n').length : undefined
    return {
      error: {
        code: 'invalid-json',
        ...(first ? { detail: printParseErrorCode(first.error), line } : {})
      }
    }
  }
  if (!isObject(data)) return { error: { code: 'unexpected-format', detail: '(racine)' } }
  const approval = data['approval']
  if (approval === undefined) return { exists, text, data, approval: {} }
  if (!isObject(approval)) return { error: { code: 'unexpected-format', detail: 'approval' } }
  const bad = badKey(approval)
  if (bad) return { error: { code: 'unexpected-format', detail: `approval.${bad}` } }
  return { exists, text, data, approval }
}

/** Première clé de `approval` lue par Bobine dont le type n'est pas celui documenté. */
function badKey(approval: Json): string | undefined {
  const optional = (key: string, ok: (v: unknown) => boolean) =>
    approval[key] !== undefined && !ok(approval[key]) ? key : undefined
  const bool = (v: unknown) => typeof v === 'boolean'
  return (
    optional('allowed_permissions', isStringList) ??
    optional('forbiddenApprovalGroups', isStringList) ??
    optional('outsideWorkspaceAllowed', bool) ??
    optional('autoApprovalEnabled', bool) ??
    listKey(approval, 'allowedExecutors', (entry) =>
      typeof entry['toolId'] !== 'string'
        ? 'toolId'
        : (['approvedCommands', 'deniedCommands'] as const).find(
            (k) => entry[k] !== undefined && !isStringList(entry[k])
          )
    ) ??
    listKey(approval, 'permissionOptions', (entry) =>
      typeof entry['groupId'] !== 'string'
        ? 'groupId'
        : entry['enableOutsideWorkspace'] !== undefined &&
            typeof entry['enableOutsideWorkspace'] !== 'boolean'
          ? 'enableOutsideWorkspace'
          : undefined
    )
  )
}

/** Clé tableau d'objets : la première entrée mal formée (`clé[i].champ`). */
function listKey(
  approval: Json,
  key: string,
  badField: (entry: Json) => string | undefined
): string | undefined {
  const list = approval[key]
  if (list === undefined) return undefined
  if (!Array.isArray(list)) return key
  for (const [i, entry] of list.entries()) {
    if (!isObject(entry)) return `${key}[${i}]`
    const field = badField(entry)
    if (field) return `${key}[${i}].${field}`
  }
  return undefined
}

/** Règles en vigueur pour Bob, défauts compris (le fichier a été validé). */
interface Effective {
  groups: string[]
  defaultGroups: boolean
  forbidden: string[]
  /** Position de l'entrée `execute_command` dans `allowedExecutors` ; -1 : pas d'entrée. */
  executorIndex: number
  /** `allowedExecutors` absent : liste par défaut de Bob. */
  defaultList: boolean
  allowed: string[]
  denied: string[]
  outsideWorkspaceAllowed: boolean
  autoApprovalEnabled: boolean
  options: Json[]
}

function effective(approval: Json): Effective {
  const groups = approval['allowed_permissions'] as string[] | undefined
  const executors = approval['allowedExecutors'] as Json[] | undefined
  const executorIndex = executors ? executors.findIndex((e) => e['toolId'] === EXECUTE_TOOL) : -1
  const entry = executors?.[executorIndex]
  return {
    groups: [...(groups ?? BOB_DEFAULT_GROUPS)],
    defaultGroups: groups === undefined,
    forbidden: [...((approval['forbiddenApprovalGroups'] as string[] | undefined) ?? [])],
    executorIndex,
    defaultList: executors === undefined,
    // Une entrée sans liste vaut une liste vide (comme `getToolCommandApprovals` de Bob IDE).
    allowed: executors
      ? [...((entry?.['approvedCommands'] as string[] | undefined) ?? [])]
      : [...BOB_DEFAULT_ALLOWED_COMMANDS],
    denied: [...((entry?.['deniedCommands'] as string[] | undefined) ?? [])],
    outsideWorkspaceAllowed: approval['outsideWorkspaceAllowed'] === true,
    autoApprovalEnabled: approval['autoApprovalEnabled'] !== false,
    options: [...((approval['permissionOptions'] as Json[] | undefined) ?? [])]
  }
}

export function rulesView(
  parsed: Parsed,
  profileId: string,
  displayFile: string
): ApprovalRulesView {
  const e = effective(parsed.approval)
  const outside = (group: string) =>
    e.options.find((o) => o['groupId'] === group)?.['enableOutsideWorkspace'] === true
  return {
    profileId,
    file: displayFile,
    exists: parsed.exists,
    groups: APPROVAL_GROUPS.map((id) => ({
      id,
      enabled: e.groups.includes(id),
      forbidden: e.forbidden.includes(id),
      outsideWorkspace: outside(id)
    })),
    defaultGroups: e.defaultGroups,
    otherGroups: e.groups.filter((g) => !(APPROVAL_GROUPS as readonly string[]).includes(g)),
    commands: { allowed: e.allowed, denied: e.denied, defaultList: e.defaultList },
    outsideWorkspaceAllowed: e.outsideWorkspaceAllowed,
    autoApprovalEnabled: e.autoApprovalEnabled,
    forbiddenGroups: e.forbidden
  }
}

/** Modifications d'un changement : chemin JSON → valeur, dans l'ordre. */
type Edit = { path: JSONPath; value: unknown; insert?: boolean }

interface Plan {
  edits: Edit[]
  notice: ApprovalRulesNotice
}

const same = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i])

/** Même commande, aux espaces près (une entrée écrite à la main peut en avoir de trop). */
const sameCommand = (a: string, b: string) => normalizeCommandPrefix(a)?.prefix === b

/**
 * Ajoute (`add`) ou retire une commande d'une liste. Comme Bob IDE : l'ajouter à une liste la
 * retire de l'autre ; quand `allowedExecutors` est absent, la liste par défaut de Bob est écrite
 * avec (sans quoi Bob l'oublierait).
 */
function commandEdits(e: Effective, prefix: string, list: CommandList, add: boolean): Edit[] {
  const lists = { allowed: e.allowed, denied: e.denied }
  const other: CommandList = list === 'allowed' ? 'denied' : 'allowed'
  const next = { ...lists }
  if (add) {
    if (!lists[list].some((c) => sameCommand(c, prefix))) next[list] = [...lists[list], prefix]
    next[other] = lists[other].filter((c) => !sameCommand(c, prefix))
  } else {
    next[list] = lists[list].filter((c) => !sameCommand(c, prefix))
  }
  if (same(next.allowed, lists.allowed) && same(next.denied, lists.denied)) return []
  const entry = {
    toolId: EXECUTE_TOOL,
    approvedCommands: next.allowed,
    deniedCommands: next.denied
  }
  if (e.defaultList) return [{ path: ['approval', 'allowedExecutors'], value: [entry] }]
  if (e.executorIndex === -1) {
    return [{ path: ['approval', 'allowedExecutors', -1], value: entry, insert: true }]
  }
  const at = ['approval', 'allowedExecutors', e.executorIndex]
  return [
    ...(same(next.allowed, lists.allowed)
      ? []
      : [{ path: [...at, 'approvedCommands'], value: next.allowed }]),
    ...(same(next.denied, lists.denied)
      ? []
      : [{ path: [...at, 'deniedCommands'], value: next.denied }])
  ]
}

/** Permet ou retire un groupe ; `read` recopié quand la clé est absente (défaut de Bob). */
function groupEdits(e: Effective, group: ApprovalGroup, enabled: boolean): Edit[] {
  const next = enabled
    ? e.groups.includes(group)
      ? e.groups
      : [...e.groups, group]
    : e.groups.filter((g) => g !== group)
  return same(next, e.groups) ? [] : [{ path: ['approval', 'allowed_permissions'], value: next }]
}

function outsideEdits(e: Effective, group: ApprovalGroup, enabled: boolean): Edit[] {
  const at = e.options.findIndex((o) => o['groupId'] === group)
  const current = e.options[at]?.['enableOutsideWorkspace'] === true
  if (current === enabled) return []
  if (at >= 0) {
    return [
      { path: ['approval', 'permissionOptions', at, 'enableOutsideWorkspace'], value: enabled }
    ]
  }
  return [
    {
      path: ['approval', 'permissionOptions', -1],
      value: { groupId: group, enableOutsideWorkspace: true },
      insert: true
    }
  ]
}

/** Ce qu'un changement modifie dans le fichier, ou pourquoi il est refusé. */
export function planChange(approval: Json, change: ApprovalRulesChange): Plan | Failure {
  const e = effective(approval)
  switch (change.type) {
    case 'allowCommandEverywhere':
    case 'addCommand':
    case 'removeCommand': {
      const normalized = normalizeCommandPrefix(change.prefix)
      if (!normalized) return { error: { code: 'invalid-command' } }
      const { prefix, singleWord } = normalized
      const list = change.type === 'allowCommandEverywhere' ? 'allowed' : change.list
      const edits = commandEdits(e, prefix, list, change.type !== 'removeCommand')
      if (change.type !== 'allowCommandEverywhere') {
        return { edits, notice: { prefix, singleWord } }
      }
      // Sans le groupe `execute` permis, la liste n'a aucun effet (vu dans Bob IDE, fiche 213).
      const executeGroup = e.forbidden.includes('execute')
        ? 'forbidden'
        : e.groups.includes('execute')
          ? 'already'
          : 'added'
      return {
        edits: [...edits, ...(executeGroup === 'added' ? groupEdits(e, 'execute', true) : [])],
        notice: { prefix, singleWord, executeGroup }
      }
    }
    case 'setGroup':
      // Jamais un groupe que l'administration interdit (ADR-0044) ; le couper reste possible.
      if (change.enabled && e.forbidden.includes(change.group)) {
        return { error: { code: 'forbidden-group', detail: change.group } }
      }
      return { edits: groupEdits(e, change.group, change.enabled), notice: {} }
    case 'setOutsideWorkspaceAllowed':
      return {
        edits:
          e.outsideWorkspaceAllowed === change.enabled
            ? []
            : [{ path: ['approval', 'outsideWorkspaceAllowed'], value: change.enabled }],
        notice: {}
      }
    case 'setGroupOutsideWorkspace':
      return { edits: outsideEdits(e, change.group, change.enabled), notice: {} }
  }
}

/** Applique les modifications au texte (fichier absent : `{}`), sans toucher au reste. */
export function applyPlan(text: string, edits: readonly Edit[]): string {
  let next = text.trim() ? text : '{}'
  for (const edit of edits) {
    next = applyEdits(
      next,
      modify(next, edit.path, edit.value, {
        formattingOptions: FORMATTING,
        ...(edit.insert ? { isArrayInsertion: true } : {})
      })
    )
  }
  return next.endsWith('\n') ? next : `${next}\n`
}

/** Lecture brute : texte (vide si absent) ou échec. */
type RawRead = { exists: boolean; text: string } | Failure

/** Les règles d'un fichier de Bob : lecture et changements sûrs. */
export class BobApprovalRules implements ApprovalRulesStore {
  private readonly file: string
  private readonly profileId: string
  private readonly displayFile: string
  private readonly hooks: ApprovalRulesHooks

  constructor(
    file: string,
    profileId: string,
    displayFile: string,
    hooks: ApprovalRulesHooks = {}
  ) {
    this.file = file
    this.profileId = profileId
    this.displayFile = displayFile
    this.hooks = hooks
  }

  read(): ApprovalRulesRead {
    const parsed = this.load()
    if ('error' in parsed) return { ok: false, error: this.located(parsed.error) }
    return { ok: true, rules: rulesView(parsed, this.profileId, this.displayFile) }
  }

  /**
   * Applique un changement. Le fichier est relu juste avant d'écrire : s'il a changé depuis la
   * lecture (Bob IDE qui écrit en même temps), le changement est refait sur la nouvelle version.
   */
  change(change: ApprovalRulesChange): ApprovalRulesResult {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const parsed = this.load()
      if ('error' in parsed) return { ok: false, error: this.located(parsed.error) }
      const plan = planChange(parsed.approval, change)
      if ('error' in plan) return { ok: false, error: this.located(plan.error) }
      if (plan.edits.length === 0) {
        return {
          ok: true,
          rules: rulesView(parsed, this.profileId, this.displayFile),
          notice: { ...plan.notice, unchanged: true }
        }
      }
      const next = applyPlan(parsed.text, plan.edits)
      // Garde-fou : jamais écrire un texte que Bob (ou Bobine) ne relirait pas.
      const after = parseSettings(next, true)
      if ('error' in after) return { ok: false, error: this.located(after.error) }
      this.hooks.beforeWrite?.()
      const now = this.raw()
      if ('error' in now) return { ok: false, error: this.located(now.error) }
      if (now.exists !== parsed.exists || now.text !== parsed.text) continue
      const written = this.write(parsed, next)
      if (written) return { ok: false, error: this.located(written.error) }
      log.info(`Règles d'approbation (${this.profileId}) : ${change.type} écrit`)
      return {
        ok: true,
        rules: rulesView(after, this.profileId, this.displayFile),
        notice: plan.notice
      }
    }
    log.warn(
      `Règles d'approbation (${this.profileId}) : fichier modifié à chaque essai, rien écrit`
    )
    return { ok: false, error: this.located({ code: 'changed' }) }
  }

  private located(error: ApprovalRulesError): ApprovalRulesError {
    return { ...error, file: this.displayFile }
  }

  private load(): Parsed | Failure {
    const raw = this.raw()
    return 'error' in raw ? raw : parseSettings(raw.text, raw.exists)
  }

  /**
   * Fichier réellement écrit : la cible d'un lien symbolique (fichiers de configuration suivis
   * ailleurs), jamais le lien remplacé par un fichier. Lien cassé : refusé.
   */
  private target(): string | Failure {
    try {
      return realpathSync(this.file)
    } catch (error) {
      if ((error as { code?: string }).code !== 'ENOENT') return unreadable(error)
      try {
        if (lstatSync(this.file).isSymbolicLink()) {
          return { error: { code: 'unreadable', detail: 'lien symbolique cassé' } }
        }
      } catch {
        // Ni fichier ni lien : absent.
      }
      return this.file
    }
  }

  private raw(): RawRead {
    const target = this.target()
    if (typeof target !== 'string') return target
    try {
      return { exists: true, text: readFileSync(target, 'utf8') }
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return { exists: false, text: '' }
      return unreadable(error)
    }
  }

  /** Copie de sauvegarde (le texte qu'on remplace), puis écriture d'un coup ; droits gardés. */
  private write(parsed: Parsed, next: string): Failure | undefined {
    const target = this.target()
    if (typeof target !== 'string') return target
    try {
      const mode = parsed.exists ? statSync(target).mode & 0o777 : 0o600
      if (parsed.exists) {
        writeFileAtomic(`${target}${BACKUP_SUFFIX}`, parsed.text, { mode })
      } else if (!existsSync(dirname(target))) {
        mkdirSync(dirname(target), { recursive: true })
      }
      writeFileAtomic(target, next, { mode })
      return undefined
    } catch (error) {
      return { error: { code: 'write-failed', detail: (error as Error).message } }
    }
  }
}

function unreadable(error: unknown): Failure {
  return { error: { code: 'unreadable', detail: (error as Error).message } }
}

export const BOB_APPROVAL_RULES: ApprovalRulesSource = {
  id: 'bob-settings',
  file: (loc) => join(loc.home, '.bob', 'settings', 'settings.json'),
  open: (file, profileId, displayFile, hooks) =>
    new BobApprovalRules(file, profileId, displayFile, hooks)
}
