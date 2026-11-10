/**
 * Diffs des outils d'édition d'OpenCode retrouvés dans leur sortie (fiche 096). OpenCode 2 joint
 * les diffs au `tool_call_update` terminé d'un outil qui a des `metadata.files[]` (`patch`, `edit`,
 * `write`) en relisant le fichier sur le disque et en lui appliquant le patch à l'envers. Au rejeu
 * (`session/load`), un fichier changé depuis ne se prête plus à ce calcul : le diff manque, et seul
 * `rawOutput.metadata.files[].patch` (diff unifié) dit ce qui a changé. On en refait un diff par
 * bloc, comme les extraits de Bob.
 *
 * Son `write` (2.2.5) ne joint jamais de diff à sa fin, même en direct : seul le fichier créé se
 * refait, depuis l'entrée de l'outil (`withCreatedFile`, fiche 202).
 *
 * Sans alias (`@shared`) : la sonde `pnpm opencode-probe` le charge sous Node, sans bundler.
 */
import { isAbsolute, resolve } from 'node:path'
import type { SessionUpdate, ToolCallContent } from '../../shared/acp-sdk.mts'
import { parsePatch } from 'diff'
import type { DiffSource } from './adapters'
import type { ToolCallSoFar } from './tool-call-memory'

/** Fichier modifié par un outil, tel qu'OpenCode 2.0.32 le décrit (`FileDiff.Info`). */
export interface OpenCodeFileDiff {
  /** Chemin relatif au dossier de la session (ou absolu). */
  file: string
  /** Diff unifié (`Index: <chemin absolu>`, `---`, `+++`, blocs `@@`). */
  patch: string
  status?: 'added' | 'deleted' | 'modified'
}

type Diff = Extract<ToolCallContent, { type: 'diff' }>

/** Fichiers décrits dans `rawOutput.metadata.files` ; les entrées mal formées sont écartées. */
export function filesOf(rawOutput: unknown): OpenCodeFileDiff[] {
  const metadata = (rawOutput as { metadata?: unknown } | null | undefined)?.metadata
  const files = (metadata as { files?: unknown } | null | undefined)?.files
  if (!Array.isArray(files)) return []
  return files.flatMap((entry: unknown) => {
    const f = entry as Record<string, unknown> | null
    if (typeof f?.['file'] !== 'string' || typeof f['patch'] !== 'string') return []
    const status = f['status']
    return [
      {
        file: f['file'],
        patch: f['patch'],
        ...(status === 'added' || status === 'deleted' || status === 'modified' ? { status } : {})
      }
    ]
  })
}

/**
 * Texte d'avant et d'après d'un bloc (`@@`) : contexte et lignes retirées d'un côté, contexte et
 * lignes ajoutées de l'autre. « \ No newline at end of file » retire le saut de ligne final du côté
 * de la ligne qui le précède.
 */
function hunkTexts(lines: readonly string[]): { oldText: string; newText: string } {
  let oldText = ''
  let newText = ''
  let previous = ' '
  for (const line of lines) {
    const mark = line[0] ?? ' '
    if (mark === '\\') {
      if (previous !== '+') oldText = oldText.replace(/\n$/, '')
      if (previous !== '-') newText = newText.replace(/\n$/, '')
      continue
    }
    const text = `${line.slice(1)}\n`
    if (mark !== '+') oldText += text
    if (mark !== '-') newText += text
    previous = mark
  }
  return { oldText, newText }
}

/**
 * Diffs d'un fichier refaits depuis son patch : un par bloc ; fichier créé, `oldText: null` (tout
 * en ajout) ; patch illisible, aucun.
 */
export function diffsFromPatch(path: string, file: OpenCodeFileDiff): Diff[] {
  let hunks
  try {
    hunks = parsePatch(file.patch).flatMap((p) => p.hunks)
  } catch {
    return []
  }
  const created =
    file.status === 'added' ||
    (file.status === undefined && hunks.length > 0 && hunks.every((h) => h.oldLines === 0))
  return hunks.flatMap((hunk) => {
    const { oldText, newText } = hunkTexts(hunk.lines)
    if (oldText === newText) return []
    return [{ type: 'diff' as const, path, oldText: created ? null : oldText, newText }]
  })
}

/**
 * La mise à jour, avec les diffs qui lui manquent : outil terminé dont `rawOutput.metadata.files`
 * décrit un fichier sans diff dans son contenu. Chemin résolu comme OpenCode (`file` relatif au
 * dossier de la session), pour retrouver celui de ses diffs. Sans contenu dans la mise à jour, rien :
 * l'ajouter remplacerait celui de la carte.
 */
export function withPatchDiffs(update: SessionUpdate, cwd: string): SessionUpdate {
  if (update.sessionUpdate !== 'tool_call' && update.sessionUpdate !== 'tool_call_update') {
    return update
  }
  if (update.status !== 'completed' || !Array.isArray(update.content)) return update
  const files = filesOf(update.rawOutput)
  if (files.length === 0) return update
  const known = new Set(update.content.flatMap((c) => (c.type === 'diff' ? [c.path] : [])))
  const added = files.flatMap((file) => {
    const path = isAbsolute(file.file) ? file.file : resolve(cwd, file.file)
    return known.has(path) ? [] : diffsFromPatch(path, file)
  })
  return added.length === 0 ? update : { ...update, content: [...update.content, ...added] }
}

/** Texte de fin du `write` d'OpenCode qui a créé le fichier (2.2.5 ; « Wrote … » s'il existait). */
const CREATED = /^Created file successfully\b/
/** Titre de l'outil `write`, seul ou préfixé par la description d'un sous-agent. */
const WRITE_TITLE = /(^|: )write$/

/**
 * Fichier créé par le `write` d'OpenCode (fiche 202). OpenCode 2.2.5 termine son `write` par un
 * seul texte (« Created file successfully: nouveau.txt »), sans diff ni `metadata.files` ; ce qu'il
 * a écrit n'est que dans l'entrée de l'outil (`rawInput: { path, content }`, donnée avant la fin).
 * Quand ce texte dit le fichier créé, son diff est certain : rien avant, `content` après. Un
 * fichier réécrit (« Wrote file successfully ») n'en reçoit pas : son ancien texte n'est dit nulle
 * part (sauf dans une demande d'autorisation, reprise par `withPermissionDiffs`).
 */
export function withCreatedFile(
  update: SessionUpdate,
  cwd: string,
  soFar?: ToolCallSoFar
): SessionUpdate {
  if (update.sessionUpdate !== 'tool_call' && update.sessionUpdate !== 'tool_call_update') {
    return update
  }
  if (update.status !== 'completed' || !Array.isArray(update.content)) return update
  // `soFar` comprend déjà cette mise à jour (sauf ses champs vides, comme `rawInput: {}`).
  const title = soFar?.title ?? update.title
  const kind = soFar?.kind ?? update.kind
  // Outil d'un sous-agent d'OpenCode 2 : titré « <description> : write » (fiche 078).
  if (!title || !WRITE_TITLE.test(title) || kind !== 'edit') return update
  const input = (soFar?.rawInput ?? update.rawInput) as Record<string, unknown> | null | undefined
  const file = input?.['path']
  const text = input?.['content']
  if (typeof file !== 'string' || typeof text !== 'string') return update
  const said = update.content.some(
    (c) => c.type === 'content' && c.content.type === 'text' && CREATED.test(c.content.text)
  )
  if (!said) return update
  const path = isAbsolute(file) ? file : resolve(cwd, file)
  if (update.content.some((c) => c.type === 'diff' && c.path === path)) return update
  const diff: Diff = { type: 'diff', path, oldText: null, newText: text }
  return { ...update, content: [...update.content, diff] }
}

/** Diffs d'OpenCode retrouvés dans la sortie de ses outils, tels que le profil les déclare. */
export const OPENCODE_DIFF_SOURCE: DiffSource = {
  complete: (update, cwd, soFar) => withCreatedFile(withPatchDiffs(update, cwd), cwd, soFar)
}
