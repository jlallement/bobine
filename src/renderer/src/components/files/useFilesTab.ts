import { useCallback, useEffect, useRef, useState } from 'react'
import {
  parentDirs,
  type FileContent,
  type FileListing,
  type FileRoot,
  type FileTarget
} from '@shared/files'
import type { TranscriptItem } from '@shared/transcript'
import { ipcErrorText } from '../../ipc-errors'
import { useFileFilter } from './useFileFilter'
import {
  closeFile,
  collapseAll,
  dirKey,
  loadFilesPreferences,
  loadFilesState,
  openFile,
  revealIn,
  saveFilesPreferences,
  saveFilesState,
  stepFile,
  toggleDir,
  type FilesPreferences,
  type FilesState
} from '../../files-state'

/** Défilement retenu après ce délai sans mouvement. */
const SCROLL_SAVE_MS = 400

export type Listing = { listing: FileListing } | { error: string }

/** Fichier ouvert : son contenu lu, ou l'erreur. */
export type OpenContent =
  | { target: FileTarget; content: FileContent; seq: number }
  | { target: FileTarget; error: string; missing: boolean; seq: number }

/** Demande venue d'ailleurs (⌘P, lien du fil) : `seq` change à chaque demande. */
export interface FilesRequest {
  seq: number
  /** Fichier à ouvrir, à la ligne. */
  target?: FileTarget
  /** Curseur dans le filtre (⌘P). */
  focusFilter?: boolean
}

/** Outils terminés et tours finis : l'arbre et le fichier sont relus (Q29). */
function workDone(items: readonly TranscriptItem[]): number {
  let done = 0
  for (const item of items) {
    if (item.kind === 'tool' && item.status === 'completed') done++
  }
  return done
}

/**
 * Ce que l'onglet Fichiers lit et retient (fiche 271) : racines, dossiers dépliés (un niveau lu à
 * l'ouverture), fichier ouvert, filtre ; relu à la fin des outils, au retour sur la fenêtre et par
 * « Relire ». Rien n'est surveillé en continu.
 */
export function useFilesTab(conversationId: string, items: readonly TranscriptItem[]) {
  const [state, setStateRaw] = useState<FilesState>(() => loadFilesState(conversationId))
  const setState = useCallback(
    (update: (current: FilesState) => FilesState) =>
      setStateRaw((current) => {
        const next = update(current)
        if (next !== current) saveFilesState(conversationId, next)
        return next
      }),
    [conversationId]
  )
  const [preferences, setPreferencesRaw] = useState(loadFilesPreferences)
  const setPreferences = (change: Partial<FilesPreferences>) =>
    setPreferencesRaw((current) => {
      const next = { ...current, ...change }
      saveFilesPreferences(next)
      return next
    })
  const [roots, setRoots] = useState<FileRoot[] | null>(null)
  const [rootsError, setRootsError] = useState<string | null>(null)
  const [listings, setListings] = useState<Record<string, Listing>>({})
  const [content, setContent] = useState<OpenContent | null>(null)
  const [generation, setGeneration] = useState(0)
  const api = window.api.fileTree

  // Racines de la conversation.
  useEffect(() => {
    let alive = true
    api
      .roots(conversationId)
      .then((found) => {
        if (!alive) return
        setRoots(found)
        setRootsError(null)
      })
      .catch((e: unknown) => alive && setRootsError(ipcErrorText(e)))
    return () => {
      alive = false
    }
  }, [api, conversationId, generation])

  // Dossiers dépliés (et la racine principale) : lus s'ils ne le sont pas, ou à chaque relecture.
  const expanded = roots ? [dirKey(0, ''), ...state.expanded] : []
  const wanted = [...new Set(expanded)].filter((key) => {
    const root = Number(key.slice(0, key.indexOf(':')))
    return !!roots?.[root]
  })
  const loadedFor = useRef<Record<string, number>>({})
  useEffect(() => {
    for (const key of wanted) {
      if (loadedFor.current[key] === generation) continue
      loadedFor.current[key] = generation
      const at = key.indexOf(':')
      const root = Number(key.slice(0, at))
      const dir = key.slice(at + 1)
      api
        .list(conversationId, root, dir)
        .then((listing) => setListings((all) => ({ ...all, [key]: { listing } })))
        .catch((e: unknown) =>
          setListings((all) => ({ ...all, [key]: { error: ipcErrorText(e) } }))
        )
    }
  })

  // Fichier ouvert : lu à l'ouverture et à chaque relecture.
  const open = state.open
  const openKey = open ? `${open.root}:${open.path}` : ''
  useEffect(() => {
    if (!open) return
    let alive = true
    const target = open
    api
      .read(conversationId, target.root, target.path)
      .then((read) => {
        if (!alive) return
        // Rien n'a changé sur le disque : le même contenu, rien à recolorer (point 25).
        setContent((current) =>
          current &&
          'content' in current &&
          current.target.root === target.root &&
          current.target.path === target.path &&
          current.content.modified === read.modified &&
          current.content.size === read.size
            ? current
            : { target, content: read, seq: generation }
        )
      })
      .catch((e: unknown) => {
        if (!alive) return
        const error = ipcErrorText(e)
        setContent({ target, error, missing: /ENOENT|no such file/i.test(error), seq: generation })
      })
    return () => {
      alive = false
    }
    // `open.line` ne relit pas le fichier : seule la position change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- relu par fichier et par relecture
  }, [api, conversationId, openKey, generation])

  // Relecture (Q29) : fin d'outil ou de tour, retour sur la fenêtre, « Relire ».
  const reload = useCallback(() => setGeneration((g) => g + 1), [])
  const done = workDone(items)
  const lastDone = useRef(done)
  useEffect(() => {
    if (done === lastDone.current) return
    lastDone.current = done
    reload()
  }, [done, reload])
  useEffect(() => {
    window.addEventListener('focus', reload)
    return () => window.removeEventListener('focus', reload)
  }, [reload])

  // Filtre (Q33) : liste plate classée, sur toutes les racines.
  const filter = useFileFilter(
    roots,
    (root, query) => api.search(conversationId, root, query),
    generation
  )

  // Défilement du fichier ouvert : retenu un instant après le dernier mouvement (Q2).
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(scrollTimer.current), [])
  const saveScroll = useCallback(
    (scroll: number) => {
      clearTimeout(scrollTimer.current)
      scrollTimer.current = setTimeout(
        () =>
          setStateRaw((s) => {
            if (!s.open) return s
            const next = { ...s, scroll }
            saveFilesState(conversationId, next)
            return next
          }),
        SCROLL_SAVE_MS
      )
    },
    [conversationId]
  )

  const show = useCallback(
    (target: FileTarget) =>
      setState((s) => revealIn(openFile(s, target), target.root, parentDirs(target.path))),
    [setState]
  )
  return {
    state,
    roots,
    rootsError,
    listings,
    // Contenu du fichier ouvert seulement (un fichier fermé n'a plus de contenu).
    content: open ? content : null,
    preferences,
    setPreferences,
    filter,
    /** Ce qui rend un fichier invisible pour l'agent (`.bobignore`…), lu avec la racine. */
    exclusionFiles: exclusionFilesOf(listings),
    reload,
    show,
    toggle: (root: number, path: string, open?: boolean) =>
      setState((s) => toggleDir(s, dirKey(root, path), open)),
    reveal: (root: number, path: string) =>
      setState((s) => revealIn(s, root, [...parentDirs(path), path].filter(Boolean))),
    close: () => setState(closeFile),
    step: (delta: -1 | 1) => setState((s) => stepFile(s, delta)),
    collapse: () => setState(collapseAll),
    /** « Réduire » un dossier : lui et ses sous-dossiers (point 24). */
    collapseDir: (root: number, path: string) =>
      setState((s) => {
        const key = dirKey(root, path)
        const kept = s.expanded.filter((k) => k !== key && !k.startsWith(`${key}/`))
        return kept.length === s.expanded.length ? s : { ...s, expanded: kept }
      }),
    saveScroll
  }
}

function exclusionFilesOf(listings: Record<string, Listing>): string[] {
  const top = listings['0:']
  return top && 'listing' in top ? (top.listing.exclusionFiles ?? []) : []
}

export type FilesTabModel = ReturnType<typeof useFilesTab>
