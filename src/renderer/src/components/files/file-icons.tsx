import {
  File,
  FileCode2,
  FileImage,
  FileJson,
  FileSymlink,
  FileText,
  Folder,
  FolderOpen,
  type LucideIcon
} from 'lucide-react'
import { createElement } from 'react'
import { extensionOf, imageType } from '@shared/files'

const CODE = new Set(
  (
    'ts tsx js jsx mjs cjs mts cts py rb go rs java kt swift c h cpp hpp cs php sh bash zsh css ' +
    'scss less html htm vue svelte sql yml yaml toml xml lua r pl m mm'
  ).split(' ')
)
const TEXT = new Set(['md', 'mdx', 'markdown', 'txt', 'pdf', 'rst'])

/** Icône d'un fichier selon son type (Q23) ; aussi celle de l'onglet quand il est ouvert. */
export function fileIcon(name: string): LucideIcon {
  const extension = extensionOf(name)
  if (imageType(name)) return FileImage
  if (extension === 'json' || extension === 'jsonc') return FileJson
  if (CODE.has(extension)) return FileCode2
  if (TEXT.has(extension)) return FileText
  return File
}

/** Icône d'une entrée de l'arbre : dossier ouvert ou fermé, lien, fichier. */
export function entryIcon(
  entry: { name: string; kind: 'dir' | 'file'; link?: string },
  open: boolean
) {
  if (entry.kind === 'dir') return open ? FolderOpen : Folder
  if (entry.link) return FileSymlink
  return fileIcon(entry.name)
}

/** Icône d'une entrée de l'arbre, rendue. */
export function EntryIcon({
  entry,
  open,
  size = 14
}: {
  entry: { name: string; kind: 'dir' | 'file'; link?: string }
  open: boolean
  size?: number
}) {
  return createElement(entryIcon(entry, open), { size })
}

/** Icône d'un fichier par son nom, rendue (onglet du panneau, point 21). */
export function FileIcon({ name, size = 15 }: { name: string; size?: number }) {
  return createElement(fileIcon(name), { size })
}
