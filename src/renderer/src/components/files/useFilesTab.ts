import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  parentDirs,
  type FileContent,
  type FileListing,
  type FileRoot,
  type FileTarget
} from '@shared/files'
import { conversationChanges } from '@shared/changes'
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

/**
 * Outils finis, réussis ou en échec (un outil en échec a pu écrire) : l'arbre et le fichier sont
 * relus à chaque fin (Q29). Calculé par le panneau, l'onglet ne reçoit que ce nombre (C7).
 */
export function workDone(items: readonly TranscriptItem[]): number {
  let done = 0
  for (const item of items) {
    if (item.kind === 'tool' && (item.status === 'completed' || item.status === 'failed')) done++
  }
  return done
}

/**
 * Ce que l'onglet Fichiers retient du fil (C7) : chemins modifiés par la conversation et outils
 * finis, stables d'un morceau de réponse à l'autre (rien ne change tant qu'aucun outil ne finit).
 */
export function useFilesWork(items: readonly TranscriptItem[]): {
  changes: readonly string[]
  done: number
} {
  const paths = conversationChanges(items).map((file) => file.path)
  const key = paths.join('\n')
  // Mêmes chemins : le même tableau (l'arbre ne se redessine pas à chaque morceau de réponse).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recalculé quand la liste change
  const changes = useMemo(() => paths, [key])
  return { changes, done: workDone(items) }
}

/**
 * Chemins des dossiers de la conversation (pour situer ses remarques sur des fichiers, onglet
 * Modifications). Relus sur les mêmes événements que l'onglet Fichiers : dossiers ajoutés ou
 * retirés (`rootsKey`), fin d'outil, retour sur la fenêtre (4e revue, G1) ; une lecture en échec
 * laisse `null` (remarques montrées sans être situées) et la suivante réessaie (G2).
 */
export function useFileRootPaths(
  conversationId: string,
  enabled = true,
  rootsKey = '',
  done = 0
): string[] | null {
  const [paths, setPaths] = useState<{ id: string; key: string; paths: string[] } | null>(null)
  const { generation } = useReload(done)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    window.api.fileTree
      .roots(conversationId)
      .then(
        (roots) =>
          alive && setPaths({ id: conversationId, key: rootsKey, paths: roots.map((r) => r.path) })
      )
      // Lecture en échec : les remarques restent montrées, non situées, jusqu'à la suivante.
      .catch(() => alive && setPaths(null))
    return () => {
      alive = false
    }
  }, [conversationId, enabled, rootsKey, generation])
  // Une réponse d'avant un changement de dossiers ne situe plus rien (les rangs ont pu bouger).
  return paths?.id === conversationId && paths.key === rootsKey ? paths.paths : null
}

/**
 * Racines relues : « non transmis » inconnu (agent qui redémarre) garde la dernière valeur connue
 * du même dossier, sans clignoter (4e revue, mineur).
 */
function keepKnownNotSent(current: readonly FileRoot[] | null, found: FileRoot[]): FileRoot[] {
  if (!current) return found
  return found.map((root) => {
    if (root.notSent !== undefined) return root
    const before = current.find((r) => r.path === root.path)
    return before?.notSent === undefined ? root : { ...root, notSent: before.notSent }
  })
}

/** Deux listes de racines identiques (chemins, marques) ? */
function sameRoots(a: readonly FileRoot[], b: readonly FileRoot[]): boolean {
  return (
    a.length === b.length &&
    a.every((r, i) => {
      const o = b[i]
      return !!o && r.path === o.path && r.missing === o.missing && r.notSent === o.notSent
    })
  )
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
function useReload(done: number) {
  const [generation, setGeneration] = useState(0)
  const reload = useCallback(() => setGeneration((g) => g + 1), [])
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const reloadSoon = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(reload, RELOAD_DELAY_MS)
  }, [reload])
  useEffect(() => () => clearTimeout(timer.current), [])
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

/** Clé d'un dossier dont tous les parents sont dépliés (sinon, il n'est pas à l'écran). */
function visibleKey(key: string, expanded: ReadonlySet<string>): boolean {
  const { root, dir } = splitKey(key)
  if (root > 0 && !expanded.has(dirKey(root, ''))) return false
  return parentDirs(dir).every((parent) => expanded.has(dirKey(root, parent)))
}

/**
 * Dossiers dépliés et à l'écran (C2) : lus s'ils ne le sont pas, ou à chaque relecture, en un appel
 * par racine (un seul `git check-ignore`). Une réponse d'une relecture dépassée est jetée (M3) ; un
 * dossier disparu est oublié (C4).
 */
function useListings(
  conversationId: string,
  roots: readonly FileRoot[] | null,
  expandedKeys: readonly string[],
  generation: number,
  forget: (key: string) => void
) {
  const [listings, setListings] = useState<Record<string, Listing>>({})
  const api = window.api.fileTree
  const expanded = new Set([dirKey(0, ''), ...expandedKeys])
  const wanted = roots
    ? [...expanded].filter((key) => !!roots[splitKey(key).root] && visibleKey(key, expanded))
    : []
  const requested = useRef<Record<string, number>>({})
  useEffect(() => {
    const byRoot = new Map<number, string[]>()
    for (const key of wanted) {
      if (requested.current[key] === generation) continue
      requested.current[key] = generation
      const { root, dir } = splitKey(key)
      byRoot.set(root, [...(byRoot.get(root) ?? []), dir])
    }
    for (const [root, dirs] of byRoot) {
      const current = (dir: string) => requested.current[dirKey(root, dir)] === generation
      const put = (dir: string, value: Listing) =>
        setListings((all) => ({ ...all, [dirKey(root, dir)]: value }))
      api
        .listMany(conversationId, root, dirs)
        .then((pairs) => {
          // Une table sans prototype : un dossier `__proto__` est un dossier (3e revue, 1).
          const found = new Map(pairs)
          for (const dir of dirs) {
            const got = found.get(dir)
            if (!current(dir) || !got) continue
            if ('error' in got) {
              put(dir, { error: got.error })
              if (dir && isMissing(got.error)) forget(dirKey(root, dir))
            } else put(dir, { listing: got })
          }
        })
        .catch((e: unknown) => {
          const error = ipcErrorText(e)
          for (const dir of dirs) if (current(dir)) put(dir, { error })
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
  /** Outils finis dans la conversation (`workDone`) : chaque fin relit l'arbre et le fichier. */
  done: number,
  requests: FilesRequests = {},
  /**
   * Dossiers de la conversation et ce qu'en sait l'agent : quand cela change, les racines sont
   * relues (dossier ajouté ou retiré, marque « non transmis »).
   */
  rootsKey = ''
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
  const { generation, reload } = useReload(done)
  const api = window.api.fileTree

  // Racines de la conversation ; l'état retenu est confronté à leurs chemins (M2).
  useEffect(() => {
    let alive = true
    api
      .roots(conversationId)
      .then((found) => {
        if (!alive) return
        // Mêmes racines : le même tableau (l'arbre et le filtre ne repartent pas, 3e revue).
        setRoots((current) => {
          const next = keepKnownNotSent(current, found)
          return current && sameRoots(current, next) ? current : next
        })
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
  }, [api, conversationId, generation, setState, rootsKey])

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

  // Un autre fichier ouvert : le défilement en attente n'était pas le sien.
  const cancelScroll = () => clearTimeout(scrollTimer.current)
  const show = useCallback(
    (target: FileTarget) => {
      clearTimeout(scrollTimer.current)
      setState((s) => revealIn(openFile(s, target), target.root, parentDirs(target.path)))
    },
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
  // Après la réconciliation des racines (C3) : un rang retenu périmé ne referme pas le fichier.
  const rootsReady = !!roots
  // Chaque demande n'est traitée qu'une fois, même si le panneau tarde à la consommer.
  const handled = useRef(0)
  useEffect(() => {
    if (!mine || !rootsReady || handled.current === mine.seq) return
    handled.current = mine.seq
    if (mine.target) show(mine.target)
    else if (mine.focusFilter) onFocusFilter?.()
    onRequestDone?.(mine.seq)
  }, [mine, rootsReady, show, onRequestDone, onFocusFilter])

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
    close: () => {
      cancelScroll()
      setState(closeFile)
    },
    step: (delta: -1 | 1) => {
      cancelScroll()
      setState((s) => stepFile(s, delta))
    },
    /** La ligne demandée (lien du fil) a été montrée : oubliée, le défilement prend le relais (C4). */
    lineShown: () =>
      setState((s) => {
        if (!s.open?.line) return s
        const { line: _line, ...open } = s.open
        return { ...s, open }
      }),
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
