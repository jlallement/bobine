/**
 * Contrôle du .deb construit (fiche 145) : icônes du thème hicolor (PNG de 16 à 512 et SVG),
 * entrée `bobine.desktop` rattachée à la fenêtre (`StartupWMClass`, `Icon`), et contenu de
 * l'archive de l'app (`app.asar`) : seulement le build, `package.json` et les dépendances. Lancé par
 * `pnpm package --linux` après la construction ; à la main :
 *
 *   node scripts/check-linux-package.mts [dist/Bobine-….deb …]   (Linux, dpkg-deb)
 *
 * Sans argument : tous les .deb de dist/. Code de sortie 1 et la liste des manques s'il en manque.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FONT_LICENSES, missingFonts } from './bundled-fonts.mjs'
import { HICOLOR_DIRS } from './linux-icons.mjs'

/** Nom du programme et de l'entrée de bureau (`executableName`, `desktopName`). */
export const APP = 'bobine'

/** Ce qui manque au paquet, d'après ses fichiers (chemins absolus) et son entrée de bureau. */
export function packageProblems(files: readonly string[], desktop: string | undefined): string[] {
  const present = new Set(files)
  const problems = [
    ...HICOLOR_DIRS.map(
      (dir) => `/usr/share/icons/hicolor/${dir}/apps/${APP}.${dir === 'scalable' ? 'svg' : 'png'}`
    )
      .filter((path) => !present.has(path))
      .map((path) => `icône absente : ${path}`),
    // Licences des polices livrées (fiche 145).
    ...FONT_LICENSES.map((f) => `/opt/Bobine/resources/licenses/fonts/${f}`)
      .filter((path) => !present.has(path))
      .map((path) => `licence absente : ${path}`)
  ]
  if (desktop === undefined) {
    return [...problems, `entrée de bureau absente : /usr/share/applications/${APP}.desktop`]
  }
  const entry = (key: string) => desktop.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim()
  // Electron prend l'app_id (Wayland) et WM_CLASS (X11) de `desktopName` : bobine.
  if (entry('StartupWMClass') !== APP) {
    problems.push(`StartupWMClass=${entry('StartupWMClass') ?? '(absent)'}, attendu ${APP}`)
  }
  if (entry('Icon') !== APP) problems.push(`Icon=${entry('Icon') ?? '(absent)'}, attendu ${APP}`)
  return problems
}

/** Fichiers d'un dossier, en chemins absolus du paquet. */
const walk = (root: string, dir = root): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(root, join(dir, e.name)) : [`/${relative(root, join(dir, e.name))}`]
  )

/**
 * Chemins rangés dans une archive asar d'Electron, lus dans son en-tête (pur, sans dépendance) :
 * deux entiers de « pickle », puis la taille et le texte JSON de l'arborescence.
 */
export function asarEntries(archive: Buffer): string[] {
  const size = archive.readUInt32LE(12)
  const header = JSON.parse(archive.subarray(16, 16 + size).toString('utf8')) as AsarDir
  const out: string[] = []
  const walk = (dir: AsarDir, prefix: string) => {
    for (const [name, node] of Object.entries(dir.files)) {
      out.push(`${prefix}${name}`)
      if ('files' in node) walk(node, `${prefix}${name}/`)
    }
  }
  walk(header, '')
  return out
}
type AsarDir = { files: Record<string, AsarDir | { size?: number }> }

/** Au premier niveau de `app.asar`, seulement ce que `files` d'electron-builder.yml y met. */
const ASAR_TOP = new Set(['out', 'package.json', 'node_modules'])

/**
 * Ce qui n'a rien à faire dans l'archive de l'app : tout ce qui n'est pas le build, `package.json`
 * ou les dépendances (sources, documentation, essais, fichiers locaux…), et les binaires de
 * node-pty pour d'autres systèmes. Et ce qui doit y être : les polices livrées hors macOS.
 */
export function asarProblems(entries: readonly string[]): string[] {
  const stray = [...new Set(entries.map((e) => e.split('/')[0] ?? e))].filter(
    (top) => !ASAR_TOP.has(top)
  )
  const prebuilds = entries.filter((e) => e.startsWith('node_modules/node-pty/prebuilds/'))
  return [
    ...(stray.length ? [`hors du build dans app.asar : ${stray.sort().join(', ')}`] : []),
    ...(prebuilds.length ? [`binaires de node-pty d'autres systèmes dans app.asar`] : []),
    ...missingFonts(entries)
  ]
}

function checkDeb(deb: string): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'bobine-deb-'))
  try {
    execFileSync('dpkg-deb', ['-x', deb, dir])
    let desktop: string | undefined
    try {
      desktop = readFileSync(join(dir, 'usr/share/applications', `${APP}.desktop`), 'utf8')
    } catch {
      desktop = undefined
    }
    const asar = join(dir, 'opt', 'Bobine', 'resources', 'app.asar')
    const content = existsSync(asar)
      ? asarProblems(asarEntries(readFileSync(asar)))
      : ['archive de l’app absente : /opt/Bobine/resources/app.asar']
    return [...packageProblems(walk(dir), desktop), ...content]
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const given = process.argv.slice(2)
  const debs = given.length
    ? given
    : readdirSync('dist')
        .filter((f) => f.endsWith('.deb'))
        .map((f) => join('dist', f))
  if (!debs.length) {
    console.error('Aucun .deb à contrôler (dist/*.deb)')
    process.exit(1)
  }
  let failed = false
  for (const deb of debs) {
    const problems = checkDeb(deb)
    failed ||= problems.length > 0
    console.log(
      problems.length
        ? `✗ ${deb}\n${problems.map((p) => `  ${p}`).join('\n')}`
        : `✓ ${deb} : icônes hicolor (${HICOLOR_DIRS.join(', ')}), ${APP}.desktop, app.asar (out, package.json, node_modules, polices livrées)`
    )
  }
  process.exit(failed ? 1 : 0)
}
