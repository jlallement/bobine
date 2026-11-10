import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { fittedSidebarWidth, readSidebarWidth } from './components/sidebar/sidebar-width'

export interface PanelState {
  open: boolean
  tab: PanelTab
  width: number
}

const PANEL_KEY = 'bobine.panel'

/** État du panneau mémorisé pour cette fenêtre (commodité : absent, on repart des défauts). */
function loadPanel(): PanelState {
  const fallback: PanelState = { open: false, tab: 'session', width: 380 }
  try {
    const saved = JSON.parse(
      localStorage.getItem(PANEL_KEY) ?? 'null'
    ) as Partial<PanelState> | null
    if (!saved) return fallback
    return {
      open: saved.open === true,
      // L'aperçu d'un document ne survit pas au redémarrage (fiche 052).
      tab: isPanelTab(saved.tab) && saved.tab !== 'document' ? saved.tab : fallback.tab,
      width:
        typeof saved.width === 'number' ? Math.max(PANEL_MIN_WIDTH, saved.width) : fallback.width
    }
  } catch {
    return fallback
  }
}

function savePanel(panel: PanelState): void {
  try {
    localStorage.setItem(PANEL_KEY, JSON.stringify(panel))
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
}) {
  const { conversationId, request, items, hasChanges, autoOpen } = options
  const [panel, setPanel] = useState(loadPanel)
  const update = useCallback(
    (change: Partial<PanelState>) => setPanel((current) => ({ ...current, ...change })),
    []
  )
  useEffect(() => savePanel(panel), [panel])
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
  const [shownTab, setShownTab] = useState<PanelTab | null>(null)
  const tabsOf = conversationId
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
  const [focusTerminal, setFocusTerminal] = useState(false)
  const terminalOpen = panel.open && panel.tab === 'terminal'
  const toggleTerminal = useCallback(() => {
    setFocusTerminal(!terminalOpen)
    setPanel((current) =>
      terminalOpen ? { ...current, open: false } : { ...current, open: true, tab: 'terminal' }
    )
  }, [terminalOpen])
  /** Menu du dossier (fiche 158) : ouvre le terminal, clavier compris, sans jamais le refermer. */
  const showTerminal = useCallback(() => {
    setFocusTerminal(true)
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
  const [changesRequest, setChangesRequest] = useState<{ view: ChangesView; seq: number }>()
  const openChanges = (view: ChangesView) => {
    setChangesRequest((current) => ({ view, seq: (current?.seq ?? 0) + 1 }))
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

  // Onglets du panneau (fiche 082) : les outils qui servent dans la conversation.
  const usedTabs = useMemo(() => panelTabsUsed(items), [items])
  const arrival = (conversationId && arrivalOrder[conversationId]) || []
  const tabs = visiblePanelTabs({
    used: usedTabs,
    active: panel.tab,
    opened: new Set(conversationId ? (openedTabs[conversationId] ?? []) : []),
    closed: new Set(conversationId ? (closedTabs[conversationId] ?? []) : []),
    hasChanges,
    hasPreview: !!preview,
    unavailable: unavailablePanelTabs(platformFeatures()),
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
    maximized,
    setMaximized,
    tabs,
    closeTab,
    focusTerminal,
    /** Le terminal a pris le clavier : la demande est faite. */
    terminalFocused: () => setFocusTerminal(false),
    toggleTerminal,
    showTerminal,
    changesOpen,
    changesRequest,
    openChanges,
    preview,
    showDocument,
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
