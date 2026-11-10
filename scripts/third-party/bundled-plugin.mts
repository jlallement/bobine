/**
 * Inventaire des paquets tiers réellement embarqués par le build (fiche 217).
 *
 * Presque tout ce que l'app livre (React, mermaid et ses dépendances, le SDK ACP…) est copié par
 * Vite dans `out/`, sans passer par `dependencies` : `pnpm licenses --prod` n'en dit rien. Ce
 * greffon relève, à la fin de chaque build (main, preload, renderer), les paquets de
 * `node_modules` dont du code ou un fichier (police, CSS) se retrouve dans la sortie, et l'écrit
 * dans `out/third-party/<cible>.json` (exclu de l'app par electron-builder). `pnpm
 * third-party-notices --check` compare cet inventaire à celui du dépôt.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import type { Plugin } from 'vite'

/** Un paquet tiers embarqué, tel que l'inventaire le consigne. */
export interface BundledPackage {
  name: string
  version: string
}

/**
 * Dossier racine du paquet `node_modules` d'où vient un module de la sortie, ou `null` (code du
 * dépôt, module virtuel). Le dernier `node_modules/` du chemin compte : avec pnpm, le vrai chemin
 * est `node_modules/.pnpm/<nom>@<version>/node_modules/<nom>/…`.
 */
export function packageRoot(moduleId: string): string | null {
  if (moduleId.startsWith('\0')) return null
  const [path = moduleId] = moduleId.split('?')
  // Nom d'origine d'un fichier (police, image) : parfois relatif au dossier du build.
  const id = (isAbsolute(path) ? path : resolve(path)).replaceAll('\\', '/')
  const marker = '/node_modules/'
  const at = id.lastIndexOf(marker)
  if (at < 0) return null
  const parts = id.slice(at + marker.length).split('/')
  const first = parts[0]
  if (!first || first.startsWith('.')) return null
  const depth = first.startsWith('@') ? 2 : 1
  if (parts.length <= depth) return null
  return id.slice(0, at + marker.length) + parts.slice(0, depth).join('/')
}

/**
 * Modules virtuels de l'outil de build qui laissent du code dans la sortie : l'aide au
 * préchargement de Vite, le petit « runtime » de Rolldown. Ce sont des paquets livrés aussi.
 */
export function toolOfVirtualModule(moduleId: string): 'vite' | 'rolldown' | null {
  if (moduleId.startsWith('\0vite/')) return 'vite'
  if (moduleId.startsWith('\0rolldown/')) return 'rolldown'
  return null
}

/**
 * Paquets (triés, sans doublon) dont viennent ces modules ; lit leur `package.json`. `tools` :
 * versions de Vite et Rolldown, pour leurs modules virtuels.
 */
export function packagesOf(
  moduleIds: Iterable<string>,
  tools: { vite: string; rolldown: string } = { vite: '', rolldown: '' }
): BundledPackage[] {
  const roots = new Set<string>()
  const found = new Map<string, BundledPackage>()
  for (const id of moduleIds) {
    const tool = toolOfVirtualModule(id)
    if (tool) {
      if (!tools[tool]) throw new Error(`Version de ${tool} inconnue pour ${id.slice(1)}`)
      found.set(`${tool}@${tools[tool]}`, { name: tool, version: tools[tool] })
      continue
    }
    const root = packageRoot(id)
    if (root) roots.add(root)
  }
  for (const root of roots) {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      name?: string
      version?: string
    }
    if (!pkg.name || !pkg.version) throw new Error(`package.json sans nom ni version : ${root}`)
    found.set(`${pkg.name}@${pkg.version}`, { name: pkg.name, version: pkg.version })
  }
  return [...found.values()].sort(comparePackages)
}

export function comparePackages(a: BundledPackage, b: BundledPackage): number {
  return a.name === b.name ? a.version.localeCompare(b.version) : a.name.localeCompare(b.name)
}

/**
 * Greffon de build : `target` nomme le fichier écrit dans `outDir`. Un module dont tout le code a
 * été retiré (tree-shaking) ne compte pas ; une feuille de style compte (Vite la sort à part, son
 * module JS est vide).
 */
export function bundledPackages(target: string, outDir: string): Plugin {
  return {
    name: 'bobine-bundled-packages',
    apply: 'build',
    generateBundle(_options, bundle) {
      const ids: string[] = []
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk') {
          for (const [id, info] of Object.entries(output.modules)) {
            if (info.renderedLength > 0 || /\.css($|\?)/.test(id)) ids.push(id)
          }
        } else {
          ids.push(...(output.originalFileNames ?? []))
        }
      }
      mkdirSync(outDir, { recursive: true })
      writeFileSync(
        join(outDir, `${target}.json`),
        JSON.stringify(
          packagesOf(ids, { vite: this.meta.viteVersion, rolldown: this.meta.rolldownVersion }),
          null,
          2
        ) + '\n'
      )
    }
  }
}
