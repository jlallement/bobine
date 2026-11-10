/**
 * État du dépôt pour le lanceur e2e (fiche 115) : fichiers modifiés (`--changed`), empreinte des
 * sources et tampon « suite complète verte » (`--if-needed`), durées du dernier passage (ordre
 * des tâches en parallèle). Les fichiers d'état sont ignorés par git.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fingerprint } from '../scripts/e2e-select.mts'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const STAMP = join(root, 'e2e', '.last-green.json')
const DURATIONS = join(root, 'e2e', '.durations.json')

/**
 * Ce qui fait le résultat des essais : les sources de l'app et des essais, les dépendances, et
 * l'app buildée (`out/`) — une suite verte sur un build périmé ne vaut pas pour les sources.
 */
const SOURCE_PATHS = [
  'src',
  'e2e',
  'package.json',
  'pnpm-lock.yaml',
  'electron.vite.config.ts',
  'scripts/e2e-select.mts'
]

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
const lines = (text, sep = '\n') => text.split(sep).filter(Boolean)

/**
 * Fichiers modifiés par rapport à `base` : les commits de la branche depuis leur ancêtre commun
 * (`base...HEAD`), plus ce qui n'est pas commité (indexé ou non) et les fichiers nouveaux.
 */
export function changedFiles(base) {
  try {
    git('rev-parse', '--verify', '--quiet', `${base}^{commit}`)
  } catch {
    throw new Error(`base inconnue : ${base} (--base <ref>)`)
  }
  const files = new Set([
    ...lines(git('diff', '--name-only', '--no-renames', `${base}...HEAD`)),
    ...lines(git('diff', '--name-only', '--no-renames', 'HEAD')),
    ...lines(git('ls-files', '--others', '--exclude-standard'))
  ])
  return [...files].sort()
}

/** Fichiers d'un dossier, récursivement (chemins relatifs à la racine). */
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [relative(root, join(dir, e.name))]
  )

/**
 * Empreinte des sources telles qu'elles sont sur le disque (commitées ou non : un commit sans
 * changement ne la change pas) et de l'app buildée. `null` sans build.
 */
export function sourceFingerprint() {
  const out = join(root, 'out')
  if (!existsSync(out)) return null
  const tracked = lines(
    git('ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...SOURCE_PATHS),
    '\0'
  )
  const files = [...new Set([...tracked, ...walk(out)])].map((path) => {
    const full = join(root, path)
    return { path, content: existsSync(full) ? readFileSync(full) : null }
  })
  return fingerprint(files)
}

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

/** Dernière suite complète verte pour cette langue : `{ fingerprint, date, duration, jobs }`. */
export const lastGreen = (lang) => readJson(STAMP)[lang]

/** Pose le tampon vert de cette langue (les autres langues gardent le leur). */
export function writeGreen(lang, entry) {
  writeFileSync(STAMP, `${JSON.stringify({ ...readJson(STAMP), [lang]: entry }, null, 2)}\n`)
}

/** Durées du dernier passage, en ms, par tâche (`suite:thème`). */
export const readDurations = () => readJson(DURATIONS)

/** Ajoute les durées mesurées à celles déjà connues. */
export function writeDurations(measured) {
  writeFileSync(DURATIONS, `${JSON.stringify({ ...readDurations(), ...measured }, null, 2)}\n`)
}
