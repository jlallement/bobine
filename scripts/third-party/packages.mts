/**
 * Paquets tiers livrés avec l'app et leurs licences (fiche 217) : ceux que Vite copie dans `out/`
 * (inventaire du build, `bundled-plugin.mts`) et les `dependencies` qu'electron-builder ajoute à
 * l'app. Lit les textes de licence dans `node_modules` (installation pnpm).
 */
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { comparePackages, type BundledPackage } from './bundled-plugin.mts'

/** Inventaire versionné (`scripts/third-party/inventory.json`). */
export interface Inventory {
  /** Copiés par Vite dans `out/` ; `in` : builds concernés (main, preload, renderer). */
  bundled: (BundledPackage & { in: string[] })[]
  /** `dependencies` (et leurs dépendances) qu'electron-builder ajoute à l'app. */
  production: BundledPackage[]
}

/**
 * Dépendances de production exclues de l'app par `files` d'electron-builder.yml (en-têtes C++
 * pour compiler node-pty : rien n'en est livré). Un test vérifie que l'exclusion y est toujours.
 */
export const EXCLUDED_FROM_APP = ['node-addon-api']

/** Licence choisie pour un paquet à double licence, et pourquoi c'est permis. */
export interface LicenseChoice {
  license: string
  /** Fichiers de licence du paquet qui portent le texte de la licence choisie. */
  files: string[]
  /** Phrase que ce texte doit contenir (garde-fou si le paquet change de fichier). */
  mustContain: string
  /** Où trouver les sources (exigé par EPL-2.0). */
  source: string
}

/**
 * Doubles licences : la licence retenue pour la distribution de Bobine (Apache-2.0). Un paquet à
 * double licence absent de cette liste fait échouer la génération : le choix doit être explicite.
 */
export const LICENSE_CHOICES: Record<string, LicenseChoice> = {
  // EPL-2.0 plutôt que GPL-3.0 : copyleft faible limité aux fichiers d'ELK, non modifiés.
  elkjs: {
    license: 'EPL-2.0',
    files: ['LICENSE.md'],
    mustContain: 'Eclipse Public License - v 2.0',
    source: 'https://github.com/kieler/elkjs'
  },
  dompurify: {
    license: 'Apache-2.0',
    files: ['LICENSE'],
    mustContain: 'Apache License',
    source: 'https://github.com/cure53/DOMPurify'
  }
}

/**
 * Paquets sans champ `license` dans leur `package.json` : la licence lue dans leur fichier de
 * licence (vérifiée à la main, et par `mustContain`).
 */
export const DECLARED_LICENSES: Record<string, { license: string; mustContain: string }> = {
  khroma: { license: 'MIT', mustContain: 'The MIT License' }
}

/**
 * Paquets publiés sans fichier de licence, dont le dépôt d'origine en a un : son texte, versionné
 * dans `scripts/third-party/texts/` (copié du paquet frère qui le livre, même dépôt).
 */
export const REPOSITORY_LICENSE_TEXTS: Record<string, string> = {
  '@xterm/headless': 'scripts/third-party/texts/xterm.js-LICENSE.txt',
  '@xterm/addon-serialize': 'scripts/third-party/texts/xterm.js-LICENSE.txt'
}

/** Ce que les avis disent d'un paquet. */
export interface PackageLicense extends BundledPackage {
  license: string
  /** Licence proposée par le paquet quand elle diffère (double licence). */
  offered?: string
  source?: string
  repository?: string
  /** Texte(s) de licence, puis avis (NOTICE) éventuels, tels que livrés par le paquet. */
  texts: string[]
  notices: string[]
}

interface PackageJson {
  name?: string
  version?: string
  license?: string | { type?: string }
  licenses?: { type?: string }[]
  author?: string | { name?: string }
  repository?: string | { url?: string }
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

const readJson = (path: string): PackageJson =>
  JSON.parse(readFileSync(path, 'utf8')) as PackageJson

/**
 * Dossier d'un paquet installé, d'après son nom et sa version exacte : d'abord
 * `node_modules/.pnpm/<nom>@<version>[_pairs]/node_modules/<nom>`, sinon `node_modules/<nom>`.
 */
export function findPackageDir(root: string, pkg: BundledPackage): string {
  const store = join(root, 'node_modules', '.pnpm')
  const prefix = `${pkg.name.replace('/', '+')}@${pkg.version}`
  const candidates = existsSync(store)
    ? readdirSync(store)
        .filter((entry) => entry === prefix || entry.startsWith(`${prefix}_`))
        .map((entry) => join(store, entry, 'node_modules', pkg.name))
    : []
  candidates.push(join(root, 'node_modules', pkg.name))
  for (const dir of candidates) {
    const file = join(dir, 'package.json')
    if (existsSync(file) && readJson(file).version === pkg.version) return dir
  }
  throw new Error(`${pkg.name}@${pkg.version} introuvable dans node_modules (pnpm install ?)`)
}

/**
 * Dépendance `name` telle que Node la trouve depuis le dossier `from` (réel, pnpm : les
 * dépendances d'un paquet sont ses voisines dans `.pnpm/<paquet>/node_modules`).
 */
function resolveFrom(from: string, name: string): string | null {
  let dir = from
  for (;;) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return candidate
    const parent = join(dir, '..')
    if (parent === dir) return null
    dir = parent
  }
}

/**
 * Dépendances de production de `package.json` et leurs propres dépendances, telles
 * qu'electron-builder les copie (sauf `EXCLUDED_FROM_APP`).
 */
export function productionPackages(root: string): BundledPackage[] {
  const found = new Map<string, BundledPackage>()
  const visit = (from: string, deps: Record<string, string>, optional: boolean): void => {
    for (const name of Object.keys(deps)) {
      if (EXCLUDED_FROM_APP.includes(name)) continue
      const dir = resolveFrom(from, name)
      if (!dir) {
        if (optional) continue
        throw new Error(`Dépendance de production introuvable : ${name} (depuis ${from})`)
      }
      const real = realDir(dir)
      const pkg = readJson(join(real, 'package.json'))
      if (!pkg.name || !pkg.version) throw new Error(`package.json sans nom ni version : ${real}`)
      const key = `${pkg.name}@${pkg.version}`
      if (found.has(key)) continue
      found.set(key, { name: pkg.name, version: pkg.version })
      visit(real, pkg.dependencies ?? {}, false)
      visit(real, pkg.optionalDependencies ?? {}, true)
    }
  }
  visit(root, readJson(join(root, 'package.json')).dependencies ?? {}, false)
  return [...found.values()].sort(comparePackages)
}

/** Chemin réel (liens de pnpm résolus vers `.pnpm/<paquet>/node_modules/<nom>`). */
const realDir = (dir: string): string => realpathSync.native(dir)

/** Fichiers de licence d'un paquet (LICENSE, LICENCE.md, COPYING…), sans les scripts. */
export function licenseFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => /^(licen[cs]e|copying)([.-][\w.-]*)?$/i.test(f))
    .filter((f) => !/\.(m?js|cjs|ts|json)$/i.test(f))
    .sort()
}

/** Fichiers NOTICE d'un paquet (Apache-2.0, §4 d : à reproduire). */
export function noticeFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => /^notice(\.(md|txt))?$/i.test(f))
    .sort()
}

/** Licence déclarée par `package.json` (forme moderne ou ancienne). */
export function declaredLicense(pkg: PackageJson): string | null {
  if (typeof pkg.license === 'string') return pkg.license
  if (pkg.license?.type) return pkg.license.type
  const types = (pkg.licenses ?? []).map((l) => l.type).filter(Boolean)
  return types.length ? types.join(' OR ') : null
}

/** Une expression SPDX à choix (« A OR B ») ? */
export const isChoice = (expression: string): boolean => /\bOR\b/.test(expression)

const MIT_BODY = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

const authorOf = (pkg: PackageJson): string | null =>
  typeof pkg.author === 'string' ? pkg.author : (pkg.author?.name ?? null)

const repositoryOf = (pkg: PackageJson): string | undefined => {
  const url = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
  if (!url) return undefined
  const github = /^(?:github:)?([\w.-]+\/[\w.-]+)$/.exec(url)
  if (github) return `https://github.com/${github[1]}`
  return url
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/\.git$/, '')
}

const readText = (path: string): string =>
  readFileSync(path, 'utf8').replace(/\r\n?/g, '\n').replace(/\s+$/, '')

/**
 * Licence et textes d'un paquet installé. Un paquet sans fichier de licence prend le texte de son
 * dépôt (`REPOSITORY_LICENSE_TEXTS`), sinon, s'il est MIT, le texte MIT standard avec l'auteur de
 * son `package.json` ; toute autre absence est une erreur.
 */
export function packageLicense(root: string, pkg: BundledPackage): PackageLicense {
  const dir = findPackageDir(root, pkg)
  const json = readJson(join(dir, 'package.json'))
  const repository = repositoryOf(json)
  const base = { name: pkg.name, version: pkg.version, ...(repository ? { repository } : {}) }
  const declared = declaredLicense(json) ?? DECLARED_LICENSES[pkg.name]?.license
  if (!declared) throw new Error(`${pkg.name}@${pkg.version} : licence non déclarée`)
  const notices = noticeFiles(dir).map((f) => readText(join(dir, f)))
  const choice = LICENSE_CHOICES[pkg.name]
  if (isChoice(declared)) {
    if (!choice) {
      throw new Error(
        `${pkg.name}@${pkg.version} : double licence « ${declared} » sans choix (LICENSE_CHOICES)`
      )
    }
    if (!declared.includes(choice.license)) {
      throw new Error(`${pkg.name} : « ${choice.license} » n'est pas proposée (${declared})`)
    }
    const texts = choice.files.map((f) => readText(join(dir, f)))
    if (!texts.some((t) => t.includes(choice.mustContain))) {
      throw new Error(`${pkg.name} : le texte de ${choice.license} manque (${choice.files})`)
    }
    return {
      ...base,
      license: choice.license,
      offered: declared,
      source: choice.source,
      texts,
      notices
    }
  }
  const files = licenseFiles(dir)
  const texts = files.map((f) => readText(join(dir, f)))
  const expected = DECLARED_LICENSES[pkg.name]?.mustContain
  if (expected && !texts.some((t) => t.includes(expected))) {
    throw new Error(`${pkg.name} : son fichier de licence ne dit plus « ${expected} »`)
  }
  const fromRepository = REPOSITORY_LICENSE_TEXTS[pkg.name]
  if (texts.length === 0 && fromRepository) texts.push(readText(join(root, fromRepository)))
  if (texts.length === 0) {
    const author = authorOf(json)
    if (declared !== 'MIT' || !author) {
      throw new Error(`${pkg.name}@${pkg.version} : aucun fichier de licence (${declared})`)
    }
    texts.push(`MIT License\n\nCopyright (c) ${author}\n\n${MIT_BODY}`)
  }
  return { ...base, license: declared, texts, notices }
}
