/**
 * Installeur Windows (fiche 229, lot 6 ; D1 à D3) : NSIS pour l'utilisateur seul, une construction
 * par architecture, depuis le Mac comme depuis Windows (electron-builder sait faire du NSIS sur les
 * deux). En node plutôt qu'en bash : sous Windows, pnpm lance les scripts par `cmd`.
 *
 *   pnpm package --win                 dist/Bobine-<version>-x64.exe et -arm64.exe
 *   pnpm package --win --x64           une seule architecture (--arm64 de même)
 *   pnpm package --win --dir           le dossier de l'app seul (dist/win-unpacked, win-arm64-unpacked)
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/package-win.mts …   (sous Windows)
 *
 * Electron : l'archive Windows officielle de la version installée, téléchargée par @electron/get
 * (cache partagé) et vérifiée par les sommes SHA-256 livrées avec le paquet `electron`
 * (`checksums.json`) ; jamais l'Electron du système qui construit (`electronDist`, fiche 065, est
 * celui du Mac). Ni signature (D3) ni AXe.
 *
 * Fichiers : la liste `files` de la racine d'electron-builder.yml, reprise et adaptée à Windows
 * (`windowsFiles`) dans une configuration temporaire : electron-builder ne garde que les exclusions
 * pour node_modules, une ligne de la section `win` ne pourrait pas remettre koffi ni les binaires
 * Windows de node-pty, exclus à la racine pour le Mac et Linux.
 *
 * Après la construction, le dossier de l'app est contrôlé (`windowsPackageProblems`, `asarProblems`)
 * : architecture de l'exécutable, binaires de node-pty et de koffi, licences, contenu de l'asar.
 * Les binaires de koffi (`@koromix/koffi-win32-<arch>`) ne sont installés par pnpm que pour la
 * machine qui construit : depuis le Mac, l'installeur n'a pas les objets de tâche (ADR-0050 : repli
 * `taskkill`), averti ; sous Windows, c'est une erreur.
 */
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { FONT_LICENSES, missingFonts } from './bundled-fonts.mjs'

export type WindowsArch = 'x64' | 'arm64'
export const WINDOWS_ARCHS: readonly WindowsArch[] = ['x64', 'arm64']

export interface WindowsPackageOptions {
  archs: WindowsArch[]
  /** Dossier de l'app seul, sans installeur. */
  dirOnly: boolean
  /** Options passées telles quelles à electron-builder (`--publish never`…). */
  builderArgs: string[]
}

/** Lit les options ; sans `--x64` ni `--arm64`, les deux architectures (D2). */
export function parseWindowsArgs(argv: readonly string[]): WindowsPackageOptions {
  const archs: WindowsArch[] = []
  const builderArgs: string[] = []
  let dirOnly = false
  for (const arg of argv) {
    if (arg === '--win' || arg === '--windows') continue
    if (arg === '--dir') dirOnly = true
    else if (arg === '--x64' || arg === '--arm64') {
      const arch = arg.slice(2) as WindowsArch
      if (!archs.includes(arch)) archs.push(arch)
    } else if (arg === '--dry-run' || arg === '--strict' || arg === '--linux' || arg === '--mac') {
      throw new Error(`${arg} : sans objet pour Windows (pas de signature, D3)`)
    } else builderArgs.push(arg)
  }
  return { archs: archs.length ? archs : [...WINDOWS_ARCHS], dirOnly, builderArgs }
}

/** Exclusions de la racine faites pour le Mac et Linux, retirées pour Windows. */
export const ROOT_ONLY_EXCLUSIONS = [
  '!node_modules/node-pty/prebuilds/win32-*/**',
  '!node_modules/koffi/**',
  '!node_modules/@koromix/**'
]

/** Exclusions propres à Windows (`${arch}` : macro d'electron-builder, l'architecture construite). */
export const WINDOWS_EXCLUSIONS = [
  // node-pty : l'architecture construite, sans symboles de débogage (.pdb, ≈ 25 Mo) ni winpty,
  // repli des Windows d'avant ConPTY (build 18309) ; `pty.node` y est le module de winpty (D8).
  '!node_modules/node-pty/prebuilds/!(win32-${arch})/**',
  '!node_modules/node-pty/prebuilds/**/*.pdb',
  '!node_modules/node-pty/prebuilds/*/{pty.node,winpty.dll,winpty-agent.exe}',
  // koffi : ses sources C, ses dépendances vendues et sa doc ne servent pas ; binaire de
  // l'architecture construite seulement.
  '!node_modules/koffi/{src,vendor,doc}/**',
  '!node_modules/@koromix/!(koffi-win32-${arch})/**'
]

/**
 * Liste `files` de Windows : celle de la racine sans `ROOT_ONLY_EXCLUSIONS`, plus
 * `WINDOWS_EXCLUSIONS`. Une exclusion attendue qui manque est une erreur : la racine a changé, la
 * liste de Windows doit suivre.
 */
export function windowsFiles(rootFiles: readonly unknown[]): unknown[] {
  for (const pattern of ROOT_ONLY_EXCLUSIONS) {
    if (!rootFiles.includes(pattern)) {
      throw new Error(
        `electron-builder.yml : « ${pattern} » absent de \`files\` (package-win.mts à revoir)`
      )
    }
  }
  return [
    ...rootFiles.filter((p) => typeof p !== 'string' || !ROOT_ONLY_EXCLUSIONS.includes(p)),
    ...WINDOWS_EXCLUSIONS
  ]
}

/** Dossier de l'app produit par electron-builder pour une architecture. */
export const unpackedDir = (arch: WindowsArch): string =>
  arch === 'x64' ? 'win-unpacked' : `win-${arch}-unpacked`

/** Valeur du champ `Machine` de l'en-tête PE (IMAGE_FILE_MACHINE_*) pour chaque architecture. */
const PE_MACHINE: Record<WindowsArch, number> = { x64: 0x8664, arm64: 0xaa64 }

/** Architecture d'un exécutable Windows d'après son en-tête PE ; `undefined` si illisible. */
export function peArch(exe: Buffer): WindowsArch | 'other' | undefined {
  if (exe.length < 0x40 || exe.toString('latin1', 0, 2) !== 'MZ') return undefined
  const pe = exe.readUInt32LE(0x3c)
  if (pe + 6 > exe.length || exe.toString('latin1', pe, pe + 4) !== 'PE\0\0') return undefined
  const machine = exe.readUInt16LE(pe + 4)
  const found = WINDOWS_ARCHS.find((arch) => PE_MACHINE[arch] === machine)
  return found ?? 'other'
}

/**
 * Restes de l'archive d'Electron (l'app par défaut d'Electron, son numéro de version) : retirés
 * après `--win dir`, comme electron-builder le fait de l'archive qu'il télécharge lui-même.
 */
export const ELECTRON_LEFTOVERS = ['resources/default_app.asar', 'version']

/** Fichiers attendus dans le dossier de l'app (chemins relatifs, séparateur `/`). */
export function expectedFiles(arch: WindowsArch): string[] {
  const pty = `resources/app.asar.unpacked/node_modules/node-pty/prebuilds/win32-${arch}`
  return [
    'Bobine.exe',
    'resources/app.asar',
    `${pty}/conpty.node`,
    `${pty}/conpty_console_list.node`,
    `${pty}/conpty/conpty.dll`,
    `${pty}/conpty/OpenConsole.exe`,
    'resources/licenses/LICENSE',
    'resources/licenses/NOTICE',
    'resources/licenses/THIRD-PARTY-NOTICES.md',
    'resources/licenses/conpty/LICENSE.txt',
    'resources/licenses/koffi/LICENSE.txt',
    'resources/licenses/electron/LICENSE',
    'resources/licenses/electron/LICENSES.chromium.html',
    ...FONT_LICENSES.map((f) => `resources/licenses/fonts/${f}`)
  ]
}

/** Où koffi cherche son binaire (`@koromix/koffi-win32-<arch>/win32_<arch>/koffi.node`). */
export const koffiBinary = (arch: WindowsArch): RegExp =>
  new RegExp(`(^|/)@koromix/koffi-win32-${arch}/win32_${arch}/koffi\\.node$`)

/** Seules entrées admises à la racine de l'asar : le build, les dépendances, package.json. */
export const ASAR_ROOTS = ['node_modules', 'out', 'package.json']

/**
 * Ce qui ne va pas dans l'asar : entrées hors de `ASAR_ROOTS` (le dépôt entier, si `files` est mal
 * combiné), koffi absent, binaires de koffi d'un autre système, polices livrées absentes.
 */
export function asarProblems(entries: readonly string[], arch: WindowsArch): string[] {
  const paths = entries.map((e) => e.replace(/\\/g, '/').replace(/^\/+/, ''))
  const roots = new Set(paths.map((p) => p.split('/')[0] ?? ''))
  const problems = [...roots]
    .filter((root) => root && !ASAR_ROOTS.includes(root))
    .sort()
    .map((root) => `hors du build dans app.asar : ${root}`)
  if (!paths.includes('node_modules/koffi/package.json')) problems.push('koffi absent de app.asar')
  const others = new Set(
    paths
      .map((p) => /(?:^|\/)@koromix\/([^/]+)/.exec(p)?.[1])
      .filter((name): name is string => Boolean(name) && name !== `koffi-win32-${arch}`)
  )
  for (const name of [...others].sort())
    problems.push(`binaire de koffi d'un autre système : ${name}`)
  return [...problems, ...missingFonts(paths)]
}

/**
 * Ce qui ne va pas dans le dossier de l'app, d'après la liste de ses fichiers (relatifs, `/`) et
 * l'architecture lue dans `Bobine.exe`.
 */
export function windowsPackageProblems(
  files: readonly string[],
  arch: WindowsArch,
  exeArch: WindowsArch | 'other' | undefined
): string[] {
  const present = new Set(files)
  const problems = expectedFiles(arch)
    .filter((f) => !present.has(f))
    .map((f) => `absent : ${f}`)
  if (present.has('Bobine.exe') && exeArch !== arch) {
    problems.push(`Bobine.exe est ${exeArch ?? 'illisible'}, attendu ${arch}`)
  }
  const prebuilds = 'resources/app.asar.unpacked/node_modules/node-pty/prebuilds/'
  for (const f of files) {
    if (ELECTRON_LEFTOVERS.includes(f)) problems.push(`reste de l'archive d'Electron : ${f}`)
    if (f.startsWith(prebuilds) && !f.startsWith(`${prebuilds}win32-${arch}/`)) {
      problems.push(`binaire d'un autre système : ${f}`)
    }
    if (f.endsWith('.pdb')) problems.push(`symboles de débogage livrés : ${f}`)
    if (/(^|\/)(winpty\.dll|winpty-agent\.exe)$/.test(f)) problems.push(`winpty livré : ${f}`)
    // Agent factice et AXe : jamais dans l'app livrée (fiche 012, macOS seulement pour AXe).
    if (/mock-agent|(^|\/)axe\//.test(f)) problems.push(`fichier de développement livré : ${f}`)
  }
  return problems
}

/** Fichiers d'un dossier, relatifs et avec `/`. */
function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).split(sep).join('/'))
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function run(command: string, args: string[]): void {
  // `pnpm` est `pnpm.cmd` sous Windows : passé par le shell (arguments fixes, sans espace).
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: command === 'pnpm' && process.platform === 'win32'
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} : code ${result.status ?? result.signal}`)
  }
}

/** Entrées de l'asar, lues par @electron/asar (celui d'electron-builder, déjà installé). */
function asarEntries(asarPath: string): string[] {
  const fromBuilder = createRequire(
    realpathSync(join(root, 'node_modules', 'electron-builder', 'package.json'))
  )
  const fromLib = createRequire(fromBuilder.resolve('app-builder-lib/package.json'))
  const asar = fromLib('@electron/asar') as {
    listPackage(path: string, options: { isPack: boolean }): string[]
  }
  return asar.listPackage(asarPath, { isPack: false })
}

interface ElectronGet {
  downloadArtifact(options: {
    version: string
    artifactName: string
    platform: string
    arch: string
    checksums: Record<string, string>
  }): Promise<string>
}

/** Archive officielle d'Electron pour Windows, vérifiée (SHA-256 de `electron/checksums.json`). */
async function electronZip(arch: WindowsArch): Promise<string> {
  // Chemin réel : pnpm range les dépendances d'`electron` à côté de sa copie, pas sous le lien.
  const electronPkg = realpathSync(join(root, 'node_modules', 'electron', 'package.json'))
  const fromElectron = createRequire(electronPkg)
  const { version } = JSON.parse(readFileSync(electronPkg, 'utf8')) as { version: string }
  const get = fromElectron('@electron/get') as ElectronGet
  const checksums = fromElectron('./checksums.json') as Record<string, string>
  return get.downloadArtifact({
    version,
    artifactName: 'electron',
    platform: 'win32',
    arch,
    checksums
  })
}

/** Configuration d'electron-builder pour Windows, écrite dans un dossier temporaire. */
function writeWindowsConfig(): string {
  const config = parse(readFileSync(join(root, 'electron-builder.yml'), 'utf8')) as {
    files: unknown[]
  }
  config.files = windowsFiles(config.files)
  const file = join(mkdtempSync(join(tmpdir(), 'bobine-win-')), 'electron-builder.json')
  writeFileSync(file, JSON.stringify(config, null, 2))
  return file
}

async function main(): Promise<number> {
  const options = parseWindowsArgs(process.argv.slice(2))
  // Electron du système qui construit : ses textes de licence sont copiés dans l'app (fiche 217)
  // et lus par l'avis de licence. Déjà là : rien n'est téléchargé.
  run(process.execPath, [join(root, 'node_modules', 'electron', 'install.js')])
  run('pnpm', ['-s', 'build'])
  run('pnpm', ['-s', 'third-party-notices', '--check'])
  const builder = join(root, 'node_modules', 'electron-builder', 'cli.js')
  const config = writeWindowsConfig()
  for (const arch of options.archs) {
    const zip = await electronZip(arch)
    console.log(`▶ Windows ${arch} : Electron ${zip}`)
    // 1. Le dossier de l'app (fuses, intégrité de l'asar, icône et version dans Bobine.exe).
    run(process.execPath, [
      builder,
      '--config',
      config,
      '--win',
      'dir',
      `--${arch}`,
      // Dossier de l'archive : electron-builder y prend `electron-v<version>-win32-<arch>.zip`.
      `-c.electronDist=${dirname(zip)}`,
      ...options.builderArgs
    ])
    // 2. Une archive désignée par `electronDist` est extraite telle quelle : on retire ce
    // qu'electron-builder retire de celle qu'il télécharge lui-même.
    const dir = join(root, 'dist', unpackedDir(arch))
    for (const leftover of ELECTRON_LEFTOVERS) rmSync(join(dir, leftover), { force: true })
    const exe = join(dir, 'Bobine.exe')
    const exeArch = existsSync(exe) ? peArch(readFileSync(exe)) : undefined
    const asar = join(dir, 'resources', 'app.asar')
    const files = listFiles(dir)
    const problems = [
      ...windowsPackageProblems(files, arch, exeArch),
      ...(existsSync(asar) ? asarProblems(asarEntries(asar), arch) : [])
    ]
    // Binaire de koffi : pnpm ne l'installe que pour la machine qui construit (voir en tête).
    if (!files.some((f) => koffiBinary(arch).test(f))) {
      const missing = `binaire de koffi absent (@koromix/koffi-win32-${arch}) : repli taskkill`
      if (process.platform === 'win32' && process.arch === arch) problems.push(missing)
      else console.warn(`⚠ Windows ${arch} : ${missing} (construit hors de Windows ${arch})`)
    }
    if (problems.length) {
      console.error(`✗ Paquet Windows ${arch} :\n  ${problems.join('\n  ')}`)
      return 1
    }
    // 3. L'installeur, à partir de ce dossier contrôlé.
    if (!options.dirOnly) {
      run(process.execPath, [
        builder,
        '--config',
        config,
        '--win',
        'nsis',
        `--${arch}`,
        '--prepackaged',
        dir,
        ...options.builderArgs
      ])
    }
  }
  console.log(`✓ Paquet Windows contrôlé (${options.archs.join(', ')})`)
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(`✗ ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  )
}
