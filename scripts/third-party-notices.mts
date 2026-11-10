/**
 * Avis de licence des composants tiers livrés avec l'app (fiche 217).
 *
 *   pnpm build && pnpm third-party-notices           met à jour l'inventaire et THIRD-PARTY-NOTICES.md
 *   pnpm build && pnpm third-party-notices --check   échoue s'ils ne correspondent plus au build
 *
 * `--check` tourne dans `pnpm package` (avant de construire l'app) et au début de `pnpm e2e` :
 * un paquet ajouté, retiré ou monté de version dans le build est vu avant tout envoi. `verify`
 * vérifie en plus, sans build, l'inventaire contre le lockfile (test unitaire).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  INVENTORY,
  NOTICES,
  inventoryDiff,
  inventoryFromBuild,
  noticesFor,
  readInventory,
  serializeInventory
} from './third-party/notices.mts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Fichiers d'Electron qu'electron-builder copie dans `licenses/electron/` (electron-builder.yml). */
const ELECTRON_LICENSES = ['LICENSE', 'LICENSES.chromium.html']

function check(): number {
  const problems: string[] = []
  const built = inventoryFromBuild(root)
  const diff = inventoryDiff(readInventory(root), built)
  if (diff.length) problems.push(`Inventaire (${INVENTORY}) en retard sur le build :`, ...diff)
  const current = readFileSync(join(root, NOTICES), 'utf8')
  const stale = diff.length > 0 || current !== noticesFor(root, built)
  if (!diff.length && stale) problems.push(`${NOTICES} ne correspond plus aux paquets installés.`)
  for (const file of ELECTRON_LICENSES) {
    const path = join(root, 'node_modules', 'electron', 'dist', file)
    if (!existsSync(path)) {
      problems.push(
        `${path} manque : l'app ne peut pas être livrée sans. Installer Electron depuis son ` +
          'archive .zip (pnpm electron-local <archive>, fiche 065) plutôt que depuis Electron.app.'
      )
    }
  }
  if (problems.length) {
    console.error(`✗ Avis de licence :\n  ${problems.join('\n  ')}`)
    if (stale) console.error('  → pnpm build && pnpm third-party-notices, puis committer.')
    return 1
  }
  console.log(`✓ Avis de licence à jour (${NOTICES})`)
  return 0
}

function write(): number {
  const inventory = inventoryFromBuild(root)
  // Textes lus d'abord : une erreur (licence manquante, double licence sans choix) n'écrit rien.
  const notices = noticesFor(root, inventory)
  writeFileSync(join(root, INVENTORY), serializeInventory(inventory))
  writeFileSync(join(root, NOTICES), notices)
  const count = new Set([...inventory.bundled, ...inventory.production].map((p) => p.name)).size
  console.log(`✓ ${NOTICES} : ${count} paquets npm, Electron ${inventory.electron}`)
  return 0
}

try {
  process.exitCode = process.argv.includes('--check') ? check() : write()
} catch (error) {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
