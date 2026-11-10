/**
 * Assemblage des avis de licence (fiche 217) : inventaire (du build ou versionné) → textes lus
 * dans `node_modules` et dans le dépôt → `THIRD-PARTY-NOTICES.md`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { comparePackages, type BundledPackage } from './bundled-plugin.mts'
import { packageLicense, productionPackages, type Inventory } from './packages.mts'
import { renderNotices, type ExtraComponent, type NoticesInput } from './render.mts'

/** Builds d'electron-vite, dans l'ordre où l'inventaire les cite. */
export const TARGETS = ['main', 'preload', 'renderer'] as const

export const INVENTORY = 'scripts/third-party/inventory.json'
export const NOTICES = 'THIRD-PARTY-NOTICES.md'
const FONTS = 'src/renderer/src/assets/fonts'
const TEXTS = 'scripts/third-party/texts'

/** Inventaire versionné, avec la version d'Electron qui sert de base à l'app. */
export interface StoredInventory extends Inventory {
  electron: string
}

/** Version d'Electron installée (`node_modules/electron`). */
export function installedElectron(root: string): string {
  const pkg = JSON.parse(
    readFileSync(join(root, 'node_modules', 'electron', 'package.json'), 'utf8')
  ) as { version: string }
  return pkg.version
}

/**
 * Inventaire du dernier build (`out/third-party/*.json`, écrits par `bundled-plugin.mts`) et des
 * dépendances de production installées.
 */
export function inventoryFromBuild(root: string): StoredInventory {
  const merged = new Map<string, BundledPackage & { in: string[] }>()
  for (const target of TARGETS) {
    const file = join(root, 'out', 'third-party', `${target}.json`)
    if (!existsSync(file)) {
      throw new Error(`Inventaire du build absent (${file}) : lancer d'abord pnpm build`)
    }
    for (const pkg of JSON.parse(readFileSync(file, 'utf8')) as BundledPackage[]) {
      const key = `${pkg.name}@${pkg.version}`
      const entry = merged.get(key) ?? { name: pkg.name, version: pkg.version, in: [] }
      entry.in.push(target)
      merged.set(key, entry)
    }
  }
  return {
    electron: installedElectron(root),
    bundled: [...merged.values()].sort(comparePackages),
    production: productionPackages(root)
  }
}

export function readInventory(root: string): StoredInventory {
  return JSON.parse(readFileSync(join(root, INVENTORY), 'utf8')) as StoredInventory
}

export const serializeInventory = (inventory: StoredInventory): string =>
  JSON.stringify(inventory, null, 2) + '\n'

const WHERE: Record<string, string> = {
  main: 'main process',
  preload: 'preload',
  renderer: 'interface'
}

/** Où sert chaque paquet ; un paquet à la fois embarqué et en production n'apparaît qu'une fois. */
export function shippedPackages(inventory: Inventory): (BundledPackage & { where: string })[] {
  const all = new Map<string, BundledPackage & { where: string[] }>()
  const add = (pkg: BundledPackage, where: string): void => {
    const key = `${pkg.name}@${pkg.version}`
    const entry = all.get(key) ?? { name: pkg.name, version: pkg.version, where: [] }
    entry.where.push(where)
    all.set(key, entry)
  }
  for (const pkg of inventory.bundled) for (const t of pkg.in) add(pkg, WHERE[t] ?? t)
  for (const pkg of inventory.production) add(pkg, 'app (production dependency)')
  return [...all.values()]
    .sort(comparePackages)
    .map((p) => ({ name: p.name, version: p.version, where: p.where.join(', ') }))
}

const readText = (path: string): string =>
  readFileSync(path, 'utf8').replace(/\r\n?/g, '\n').replace(/\s+$/, '')

/** Version d'AXe d'après le texte de licence versionné (`vendor/archives/AXe-<v>-LICENSES.txt`). */
export function axeVersion(root: string): string {
  const versions = readdirSync(join(root, 'vendor', 'archives'))
    .map((f) => /^AXe-(.+)-LICENSES\.txt$/.exec(f)?.[1])
    .filter((v): v is string => Boolean(v))
  const [version] = versions
  if (!version || versions.length !== 1) {
    throw new Error(`Une seule licence d'AXe attendue : ${versions.join(', ')}`)
  }
  return version
}

/** Police embarquée : version, tableau des jeux d'icônes et textes, lus dans le dépôt. */
export function fontNotices(root: string): NoticesInput['font'] {
  const readme = readText(join(root, FONTS, 'MesloLGSNerdFont-README.txt'))
  const version = /release v(\d+(?:\.\d+)*)/.exec(readme)?.[1]
  const table = /## Icon sets\n+([\s\S]*?)\n+##/.exec(readme)?.[1]
  if (!version || !table) throw new Error('README de la police : version ou jeux d’icônes absents')
  const component = (name: string, license: string, ...files: string[]): ExtraComponent => ({
    name,
    license,
    texts: files.map((f) => readText(join(root, f)))
  })
  return {
    nerdFontsVersion: version,
    iconSets: table,
    // Avis de Meslo LG suivi du texte de la licence Apache 2.0 (celui du LICENSE de Bobine).
    meslo: component('Meslo LG', 'Apache-2.0', `${FONTS}/MesloLG-LICENSE.txt`, 'LICENSE'),
    nerdFonts: component('Nerd Fonts', 'MIT', `${FONTS}/NerdFonts-LICENSE.txt`),
    ccBy: component('Codicons and Font Awesome glyphs', 'CC-BY-4.0', `${TEXTS}/CC-BY-4.0.txt`),
    ofl: component('Pomicons and Weather Icons glyphs', 'OFL-1.1', `${TEXTS}/OFL-1.1.txt`)
  }
}

/** Texte complet des avis pour cet inventaire. */
export function noticesFor(root: string, inventory: StoredInventory): string {
  return renderNotices({
    packages: shippedPackages(inventory).map((p) => ({
      ...packageLicense(root, p),
      where: p.where
    })),
    electron: packageLicense(root, { name: 'electron', version: inventory.electron }),
    axeVersion: axeVersion(root),
    font: fontNotices(root)
  })
}

/** Paquets ajoutés (`+`) et retirés (`-`) entre deux inventaires, pour un message lisible. */
export function inventoryDiff(before: StoredInventory, after: StoredInventory): string[] {
  const keys = (inv: StoredInventory): Set<string> =>
    new Set([
      `electron@${inv.electron} (runtime)`,
      ...inv.bundled.map((p) => `${p.name}@${p.version} (${p.in.join(', ')})`),
      ...inv.production.map((p) => `${p.name}@${p.version} (production)`)
    ])
  const a = keys(before)
  const b = keys(after)
  return [
    ...[...b].filter((k) => !a.has(k)).map((k) => `+ ${k}`),
    ...[...a].filter((k) => !b.has(k)).map((k) => `- ${k}`)
  ]
}
