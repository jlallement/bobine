/**
 * Contrôle du .deb construit (fiche 145) : icônes du thème hicolor (PNG de 16 à 512 et SVG) et
 * entrée `bobine.desktop` rattachée à la fenêtre (`StartupWMClass`, `Icon`). Lancé par
 * `pnpm package --linux` après la construction ; à la main :
 *
 *   node scripts/check-linux-package.mts [dist/Bobine-….deb …]   (Linux, dpkg-deb)
 *
 * Sans argument : tous les .deb de dist/. Code de sortie 1 et la liste des manques s'il en manque.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HICOLOR_DIRS } from './linux-icons.mjs'

/** Nom du programme et de l'entrée de bureau (`executableName`, `desktopName`). */
export const APP = 'bobine'

/** Ce qui manque au paquet, d'après ses fichiers (chemins absolus) et son entrée de bureau. */
export function packageProblems(files: readonly string[], desktop: string | undefined): string[] {
  const present = new Set(files)
  const problems = HICOLOR_DIRS.map(
    (dir) => `/usr/share/icons/hicolor/${dir}/apps/${APP}.${dir === 'scalable' ? 'svg' : 'png'}`
  )
    .filter((path) => !present.has(path))
    .map((path) => `icône absente : ${path}`)
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
    return packageProblems(walk(dir), desktop)
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
        : `✓ ${deb} : icônes hicolor (${HICOLOR_DIRS.join(', ')}), ${APP}.desktop`
    )
  }
  process.exit(failed ? 1 : 0)
}
