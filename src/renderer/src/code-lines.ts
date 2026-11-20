/**
 * Coloration d'un fichier ouvert dans l'onglet Fichiers (fiche 271, Q46), découpée en lignes pour
 * les numéros, le retour à la ligne et le « + » des remarques. Même moteur que le code du fil :
 * `rehype-highlight` (lowlight, grammaires « communes » de highlight.js), déjà livré ; les classes
 * `.hljs-*` prennent les couleurs de `syntax.css`. Aucun HTML n'est produit : des jetons (texte et
 * classe), rendus par React. Le langage vient de l'extension, du nom ou du `#!`, jamais deviné.
 */
import rehypeHighlight from 'rehype-highlight'
import { extensionOf, MAX_HIGHLIGHT_BYTES } from '@shared/files'

/** Un morceau de ligne, et ses classes de coloration (`hljs-keyword`…). */
export interface CodeToken {
  text: string
  className?: string
}

export type CodeLine = CodeToken[]

/** Nœuds hast utiles ici (le reste est ignoré). */
interface HastText {
  type: 'text'
  value: string
}
interface HastElement {
  type: 'element'
  tagName: string
  properties: { className?: unknown }
  children: HastNode[]
}
interface HastRoot {
  type: 'root'
  children: HastNode[]
}
type HastNode = HastText | HastElement | HastRoot

/** Transformation de `rehype-highlight` (son fichier ne sert qu'aux avis : langage inconnu). */
type Transform = (tree: HastRoot, file: { message: () => void }) => void
// -- le greffon est typé pour unified ; on n'en appelle que la transformation, sur un arbre maison.
const transform = (rehypeHighlight as unknown as (options: object) => Transform)({
  detect: false
})

/** Langage d'un nom de fichier qui n'a pas d'extension parlante. */
const BY_NAME: Record<string, string> = {
  makefile: 'makefile',
  gnumakefile: 'makefile',
  gemfile: 'ruby',
  rakefile: 'ruby',
  podfile: 'ruby',
  '.bashrc': 'bash',
  '.zshrc': 'bash',
  '.profile': 'bash',
  '.bash_profile': 'bash',
  '.zprofile': 'bash',
  '.editorconfig': 'ini',
  '.gitconfig': 'ini',
  '.npmrc': 'ini'
}

/** Extensions qui ne sont pas un alias des grammaires « communes ». */
const BY_EXTENSION: Record<string, string> = {
  jsonc: 'json',
  json5: 'json',
  webmanifest: 'json',
  map: 'json',
  lock: 'yaml',
  vue: 'xml',
  svelte: 'xml',
  htm: 'xml',
  mdx: 'markdown',
  markdown: 'markdown',
  conf: 'ini',
  cfg: 'ini',
  properties: 'ini',
  env: 'ini',
  gradle: 'kotlin',
  bat: 'plaintext',
  txt: 'plaintext',
  log: 'plaintext',
  csv: 'plaintext'
}

/** Interpréteur du `#!` → langage. */
const SHEBANG: [RegExp, string][] = [
  [/\b(ba|z|k)?sh\b/, 'bash'],
  [/\b(node|deno|bun)\b/, 'javascript'],
  [/\bpython[0-9.]*\b/, 'python'],
  [/\bruby\b/, 'ruby'],
  [/\bperl\b/, 'perl'],
  [/\bphp\b/, 'php']
]

/** Langage d'un fichier (alias de highlight.js), ou `undefined` : texte brut. */
export function languageOf(path: string, text = ''): string | undefined {
  const name = (path.split('/').at(-1) ?? path).toLowerCase()
  const named = BY_NAME[name]
  if (named) return named
  if (/^\.env(\..+)?$/.test(name)) return 'ini'
  const extension = extensionOf(path)
  if (extension) {
    const mapped = BY_EXTENSION[extension] ?? extension
    return mapped === 'plaintext' ? undefined : mapped
  }
  const first = text.slice(0, 200).split('\n', 1)[0] ?? ''
  if (!first.startsWith('#!')) return undefined
  return SHEBANG.find(([pattern]) => pattern.test(first))?.[1]
}

/** Lignes sans coloration. */
export const plainLines = (text: string): CodeLine[] =>
  text.split('\n').map((line) => (line ? [{ text: line }] : []))

const classesOf = (node: HastElement): string[] => {
  const value = node.properties.className
  return Array.isArray(value) ? value.filter((c): c is string => typeof c === 'string') : []
}

/**
 * Lignes colorées de `text` : chaque ligne est une suite de jetons ; une classe ouverte sur
 * plusieurs lignes (commentaire de bloc, chaîne) est reportée sur chacune. Langage inconnu, ou
 * fichier trop long (`MAX_HIGHLIGHT_BYTES`) : texte brut.
 */
export function highlightLines(text: string, language: string | undefined): CodeLine[] {
  if (!language || text.length > MAX_HIGHLIGHT_BYTES) return plainLines(text)
  const code: HastElement = {
    type: 'element',
    tagName: 'code',
    properties: { className: [`language-${language}`] },
    children: [{ type: 'text', value: text }]
  }
  const tree: HastRoot = {
    type: 'root',
    children: [{ type: 'element', tagName: 'pre', properties: {}, children: [code] }]
  }
  try {
    transform(tree, { message: () => undefined })
  } catch {
    return plainLines(text)
  }
  const lines: CodeLine[] = [[]]
  const walk = (nodes: readonly HastNode[], classes: readonly string[]) => {
    for (const node of nodes) {
      if (node.type === 'text') {
        const parts = node.value.split('\n')
        parts.forEach((part, i) => {
          if (i > 0) lines.push([])
          if (!part) return
          const token: CodeToken = classes.length
            ? { text: part, className: classes.join(' ') }
            : { text: part }
          lines[lines.length - 1]?.push(token)
        })
      } else if (node.type === 'element') {
        walk(node.children, [...classes, ...classesOf(node)])
      }
    }
  }
  walk(code.children, [])
  return lines
}
