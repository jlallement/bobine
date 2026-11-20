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
  forgetDir,
  loadFilesPreferences,
  loadFilesState,
  openFile,
  reconcileRoots,
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
/** Fins d'outil et retours sur la fenêtre rapprochés : une seule relecture, après ce délai (C4). */
export const RELOAD_DELAY_MS = 250

export type Listing = { listing: FileListing } | { error: string }

/** Contenu lu d'un fichier (jamais `unchanged` : celui-là garde le contenu d'avant). */
export type ReadContent = Exclude<FileContent, { kind: 'unchanged' }>

/** Fichier ouvert : son contenu lu, ou l'erreur. */
export type OpenContent =
  | { target: FileTarget; content: ReadContent; seq: number }
  | { target: FileTarget; error: string; missing: boolean; seq: number }

/**
 * Demande venue d'ailleurs (⌘P, lien du fil) : pour une conversation, consommée une fois traitée
 * (C1) ; `seq` distingue deux demandes.
 */
export interface FilesRequest {
  seq: number
  conversationId: string
  /** Fichier à ouvrir, à la ligne. */
  target?: FileTarget
  /** Curseur dans le filtre (⌘P). */
  focusFilter?: boolean
}

/** Ce qui arrive à l'onglet de l'extérieur : la demande en cours, et qui la consomme. */
export interface FilesRequests {
  request?: FilesRequest | undefined
  onRequestDone?: ((seq: number) => void) | undefined
  /** Demande de ⌘P traitée : le curseur va au filtre. */
  onFocusFilter?: (() => void) | undefined
}

/** Outils terminés et tours finis : l'arbre et le fichier sont relus (Q29). */
function workDone(items: readonly TranscriptItem[]): number {
  let done = 0
  for (const item of items) {
    if (item.kind === 'tool' && item.status === 'completed') done++
  }
  return done
}

const isMissing = (error: string) => /ENOENT|no such file/i.test(error)

/** Racine et chemin d'une clé de dossier (`racine:chemin`). */
function splitKey(key: string): { root: number; dir: string } {
  const at = key.indexOf(':')
  return { root: Number(key.slice(0, at)), dir: key.slice(at + 1) }
}

/** L'état retenu, écrit après le rendu, une fois par changement (M8). */
function usePersistedState(conversationId: string) {
  const [state, setState] = useState<FilesState>(() => loadFilesState(conversationId))
  const saved = useRef(state)
  useEffect(() => {
    if (saved.current === state) return
    saved.current = state
    saveFilesState(conversationId, state)
  }, [conversationId, state])
  return [state, setState] as const
}

/** Relecture (Q29) : tout de suite (« Relire »), ou regroupée un instant (fins d'outil, fenêtre). */
function useReload(items: readonly TranscriptItem[]) {
  const [generation, setGeneration] = useState(0)
  const reload = useCallback(() => setGeneration((g) => g + 1), [])
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const reloadSoon = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(reload, RELOAD_DELAY_MS)
  }, [reload])
  useEffect(() => () => clearTimeout(timer.current), [])
  const done = workDone(items)
  const lastDone = useRef(done)
  useEffect(() => {
    if (done === lastDone.current) return
    lastDone.current = done
    reloadSoon()
  }, [done, reloadSoon])
  useEffect(() => {
    window.addEventListener('focus', reloadSoon)
    return () => window.removeEventListener('focus', reloadSoon)
  }, [reloadSoon])
  return { generation, reload }
}

/**
 * Dossiers dépliés (et la racine principale) : lus s'ils ne le sont pas, ou à chaque relecture.
 * Une réponse d'une relecture dépassée est jetée (M3) ; un dossier disparu est oublié (C4).
 */
function useListings(
  conversationId: string,
  roots: readonly FileRoot[] | null,
  expanded: readonly string[],
  generation: number,
  forget: (key: string) => void
) {
  const [listings, setListings] = useState<Record<string, Listing>>({})
  const api = window.api.fileTree
  const wanted = roots
    ? [...new Set([dirKey(0, ''), ...expanded])].filter((key) => !!roots[splitKey(key).root])
    : []
  const requested = useRef<Record<string, number>>({})
  useEffect(() => {
    for (const key of wanted) {
      if (requested.current[key] === generation) continue
      requested.current[key] = generation
      const { root, dir } = splitKey(key)
      const current = () => requested.current[key] === generation
      api
        .list(conversationId, root, dir)
        .then((listing) => current() && setListings((all) => ({ ...all, [key]: { listing } })))
        .catch((e: unknown) => {
          if (!current()) return
          const error = ipcErrorText(e)
          setListings((all) => ({ ...all, [key]: { error } }))
          if (dir && isMissing(error)) forget(key)
        })
    }
  })
  return listings
}

/**
 * Fichier ouvert : lu à l'ouverture et à chaque relecture ; relu seulement s'il a changé (le main
 * répond `unchanged`, C4). Attend les racines : un rang retenu n'est lu qu'une fois vérifié (M2).
 */
function useOpenContent(
  conversationId: string,
  open: FileTarget | undefined,
  rootsReady: boolean,
  generation: number
) {
  const [content, setContent] = useState<OpenContent | null>(null)
  const latest = useRef(content)
  useEffect(() => {
    latest.current = content
  })
  const api = window.api.fileTree
  const openKey = open ? `${open.root}:${open.path}` : ''
  useEffect(() => {
    if (!open || !rootsReady) return
    let alive = true
    const target = open
    const shown = latest.current
    const sameFile =
      !!shown && shown.target.root === target.root && shown.target.path === target.path
    const known =
      sameFile && shown && 'content' in shown
        ? { modified: shown.content.modified, size: shown.content.size }
        : undefined
    api
      .read(conversationId, target.root, target.path, known)
      .then((read) => {
        // Rien n'a changé sur le disque : le même contenu, rien à recolorer (point 25).
        if (!alive || read.kind === 'unchanged') return
        setContent({ target, content: read, seq: generation })
      })
      .catch((e: unknown) => {
        if (!alive) return
        const error = ipcErrorText(e)
        setContent({ target, error, missing: isMissing(error), seq: generation })
      })
    return () => {
      alive = false
    }
    // `open.line` ne relit pas le fichier : seule la position change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- relu par fichier et par relecture
  }, [api, conversationId, openKey, rootsReady, generation])
  return content
}

/**
 * Ce que l'onglet Fichiers lit et retient (fiche 271) : racines, dossiers dépliés (un niveau lu à
 * l'ouverture), fichier ouvert, filtre ; relu à la fin des outils, au retour sur la fenêtre et par
 * « Relire ». Rien n'est surveillé en continu.
 */
export function useFilesTab(
  conversationId: string,
  items: readonly TranscriptItem[],
  requests: FilesRequests = {}
) {
  const [state, setState] = usePersistedState(conversationId)
  const [preferences, setPreferencesRaw] = useState(loadFilesPreferences)
  const setPreferences = (change: Partial<FilesPreferences>) =>
    setPreferencesRaw((current) => {
      const next = { ...current, ...change }
      saveFilesPreferences(next)
      return next
    })
  // Panneau étroit : l'arbre ou le fichier ouvert (Q18).
  const [view, setView] = useState<'tree' | 'file'>(state.open ? 'file' : 'tree')
  const [roots, setRoots] = useState<FileRoot[] | null>(null)
  const [rootsError, setRootsError] = useState<string | null>(null)
  const { generation, reload } = useReload(items)
  const api = window.api.fileTree

  // Racines de la conversation ; l'état retenu est confronté à leurs chemins (M2).
  useEffect(() => {
    let alive = true
    api
      .roots(conversationId)
      .then((found) => {
        if (!alive) return
        setRoots(found)
        setRootsError(null)
        setState((s) =>
          reconcileRoots(
            s,
            found.map((r) => r.path)
          )
        )
      })
      .catch((e: unknown) => alive && setRootsError(ipcErrorText(e)))
    return () => {
      alive = false
    }
  }, [api, conversationId, generation, setState])

  const forget = useCallback((key: string) => setState((s) => forgetDir(s, key)), [setState])
  const listings = useListings(conversationId, roots, state.expanded, generation, forget)
  const open = state.open
  const content = useOpenContent(conversationId, open, !!roots, generation)

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
        () => setState((s) => (s.open ? { ...s, scroll } : s)),
        SCROLL_SAVE_MS
      )
    },
    [setState]
  )

  const show = useCallback(
    (target: FileTarget) =>
      setState((s) => revealIn(openFile(s, target), target.root, parentDirs(target.path))),
    [setState]
  )

  // Demandes (⌘P, lien du fil) : celles de cette conversation seulement (C1). La vue suit pendant
  // le rendu (son propre état) ; le fichier s'ouvre après le rendu, puis la demande est consommée
  // (M8).
  const { request, onRequestDone, onFocusFilter } = requests
  const mine = request?.conversationId === conversationId ? request : undefined
  const [viewFor, setViewFor] = useState(0)
  if (mine && mine.seq !== viewFor && (mine.target || mine.focusFilter)) {
    setViewFor(mine.seq)
    setView(mine.target ? 'file' : 'tree')
  }
  useEffect(() => {
    if (!mine) return
    if (mine.target) show(mine.target)
    else if (mine.focusFilter) onFocusFilter?.()
    onRequestDone?.(mine.seq)
  }, [mine, show, onRequestDone, onFocusFilter])

  return {
    state,
    roots,
    rootsError,
    listings,
    // Contenu du fichier ouvert seulement (un fichier fermé n'a plus de contenu).
    content: open ? content : null,
    preferences,
    setPreferences,
    /** Panneau étroit : l'arbre ou le fichier. */
    view,
    setView,
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
    collapseDir: (root: number, path: string) => setState((s) => forgetDir(s, dirKey(root, path))),
    saveScroll
  }
}

function exclusionFilesOf(listings: Record<string, Listing>): string[] {
  const top = listings['0:']
  return top && 'listing' in top ? (top.listing.exclusionFiles ?? []) : []
}

export type FilesTabModel = ReturnType<typeof useFilesTab>
