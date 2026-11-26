/**
 * Plancher d'Electron (fiche 288, ADR-0074) : la seule version plus ancienne que celle du projet
 * avec laquelle l'app se construit, quand l'archive de la version fixée ne peut pas être obtenue.
 * Deux versions acceptées, pas une plage : celle du projet (`package.json`) et le plancher.
 *
 * Source unique : `scripts/electron-floor.json` (version, empreintes SHA-256 officielles des
 * archives macOS, recopiées du `SHASUMS256.txt` publié par Electron). Lu par `electron-local`,
 * `check-electron`, `package`, `e2e/packaged.mjs` et `.github/workflows/electron-floor.yml`.
 *
 *   node scripts/electron-floor.mts version                          version du plancher
 *   node scripts/electron-floor.mts checksum <archive.zip>           empreinte attendue (ou rien)
 *   node scripts/electron-floor.mts status <version> <projet>        project | floor, sinon refus
 *   node scripts/electron-floor.mts notices <version> <fichier>      avis de licence de ce build
 *   node scripts/electron-floor.mts builder-config <avis> <fichier>  configuration d'electron-builder
 *
 * `ELECTRON_FLOOR_FILE` désigne un autre fichier de plancher (essais seulement).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export const FLOOR_FILE = 'scripts/electron-floor.json'

export interface ElectronFloor {
  version: string
  /** Nom de l'archive officielle → empreinte SHA-256 (hexadécimal). */
  checksums: Record<string, string>
}

export type ElectronStatus =
  { kind: 'project' } | { kind: 'floor' } | { kind: 'refused'; reason: string }

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/

function parts(version: string): [number, number, number] | null {
  const m = VERSION.exec(version)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

export function readFloor(
  path = process.env['ELECTRON_FLOOR_FILE'] ?? join(root, FLOOR_FILE)
): ElectronFloor {
  return JSON.parse(readFileSync(path, 'utf8')) as ElectronFloor
}

/**
 * Ce qui rend le plancher inutilisable face à la version du projet : même majeure (redéfini à
 * chaque majeure, ADR-0074), strictement plus ancien, archives macOS et empreintes bien formées.
 */
export function floorProblems(floor: ElectronFloor, project: string): string[] {
  const f = parts(floor.version)
  const p = parts(project)
  if (!p) return [`version du projet illisible : ${project}`]
  if (!f) return [`version du plancher illisible : ${floor.version}`]
  const problems: string[] = []
  if (f[0] !== p[0]) {
    problems.push(
      `plancher ${floor.version} sur une autre majeure que le projet (${project}) : à redéfinir (ADR-0074)`
    )
  } else if (f[1] > p[1] || (f[1] === p[1] && f[2] >= p[2])) {
    problems.push(`plancher ${floor.version} pas plus ancien que la version du projet (${project})`)
  }
  const expected = ['arm64', 'x64'].map((arch) => `electron-v${floor.version}-darwin-${arch}.zip`)
  const names = Object.keys(floor.checksums ?? {}).sort()
  if (names.join() !== expected.sort().join()) {
    problems.push(
      `empreintes attendues pour ${expected.join(' et ')} (trouvé : ${names.join(', ') || 'aucune'})`
    )
  }
  for (const [name, sha] of Object.entries(floor.checksums ?? {})) {
    if (!/^[0-9a-f]{64}$/.test(sha)) problems.push(`empreinte mal formée pour ${name}`)
  }
  return problems
}

/** Version du projet, plancher, ou refus avec la raison (autre majeure, autre version). */
export function electronStatus(
  version: string,
  project: string,
  floor: ElectronFloor
): ElectronStatus {
  if (version === project) return { kind: 'project' }
  const accepted = `acceptées : ${project} (version du projet) ou ${floor.version} (plancher, ADR-0074)`
  if (version === floor.version) {
    const problems = floorProblems(floor, project)
    if (problems.length === 0) return { kind: 'floor' }
    return { kind: 'refused', reason: `plancher inutilisable : ${problems.join(' ; ')}` }
  }
  const v = parts(version)
  const p = parts(project)
  if (v && p && v[0] !== p[0]) {
    return {
      kind: 'refused',
      reason: `Electron ${version} : autre majeure que celle du projet (${p[0]}) ; ${accepted}`
    }
  }
  return { kind: 'refused', reason: `Electron ${version || 'de version inconnue'} : ${accepted}` }
}

/** Configuration d'electron-builder du dépôt, avec les avis de licence pris dans `notices`. */
export async function floorBuilderConfig(notices: string): Promise<Record<string, unknown>> {
  const { parse } = await import('yaml')
  const config = parse(readFileSync(join(root, 'electron-builder.yml'), 'utf8')) as {
    extraResources?: { from?: string }[]
  }
  const entries = (config.extraResources ?? []).filter((e) => e.from === 'THIRD-PARTY-NOTICES.md')
  const [entry] = entries
  if (!entry || entries.length !== 1) {
    throw new Error(
      'electron-builder.yml : une seule entrée « from: THIRD-PARTY-NOTICES.md » attendue'
    )
  }
  entry.from = resolve(notices)
  return config
}

async function main(args: string[]): Promise<number> {
  const [command, a, b] = args
  switch (command) {
    case 'version':
      console.log(readFloor().version)
      return 0
    case 'checksum':
      if (!a) break
      process.stdout.write(readFloor().checksums[a] ?? '')
      return 0
    case 'status': {
      if (a === undefined || !b) break
      const status = electronStatus(a, b, readFloor())
      if (status.kind === 'refused') {
        console.error(status.reason)
        return 1
      }
      console.log(status.kind)
      return 0
    }
    case 'notices': {
      if (!a || !b) break
      const { inventoryFromBuild, installedElectron, noticesFor } =
        await import('./third-party/notices.mts')
      const project = installedElectron(root)
      const status = electronStatus(a, project, readFloor())
      if (status.kind === 'refused') throw new Error(status.reason)
      writeFileSync(b, noticesFor(root, inventoryFromBuild(root), a))
      return 0
    }
    case 'builder-config':
      if (!a || !b) break
      writeFileSync(b, JSON.stringify(await floorBuilderConfig(a), null, 2))
      return 0
  }
  console.error(
    'Usage : electron-floor.mts version | checksum <archive> | status <version> <projet> | ' +
      'notices <version> <fichier> | builder-config <avis> <fichier>'
  )
  return 2
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main(process.argv.slice(2))
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
