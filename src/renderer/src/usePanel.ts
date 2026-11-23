import type { DiffTarget } from '@shared/review'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MarkdownDocument } from '@shared/file-links'
import { isPanelTab, type PanelTab } from '@shared/panel'
import type { TranscriptItem } from '@shared/transcript'
import type { ChangesView } from './components/panel/ChangesTab'
import {
  fittedPanelWidth,
  loadClosedTabs,
  PANEL_MIN_WIDTH,
  panelAutoOpens,
  panelFits,
  panelTabsUsed,
  saveClosedTabs,
  tabAfterClose,
  unavailablePanelTabs,
  visiblePanelTabs
} from './panel-tabs'
import { platformFeatures } from './platform-features'
import { PANEL_DEFAULT_WIDTH, panelWidthToSave, savedPanelWidth } from './panel-width'
import { fittedSidebarWidth, readSidebarWidth } from './components/sidebar/sidebar-width'
import type { FileTarget } from '@shared/files'
import type { FilesRequest } from './components/files/useFilesTab'
import type { OpenFileLink } from './components/thread/FileLink'
import {
  FILES_FORGET_EVENT,
  FILES_OPEN_KEY,
  findInOpenFile,
  TOGGLE_TREE_EVENT
} from './files-state'

/** Conversations dont on garde l'onglet Fichiers ouvert (les plus récentes). */
const MAX_FILES_OPEN = 100

/** Conversations où l'onglet Fichiers est ouvert, retenues d'un lancement à l'autre (fiche 271, Q2). */
function loadFilesOpen(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(FILES_OPEN_KEY) ?? '[]') as unknown
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function saveFilesOpen(ids: readonly string[]): void {
  try {
    localStorage.setItem(FILES_OPEN_KEY, JSON.stringify(ids.slice(-MAX_FILES_OPEN)))
  } catch {
    // Stockage indisponible : l'onglet ne reviendra pas au prochain lancement.
  }
}

export interface PanelState {
  open: boolean
  tab: PanelTab
  width: number
  /** Largeur tirée à la main (fiche 226) : seule celle-là est enregistrée. */
  customWidth: boolean
}

const PANEL_KEY = 'bobine.panel'

/** État enregistré dans `bobine.panel` (`width` : ancienne largeur, lue une dernière fois). */
interface SavedPanel {
  open?: unknown
  tab?: unknown
  width?: unknown
  customWidth?: unknown
}

/**
 * État du panneau mémorisé pour cette fenêtre (commodité : absent, on repart des défauts). La
 * largeur n'est reprise que si l'utilisateur l'a réglée (fiche 226, `panel-width.ts`).
 */
function loadPanel(): PanelState {
  const fallback: PanelState = {
    open: false,
    tab: 'session',
    width: PANEL_DEFAULT_WIDTH,
    customWidth: false
  }
  try {
    const saved = JSON.parse(localStorage.getItem(PANEL_KEY) ?? 'null') as SavedPanel | null
    if (!saved) return fallback
    const custom = savedPanelWidth(saved)
    return {
      open: saved.open === true,
      // L'aperçu d'un document ne survit pas au redémarrage (fiche 052).
      tab: isPanelTab(saved.tab) && saved.tab !== 'document' ? saved.tab : fallback.tab,
      width: custom ?? fallback.width,
      customWidth: custom !== null
    }
  } catch {
    return fallback
  }
}

function savePanel(panel: PanelState): void {
  try {
    localStorage.setItem(
      PANEL_KEY,
      JSON.stringify({
        open: panel.open,
        tab: panel.tab,
        ...panelWidthToSave(panel.width, panel.customWidth)
      })
    )
  } catch {
    // Stockage indisponible : le panneau repartira de ses réglages par défaut.
  }
}

/** Document en aperçu dans le panneau (fiche 052), et la conversation dont il vient. */
export interface PanelPreview {
  conversationId: string
  document: MarkdownDocument
}

/**
 * Panneau de droite (fiche 029) : ouvert à la main, ou quand l'agent se sert d'un outil de l'app ;
 * ses onglets (fiche 082), agrandi ou non, le terminal (⌃`, fiche 034), la vue demandée des
 * modifications et le document en aperçu.
 */
/** Onglets qui prennent le clavier quand l'utilisateur les ouvre. */
const KEYBOARD_TABS: readonly PanelTab[] = ['terminal', 'browser']

export function usePanel(options: {
  /** Conversation active : les onglets ouverts et fermés sont les siens. */
  conversationId: string | null
  /** Dernier onglet demandé par l'agent (`seq` : nouveauté). */
  request: { tab: PanelTab; seq: number } | null
  /** Fil de la conversation active : ses outils ont un onglet. */
  items: readonly TranscriptItem[]
  /** L'agent a modifié des fichiers dans la conversation. */
  hasChanges: boolean
  /**
   * Ouverture d'office sur « Session » (fiche 166) : la conversation a un fil et rien ne la
   * recouvre (« Mon activité » fermée). Absent : jamais.
   */
  autoOpen?: { eligible: boolean; sidebarOpen: boolean }
  /** Espace Discussion (fiche 224) : ses « Documents », pas d'outils de Bobine. */
  discussion?: boolean
}) {
  const { conversationId, request, items, hasChanges, autoOpen, discussion } = options
  const [panel, setPanel] = useState(loadPanel)
  const update = useCallback(
    (change: Partial<PanelState>) => setPanel((current) => ({ ...current, ...change })),
    []
  )
  useEffect(() => savePanel(panel), [panel])
  // Bord tiré à la main : la largeur est retenue ; double-clic : retour au défaut (fiche 226).
  const resize = useCallback(
    (width: number) => update({ width: Math.max(PANEL_MIN_WIDTH, width), customWidth: true }),
    [update]
  )
  const resetWidth = useCallback(
    () => update({ width: PANEL_DEFAULT_WIDTH, customWidth: false }),
    [update]
  )
  // Ouverture réelle (fermé → ouvert) : le panneau glisse en arrivant, une fois (fiche 185, P1).
  // Un panneau déjà ouvert qui se remonte (agrandi puis réduit, page des tâches) ne rejoue rien.
  const [openings, setOpenings] = useState({ open: panel.open, count: 0 })
  if (openings.open !== panel.open) {
    setOpenings({ open: panel.open, count: openings.count + (panel.open ? 1 : 0) })
  }
  // Panneau agrandi à la place de la conversation (fiche 082). Pas mémorisé : réduit en fermant le
  // panneau ou en changeant de conversation (ajustements pendant le rendu).
  const [maximizeWanted, setMaximized] = useState(false)
  const [maximizedFor, setMaximizedFor] = useState(conversationId)
  if (maximizedFor !== conversationId) {
    setMaximizedFor(conversationId)
    if (maximizeWanted) setMaximized(false)
  }
  if (!panel.open && maximizeWanted) setMaximized(false)
  const maximized = panel.open && maximizeWanted
  // Onglets ouverts dans chaque conversation depuis le lancement (à la main, ou par l'agent) : ils
  // gardent leur place dans le panneau. Ceux fermés (✕) restent cachés, même d'un lancement à
  // l'autre, jusqu'à ce qu'on les rouvre ou que l'agent s'en serve à nouveau (fiche 082).
  const [openedTabs, setOpenedTabs] = useState<Record<string, PanelTab[]>>({})
  const [closedTabs, setClosedTabs] = useState(loadClosedTabs)
  useEffect(() => saveClosedTabs(closedTabs), [closedTabs])
  const [arrivalOrder, setArrivalOrder] = useState<Record<string, PanelTab[]>>({})
  // Onglet Fichiers ouvert, par conversation, retenu au redémarrage (fiche 271, Q2).
  const [filesOpen, setFilesOpen] = useState(loadFilesOpen)
  useEffect(() => saveFilesOpen(filesOpen), [filesOpen])
  // Conversation supprimée (M9) : son onglet Fichiers n'est plus retenu.
  useEffect(() => {
    const onForget = (event: Event) => {
      const id = (event as CustomEvent<unknown>).detail
      setFilesOpen((ids) =>
        ids.includes(id as string) ? ids.filter((other) => other !== id) : ids
      )
    }
    window.addEventListener(FILES_FORGET_EVENT, onForget)
    return () => window.removeEventListener(FILES_FORGET_EVENT, onForget)
  }, [])
  const [shownTab, setShownTab] = useState<PanelTab | null>(null)
  const tabsOf = conversationId
  if (panel.open && panel.tab === 'files' && tabsOf && !filesOpen.includes(tabsOf)) {
    setFilesOpen([...filesOpen, tabsOf])
  }
  if (panel.open && panel.tab !== shownTab) {
    setShownTab(panel.tab)
    if (tabsOf && !openedTabs[tabsOf]?.includes(panel.tab)) {
      setOpenedTabs({ ...openedTabs, [tabsOf]: [...(openedTabs[tabsOf] ?? []), panel.tab] })
    }
  }
  // Onglet affiché (rouvert, ou demandé par l'agent) : il n'est plus fermé.
  if (panel.open && tabsOf && closedTabs[tabsOf]?.includes(panel.tab)) {
    setClosedTabs({
      ...closedTabs,
      [tabsOf]: closedTabs[tabsOf].filter((tab) => tab !== panel.tab)
    })
  }
  const closedByApp = useAutoOpen(panel, update, conversationId, autoOpen, closedTabs)
  const room = useFittedSidebar(autoOpen?.sidebarOpen ?? false)
  useRoomForConversation(panel, update, room, maximized, closedByApp)
  // Demande de l'agent pas encore vue : on ouvre l'onglet (ajustement pendant le rendu).
  const [seenRequest, setSeenRequest] = useState(0)
  if (request && request.seq !== seenRequest) {
    setSeenRequest(request.seq)
    update({ open: true, tab: request.tab })
  }
  // ⌃` et menu Affichage (fiche 034) : ouvre le terminal à droite, clavier compris, ou le referme.
  // Onglet qui doit prendre le clavier en s'affichant : le terminal, ou la page du navigateur quand
  // l'utilisateur les ouvre (seconde chasse rc.4 : le focus restait sur la page de l'app).
  const [focusTab, setFocusTab] = useState<PanelTab | null>(null)
  const terminalOpen = panel.open && panel.tab === 'terminal'
  const toggleTerminal = useCallback(() => {
    setFocusTab(terminalOpen ? null : 'terminal')
    setPanel((current) =>
      terminalOpen ? { ...current, open: false } : { ...current, open: true, tab: 'terminal' }
    )
  }, [terminalOpen])
  /** Menu du dossier (fiche 158) : ouvre le terminal, clavier compris, sans jamais le refermer. */
  /** Onglet choisi par l'utilisateur : le terminal et le navigateur prennent le clavier. */
  const select = useCallback(
    (tab: PanelTab) => {
      setFocusTab(KEYBOARD_TABS.includes(tab) ? tab : null)
      update({ tab })
    },
    [update]
  )
  const showTerminal = useCallback(() => {
    setFocusTab('terminal')
    setPanel((current) => ({ ...current, open: true, tab: 'terminal' }))
  }, [])
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.ctrlKey && !event.metaKey && !event.altKey && event.code === 'Backquote') {
        // Capturé avant xterm.js : le raccourci marche aussi le terminal ayant le clavier.
        event.preventDefault()
        event.stopPropagation()
        toggleTerminal()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [toggleTerminal])

  const changesOpen = panel.open && panel.tab === 'changes'
  // « Modifications » sur une vue précise : celle de l'agent (pastille) ou l'état git (branche).
  // `file` : un fichier à ouvrir, ses lignes à montrer (remarque du Code reviewer, fiche 265).
  const [changesRequest, setChangesRequest] = useState<{
    view: ChangesView
    seq: number
    file?: DiffTarget
  }>()
  const openChanges = (view: ChangesView, file?: DiffTarget) => {
    setChangesRequest((current) => ({
      view,
      seq: (current?.seq ?? 0) + 1,
      ...(file ? { file } : {})
    }))
    update({ open: true, tab: 'changes' })
  }

  // Document en aperçu (fiche 052) : un `.md` cité dans le fil, ou une règle (fiche 056).
  const [preview, setPreview] = useState<PanelPreview | null>(null)
  const showDocument = useCallback(
    (conversationId: string, document: MarkdownDocument) => {
      setPreview({ conversationId, document })
      update({ open: true, tab: 'document' })
    },
    [update]
  )
  const updateDocument = useCallback(
    (document: MarkdownDocument) =>
      setPreview((current) => (current ? { ...current, document } : current)),
    []
  )

  // Onglet Fichiers (fiche 271) : ⌘P (curseur dans le filtre), lien de fichier du fil (à la ligne).
  // Une demande vaut pour une conversation et se consomme une fois traitée (C1) : elle ne se
  // rejoue ni au retour sur l'onglet, ni dans une autre conversation.
  const [filesRequest, setFilesRequest] = useState<FilesRequest>()
  const filesSeq = useRef(0)
  const openFiles = useCallback(
    (request: Omit<FilesRequest, 'seq' | 'conversationId'> = {}, forId?: string) => {
      const target = forId ?? conversationId
      // L'onglet Fichiers n'existe qu'en espace Code (Q4).
      if (!target || discussion) return
      filesSeq.current += 1
      setFilesRequest({ ...request, conversationId: target, seq: filesSeq.current })
      update({ open: true, tab: 'files' })
    },
    [update, conversationId, discussion]
  )
  const filesRequestDone = useCallback(
    (seq: number) => setFilesRequest((current) => (current?.seq === seq ? undefined : current)),
    []
  )

  // Onglets du panneau (fiche 082) : les outils qui servent dans la conversation.
  const usedTabs = useMemo(() => panelTabsUsed(items), [items])
  const arrival = (conversationId && arrivalOrder[conversationId]) || []
  const tabs = visiblePanelTabs({
    used: usedTabs,
    active: panel.tab,
    opened: new Set([
      ...(conversationId ? (openedTabs[conversationId] ?? []) : []),
      ...(conversationId && filesOpen.includes(conversationId) ? (['files'] as const) : [])
    ]),
    closed: new Set(conversationId ? (closedTabs[conversationId] ?? []) : []),
    hasChanges,
    hasPreview: !!preview,
    unavailable: unavailablePanelTabs(platformFeatures(), discussion),
    discussion: !!discussion,
    arrival
  })
  // Ordre d'arrivée retenu (fiche 154) : un onglet qui apparaît s'ajoute à droite et ne bouge plus ;
  // un onglet qui part (✕, aperçu fermé) quitte l'ordre et revient à droite s'il revient.
  if (conversationId && tabs.join() !== arrival.join()) {
    setArrivalOrder({ ...arrivalOrder, [conversationId]: tabs })
  }
  // ✕ d'un onglet : il quitte le panneau, l'outil continue (page, terminaux) ; l'onglet voisin
  // s'affiche, ou le panneau se ferme s'il n'en reste pas.
  const closeTab = (tab: PanelTab) => {
    const id = conversationId
    if (tab === 'document') setPreview(null)
    else if (id) {
      if (tab === 'files') setFilesOpen(filesOpen.filter((other) => other !== id))
      // En dernier : les conversations récentes sont celles qu'on garde (`saveClosedTabs`).
      const others = Object.entries(closedTabs).filter(([key]) => key !== id)
      const kept = [...(closedTabs[id] ?? []).filter((t) => t !== tab), tab]
      setClosedTabs(Object.fromEntries([...others, [id, kept]]))
      setOpenedTabs({ ...openedTabs, [id]: (openedTabs[id] ?? []).filter((t) => t !== tab) })
    }
    if (panel.tab !== tab) return
    const next = tabAfterClose(tabs, tab)
    update(next ? { tab: next } : { open: false })
  }

  return {
    ...panel,
    // Largeur affichée : le panneau cède la place que la conversation réclame (fiche 173).
    width: fittedPanelWidth(panel.width, room.window, room.shown),
    maxWidth: fittedPanelWidth(Number.POSITIVE_INFINITY, room.window, room.shown),
    update,
    resize,
    resetWidth,
    maximized,
    setMaximized,
    tabs,
    closeTab,
    focusTab,
    /** L'onglet a pris le clavier : la demande est faite. */
    tabFocused: () => setFocusTab(null),
    select,
    toggleTerminal,
    showTerminal,
    changesOpen,
    changesRequest,
    openChanges,
    preview,
    showDocument,
    filesRequest,
    openFiles,
    /** ⌘F le focus dans un fichier ouvert : y chercher (fiche 271) ; `false` sinon. */
    findInFile: findInOpenFile,
    /** ⌘P (curseur dans le filtre) et ⇧⌘Y (l'arbre) ; rien dans l'espace Discussion. */
    filesCommands: {
      files: () => {
        if (!discussion) openFiles({ focusFilter: true })
      },
      'files-tree': () => {
        if (discussion) return
        if (panel.open && panel.tab === 'files') window.dispatchEvent(new Event(TOGGLE_TREE_EVENT))
        else openFiles()
      }
    },
    /**
     * Lignes des travaux délégués (fiche 161) : ouvrir leur conversation, ou « Parcourir les
     * fichiers » — sa conversation, onglet Fichiers (fiche 271, Q7).
     */
    childLinks: (select: (id: string) => void) => ({
      onOpen: select,
      onBrowse: (id: string) => {
        select(id)
        openFiles({}, id)
      }
    }),
    /** Ce que l'onglet Fichiers reçoit : demande, liens, mention dans la saisie, diff d'un fichier. */
    filesTab: (
      openLink: OpenFileLink,
      inbox: { mention: (paths: string[]) => void; focus: () => void },
      /** Dossier de la conversation disparu : le choix de dossier existant (Q19). */
      chooseFolder?: () => void
    ) => ({
      ...(chooseFolder ? { onChooseFolder: chooseFolder } : {}),
      /** Remarque sur un fichier cliquée dans Modifications : le fichier, à la ligne. */
      onOpenFile: (target: FileTarget) => openFiles({ target }),
      request: filesRequest,
      onRequestDone: filesRequestDone,
      openLink,
      onMention: (paths: string[]) => inbox.mention(paths),
      onFocusComposer: () => inbox.focus(),
      onShowChanges: () => openChanges('conversation'),
      onShowDiff: (path: string) => openChanges('conversation', { path })
    }),
    updateDocument,
    /** Numéro de l'ouverture : change à chaque ouverture réelle, 0 au lancement. */
    opening: openings.count
  }
}

/**
 * Ouverture d'office du panneau sur « Session » (fiche 166), à chaque ouverture d'une conversation
 * (ou à l'arrivée de son premier message) : panneau fermé, place suffisante, et pas fermé par
 * l'utilisateur dans cette conversation depuis le lancement. Ajustements pendant le rendu.
 */
function useAutoOpen(
  panel: PanelState,
  update: (change: Partial<PanelState>) => void,
  conversationId: string | null,
  autoOpen: { eligible: boolean; sidebarOpen: boolean } | undefined,
  closedTabs: Record<string, PanelTab[]>
): () => void {
  // Conversations où l'utilisateur a fermé le panneau (session de l'app).
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set())
  const [wasOpen, setWasOpen] = useState(panel.open)
  // Conversation affichée, et si son ouverture a déjà été traitée.
  const [shown, setShown] = useState({ id: conversationId, done: false })
  const done = shown.id === conversationId && shown.done
  if (shown.id !== conversationId && !autoOpen?.eligible) {
    setShown({ id: conversationId, done: false })
  }
  if (wasOpen !== panel.open) {
    setWasOpen(panel.open)
    if (!panel.open && conversationId && !dismissed.has(conversationId)) {
      setDismissed(new Set([...dismissed, conversationId]))
    }
  }
  if (!done && conversationId && autoOpen?.eligible) {
    setShown({ id: conversationId, done: true })
    const windowWidth = window.innerWidth
    const opens = panelAutoOpens({
      open: panel.open,
      dismissed: dismissed.has(conversationId),
      sessionClosed: closedTabs[conversationId]?.includes('session') ?? false,
      windowWidth,
      sidebarWidth: autoOpen.sidebarOpen ? fittedSidebarWidth(readSidebarWidth(), windowWidth) : 0,
      panelWidth: panel.width
    })
    if (opens) {
      update({ open: true, tab: 'session' })
      // Ouverture de l'app, pas de l'utilisateur : ce n'est pas une fermeture qui suivra.
      setWasOpen(true)
    }
  }
  // Repli par l'app faute de place (fiche 173) : pas une fermeture de l'utilisateur.
  return () => setWasOpen(false)
}

/** Largeur de la fenêtre, suivie, et celle de la barre latérale telle qu'affichée (fiche 113). */
function useFittedSidebar(sidebarOpen: boolean): { window: number; shown: number } {
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return {
    window: windowWidth,
    shown: sidebarOpen ? fittedSidebarWidth(readSidebarWidth(), windowWidth) : 0
  }
}

/**
 * La conversation garde sa place (fiche 173, règle de la fiche 113) : quand la fenêtre rétrécit au
 * point que le panneau, même à sa largeur minimale, ne lui laisse plus 500 px, l'app replie le
 * panneau ; il revient sur le même onglet quand la fenêtre s'élargit assez. Ce repli n'est pas une
 * fermeture de l'utilisateur (`closedByApp`) : l'ouverture d'office reste possible. Un panneau ouvert à la main dans une fenêtre déjà
 * étroite reste ouvert : c'est le choix de l'utilisateur. Ajustements pendant le rendu.
 */
function useRoomForConversation(
  panel: PanelState,
  update: (change: Partial<PanelState>) => void,
  room: { window: number; shown: number },
  maximized: boolean,
  closedByApp: () => void
): void {
  const { window: windowWidth, shown } = room
  const [lastWidth, setLastWidth] = useState(windowWidth)
  const [folded, setFolded] = useState(false)
  // Rouvert entre-temps (à la main, par l'agent) : plus rien à rendre.
  if (folded && panel.open) setFolded(false)
  if (lastWidth === windowWidth) return
  setLastWidth(windowWidth)
  const fits = panelFits(windowWidth, shown)
  // Agrandi, le panneau tient lieu de conversation : il reste.
  if (windowWidth < lastWidth && !fits && panel.open && !maximized) {
    setFolded(true)
    closedByApp()
    update({ open: false })
  } else if (folded && fits) {
    setFolded(false)
    update({ open: true })
  }
}
