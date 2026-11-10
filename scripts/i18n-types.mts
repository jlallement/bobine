/**
 * Écrit src/shared/i18n/fr.generated.d.ts : le type exact de locales/fr.json (fiche 074,
 * ADR-0014). TypeScript lit les valeurs d'un JSON comme de simples `string` ; avec leur texte mot
 * pour mot, i18next vérifie aussi le nom des variables (`{{count}}`). `pnpm typecheck` le lance
 * d'abord : le fichier suit `fr.json` sans y penser.
 *
 *   pnpm i18n-types
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as prettier from 'prettier'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'src', 'shared', 'i18n', 'locales', 'fr.json')
const target = join(root, 'src', 'shared', 'i18n', 'fr.generated.d.ts')

/** Type TypeScript d'une valeur de `fr.json`, textes compris mot pour mot. */
export function literalType(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const fields = Object.entries(value).map(
      ([key, child]) => `readonly ${JSON.stringify(key)}: ${literalType(child)}`
    )
    return `{ ${fields.join('; ')} }`
  }
  throw new Error(
    `fr.json : seuls des textes et des groupes sont attendus, pas ${JSON.stringify(value)}`
  )
}

/** Contenu attendu du fichier, mis en forme comme le reste du dépôt. */
export async function generate(): Promise<string> {
  const resources: unknown = JSON.parse(readFileSync(source, 'utf8'))
  const code =
    '// Généré par scripts/i18n-types.mts à partir de locales/fr.json : ne pas modifier.\n\n' +
    `export type FrResources = ${literalType(resources)}\n`
  const options = await prettier.resolveConfig(target)
  return prettier.format(code, { ...options, filepath: target })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const code = await generate()
  let current = ''
  try {
    current = readFileSync(target, 'utf8')
  } catch {
    // Premier lancement : le fichier n'existe pas encore.
  }
  if (current !== code) writeFileSync(target, code)
}
