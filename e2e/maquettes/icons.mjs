// Icônes Lucide (celles de l'app), en SVG brut pour le DOM injecté.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'node_modules',
  'lucide-react',
  'dist',
  'esm',
  'icons'
)
const cache = new Map()
const missing = new Set()

async function load(name) {
  if (cache.has(name)) return cache.get(name)
  const file = `${dir}/${name}.mjs`
  if (!existsSync(file)) {
    missing.add(name)
    cache.set(name, [['circle', { cx: '12', cy: '12', r: '9' }]])
    return cache.get(name)
  }
  const { __iconData } = await import(file)
  if (!__iconData) {
    // Alias : le fichier réexporte une autre icône.
    const target = readFileSync(file, 'utf8').match(/from '\.\/([a-z0-9-]+)\.mjs'/)?.[1]
    const node =
      target && target !== name ? await load(target) : [['circle', { cx: '12', cy: '12', r: '9' }]]
    cache.set(name, node)
    return node
  }
  cache.set(name, __iconData.node)
  return __iconData.node
}

const names = new Set()
/** Repère les icônes utilisées ; `preload()` les charge avant le rendu synchrone. */
export function i(name, size = 15, cls = '', stroke = 2) {
  names.add(name)
  const node = cache.get(name)
  if (!node) return `@@${name}|${size}|${cls}|${stroke}@@`
  const children = node
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k]) => k !== 'key')
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ')
      return `<${tag} ${a}></${tag}>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${name} ${cls}" aria-hidden="true">${children}</svg>`
}

/** Remplace les icônes repérées avant leur chargement. */
export async function resolveIcons(text) {
  const re = /@@([a-z0-9-]+)\|(\d+)\|([^|]*)\|([\d.]+)@@/g
  for (const m of text.matchAll(re)) await load(m[1])
  return text.replace(re, (_, n, s, c, w) => i(n, Number(s), c, Number(w)))
}

export const missingIcons = () => [...missing]
