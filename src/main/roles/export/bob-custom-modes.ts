/**
 * Modes personnalisés de Bob (fiche 223, phase 4, ADR-0047) : liste `customModes:` de
 * `~/.bob/settings/custom_modes.yaml` (partagé avec Bob IDE) ou de `<dossier>/.bob/custom_modes.yaml`.
 * Format documenté par IBM (« Custom modes », https://bob.ibm.com/docs/ide/configuration/custom-modes) ;
 * listés par ACP après `agent`, `plan`, `ask`, `id` = `slug` (Bob 2.1.0, `pnpm bob-probe`).
 *
 * Le fichier est à l'utilisateur et à Bob : seul l'élément de `customModes` dont le `slug` est le
 * nôtre est ajouté, remplacé ou retiré, par l'API `Document` de `yaml`, qui garde le reste du
 * fichier et ses commentaires. Garde-fou : le fichier produit est relu ; le reste doit y être
 * identique à avant, et notre mode tel que voulu, sinon rien n'est écrit.
 */
import { join } from 'node:path'
import { Document, isMap, isScalar, isSeq, parseDocument, type YAMLSeq } from 'yaml'
import type { RoleExportError } from '@shared/role-export'
import {
  exportedPrompt,
  fingerprint,
  shownPath,
  type EntryRead,
  type ExportedRole,
  type RoleExportAdapter,
  type TextChange
} from './format.ts'

/**
 * Groupes d'outils de Bob (documentation d'IBM : `read`, `edit`, `execute`, `mcp`, `skill`,
 * `workflow`, `todo`, `subtask`, `subagent`, `mode` ; un nom inconnu ne donne rien) : lecture
 * seule = lire et outils MCP (ceux de Bobine compris) ; sinon aussi modifier et lancer des
 * commandes.
 */
export const BOB_READ_ONLY_GROUPS = ['read', 'mcp'] as const
export const BOB_WORK_GROUPS = ['read', 'edit', 'execute', 'mcp'] as const

/** Modes de Bob (2.1.0) : un mode personnalisé du même slug les remplacerait. */
export const BOB_RESERVED = ['agent', 'plan', 'ask'] as const

/** Ni repli des longues lignes, ni espaces ajoutés dans `[a, b]` : le style courant des fichiers. */
const OPTIONS = { lineWidth: 0, flowCollectionPadding: false } as const

/** L'entrée écrite pour un rôle, dans l'ordre des champs de la documentation d'IBM. */
export function bobModeEntry(role: ExportedRole): Record<string, unknown> {
  return {
    slug: role.id,
    name: role.label,
    description: role.description,
    roleDefinition: exportedPrompt(role),
    whenToUse: role.description,
    groups: [...(role.readOnly ? BOB_READ_ONLY_GROUPS : BOB_WORK_GROUPS)]
  }
}

type Loaded = { doc: Document; list: YAMLSeq | undefined } | { error: RoleExportError }

/** Le fichier compris : document, et sa liste `customModes` (absente ou vide : `undefined`). */
function load(text: string | undefined): Loaded {
  const doc = parseDocument(text ?? '', { prettyErrors: false })
  const invalid = (detail: string): Loaded => ({ error: { code: 'invalidFile', detail } })
  const first = doc.errors[0]
  if (first) {
    return invalid(first.linePos ? `${first.code}, ligne ${first.linePos[0].line}` : first.code)
  }
  const empty = (node: unknown) => node == null || (isScalar(node) && node.value === null)
  if (empty(doc.contents)) return { doc, list: undefined }
  if (!isMap(doc.contents)) return invalid('racine')
  const list = doc.get('customModes', true)
  if (empty(list)) return { doc, list: undefined }
  if (!isSeq(list)) return invalid('customModes')
  return { doc, list }
}

/** Position de notre mode dans la liste ; -1 : absent. */
function indexOf(list: YAMLSeq | undefined, id: string): number {
  if (!list) return -1
  return list.items.findIndex((item) => isMap(item) && item.get('slug') === id)
}

/** Valeur de notre mode dans la liste ; `undefined` : absent. */
function entryOf(list: YAMLSeq | undefined, id: string): unknown {
  const item = list?.items[indexOf(list, id)]
  return isMap(item) ? item.toJSON() : undefined
}

/** Tout le fichier sauf notre mode, en valeurs : ce qui doit rester identique. */
function others(doc: Document, id: string): unknown {
  const value = (doc.toJS() ?? {}) as Record<string, unknown>
  const list = Array.isArray(value['customModes']) ? (value['customModes'] as unknown[]) : []
  return {
    ...value,
    customModes: list.filter(
      (item) => !(item && typeof item === 'object' && (item as { slug?: unknown }).slug === id)
    )
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const withNewline = (text: string) => (text.endsWith('\n') ? text : `${text}\n`)

/** Relit le texte produit : le reste du fichier intact, notre mode tel que voulu (ou absent). */
function checked(before: Document, text: string, id: string, wanted?: unknown): TextChange {
  const after = load(text)
  const rejected: TextChange = { error: { code: 'invalidFile', detail: 'relecture' } }
  if ('error' in after || !same(others(before, id), others(after.doc, id))) return rejected
  const entry = entryOf(after.list, id)
  if (!same(entry, wanted)) return rejected
  return { text, ...(entry ? { fingerprint: fingerprint(entry) } : {}) }
}

export const BOB_CUSTOM_MODES: RoleExportAdapter = {
  format: 'bob-custom-modes',
  place: (scope, _id, loc, workspace) => {
    const root = scope === 'user' ? loc.home : (workspace ?? '')
    const file =
      scope === 'user'
        ? join(root, '.bob', 'settings', 'custom_modes.yaml')
        : join(root, '.bob', 'custom_modes.yaml')
    return { file, root, shown: shownPath(file, root, scope) }
  },
  reserved: BOB_RESERVED,
  entryText: (role) =>
    withNewline(new Document({ customModes: [bobModeEntry(role)] }).toString(OPTIONS)),
  fingerprintOf: (role) => fingerprint(bobModeEntry(role)),
  find: (text, id): EntryRead => {
    if (text === undefined) return { kind: 'absent' }
    const loaded = load(text)
    if ('error' in loaded) return { kind: 'invalid', error: loaded.error }
    const entry = entryOf(loaded.list, id)
    return entry === undefined
      ? { kind: 'absent' }
      : { kind: 'present', fingerprint: fingerprint(entry) }
  },
  put: (text, role) => {
    const loaded = load(text)
    const before = load(text)
    if ('error' in loaded || 'error' in before) {
      return { error: 'error' in loaded ? loaded.error : { code: 'invalidFile' } }
    }
    const { doc, list } = loaded
    const entry = bobModeEntry(role)
    const index = indexOf(list, role.id)
    if (list && index >= 0) list.items[index] = doc.createNode(entry)
    else if (list) list.items.push(doc.createNode(entry))
    else if (isMap(doc.contents)) doc.set('customModes', doc.createNode([entry]))
    else doc.contents = doc.createNode({ customModes: [entry] })
    return checked(before.doc, withNewline(doc.toString(OPTIONS)), role.id, entry)
  },
  drop: (text, id) => {
    const loaded = load(text)
    const before = load(text)
    if ('error' in loaded || 'error' in before) {
      return { error: 'error' in loaded ? loaded.error : { code: 'invalidFile' } }
    }
    const index = indexOf(loaded.list, id)
    if (index < 0 || !loaded.list) return { text }
    loaded.list.items.splice(index, 1)
    return checked(before.doc, withNewline(loaded.doc.toString(OPTIONS)), id)
  }
}
