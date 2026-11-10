/**
 * Ce qui reste d'un fichier de configuration d'agent après une suppression (fiche 126) : les
 * objets que la suppression a vidés partent avec elle, et un fichier qui n'a plus rien à dire est
 * supprimé plutôt que laissé à `{ "mcp": {} }` dans le dépôt de l'utilisateur.
 */
import { existsSync, renameSync, rmSync } from 'node:fs'
import { applyEdits, modify, parse, visit } from 'jsonc-parser'
import { writeFileAtomic } from '../storage'

/** Mise en forme des fichiers modifiés par l'app. */
export const FORMATTING = { insertSpaces: true, tabSize: 2, eol: '\n' } as const

const isEmptyObject = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length === 0

const valueAt = (data: unknown, path: readonly string[]): unknown =>
  path.reduce<unknown>(
    (node, key) =>
      typeof node === 'object' && node !== null
        ? (node as Record<string, unknown>)[key]
        : undefined,
    data
  )

function hasComments(text: string): boolean {
  let found = false
  visit(text, { onComment: () => (found = true) })
  return found
}

/**
 * Texte après le retrait de l'entrée `removed` (chemin JSON) : ses conteneurs devenus vides
 * retirés. `undefined` : il ne reste rien (au plus `$schema`) ni aucun commentaire.
 */
export function pruneRemoved(text: string, removed: readonly string[]): string | undefined {
  let next = text
  for (let depth = removed.length - 1; depth > 0; depth--) {
    const container = removed.slice(0, depth)
    if (!isEmptyObject(valueAt(parse(next), container))) break
    next = applyEdits(
      next,
      modify(next, [...container], undefined, { formattingOptions: FORMATTING })
    )
  }
  const data: unknown = parse(next)
  const keys = typeof data === 'object' && data !== null ? Object.keys(data) : []
  return keys.every((key) => key === '$schema') && !hasComments(next) ? undefined : next
}

/** Écrit le texte, ou supprime le fichier quand il ne reste rien (`undefined`). */
export function writeOrRemove(
  file: string,
  text: string | undefined,
  options?: { backup?: boolean }
): void {
  if (text === undefined) {
    // Comme une écriture avec copie : la dernière version reste à côté.
    if (existsSync(file)) {
      if (options?.backup) renameSync(file, `${file}.bak`)
      else rmSync(file)
    }
    return
  }
  writeFileAtomic(file, text.endsWith('\n') ? text : `${text}\n`, options)
}
