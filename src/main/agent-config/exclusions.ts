/**
 * Fichiers d'exclusion d'un agent (fiche 155) : quels fichiers du dossier de travail il refuse
 * d'ouvrir, d'après ce que son profil déclare (`ExclusionSource`). Lecture façon gitignore, avec la
 * bibliothèque `ignore` (celle de Bob 2.0.6) : dans chaque dossier, de la racine du dossier de
 * travail à celui du fichier, les fichiers déclarés, et les motifs toujours exclus ; un motif vaut
 * à partir du dossier de son fichier. Hors du dossier de travail : rien n'est exclu.
 */
import { readFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import ignore, { type Ignore } from 'ignore'
import type { ExclusionSource } from '../agent/adapters'

/** Fichiers d'exclusion relus au plus tous les… (Bob : 30 s). */
const CACHE_MS = 5_000
/** Dossiers gardés en cache ; au-delà, le plus ancien est oublié. */
export const MAX_CACHED_DIRS = 200

export interface Exclusions {
  /** Ce qui exclut, pour le dire (`.bobignore`, `.gitignore`, `.env`). */
  files: string[]
  isExcluded(path: string): Promise<boolean>
  /** Les chemins exclus parmi ceux-ci, dans leur ordre. */
  excluded(paths: readonly string[]): Promise<string[]>
}

const cache = new Map<string, { at: number; ig: Promise<Ignore> }>()

async function readRules(dir: string, source: ExclusionSource): Promise<Ignore> {
  const ig = ignore().add([...(source.always ?? [])])
  for (const name of source.files) {
    const text = await readFile(join(dir, name), 'utf8').catch(() => undefined)
    if (text !== undefined) ig.add(text)
  }
  return ig
}

/** Règles d'un dossier, gardées quelques secondes. */
function rulesOf(dir: string, source: ExclusionSource): Promise<Ignore> {
  const key = `${[...source.files, '|', ...(source.always ?? [])].join('\0')}\0${dir}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.ig
  const ig = readRules(dir, source)
  // Réinséré : la clé passe en dernier, la plus ancienne reste en tête.
  cache.delete(key)
  cache.set(key, { at: Date.now(), ig })
  while (cache.size > MAX_CACHED_DIRS) cache.delete(cache.keys().next().value as string)
  return ig
}

const posix = (path: string) => path.split(sep).join('/')

/** Exclusions de l'agent pour ce dossier de travail ; `undefined` si son profil n'en déclare pas. */
export function exclusionsFor(
  source: ExclusionSource | undefined,
  workspace: string
): Exclusions | undefined {
  if (!source || (source.files.length === 0 && !source.always?.length)) return undefined
  const isExcluded = async (path: string): Promise<boolean> => {
    const inside = relative(workspace, path)
    if (!inside || inside.startsWith('..') || isAbsolute(inside)) return false
    // Dossiers de la racine du dossier de travail à celui du fichier.
    const dirs = [workspace]
    for (const part of dirname(inside)
      .split(sep)
      .filter((p) => p && p !== '.')) {
      dirs.push(join(dirs.at(-1) as string, part))
    }
    for (const dir of dirs) {
      const ig = await rulesOf(dir, source)
      if (ig.ignores(posix(relative(dir, path)))) return true
    }
    return false
  }
  return {
    files: [...source.files, ...(source.always ?? [])],
    isExcluded,
    excluded: async (paths) => {
      const out: string[] = []
      for (const path of paths) if (await isExcluded(path)) out.push(path)
      return out
    }
  }
}

/** Essais : dossiers en cache. */
export const cachedDirs = (): number => cache.size

/** Essais : oublie les règles lues. */
export function clearExclusionsCache(): void {
  cache.clear()
}
