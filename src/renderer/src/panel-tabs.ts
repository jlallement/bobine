/**
 * Onglets affichés dans le panneau de droite (fiche 082) : seulement les outils qui servent dans la
 * conversation, avec leur nom ; les autres restent dans le menu « + ». Dans l'ordre d'arrivée
 * (fiche 154) : un onglet qui apparaît s'ajoute à droite, les autres ne bougent plus. Le premier
 * ordre se déduit de la première utilisation dans le fil, puis des onglets ouverts à la main.
 */
import type { AppToolGroup } from '@shared/app-tools'
import type { PlatformFeatures } from '@shared/platform'
import { PANEL_TABS, type PanelTab } from '@shared/panel'
import type { TranscriptItem } from '@shared/transcript'
import { CONVERSATION_MIN_WIDTH } from './components/sidebar/sidebar-width'

/** Largeur minimale du panneau (en le redimensionnant, et relue au lancement). */
export const PANEL_MIN_WIDTH = 280

export interface AutoOpenInput {
  /** Le panneau est déjà ouvert : il garde son onglet. */
  open: boolean
  /** L'utilisateur a fermé le panneau dans cette conversation (session de l'app). */
  dismissed: boolean
  /** L'utilisateur a fermé l'onglet « Session » de cette conversation (✕). */
  sessionClosed: boolean
  windowWidth: number
  /** Barre latérale telle qu'affichée (0 si masquée). */
  sidebarWidth: number
  panelWidth: number
}

/**
 * Ouverture d'office du panneau sur « Session » à l'ouverture d'une conversation (fiche 166) :
 * seulement si la conversation garde la place de la fiche 113 (`CONVERSATION_MIN_WIDTH`) à côté.
 */
export function panelAutoOpens(input: AutoOpenInput): boolean {
  if (input.open || input.dismissed || input.sessionClosed) return false
  const room = input.windowWidth - input.sidebarWidth - input.panelWidth
  return room >= CONVERSATION_MIN_WIDTH
}

/**
 * Largeur affichée du panneau (fiche 173) : celle réglée, moins ce que la conversation réclame
 * (`CONVERSATION_MIN_WIDTH`) dans cette fenêtre, jamais sous `PANEL_MIN_WIDTH`. Comme la barre
 * latérale (fiche 113) : le réglage n'est pas perdu, il revient quand la fenêtre s'élargit.
 */
export const fittedPanelWidth = (width: number, windowWidth: number, sidebarWidth: number) =>
  Math.max(PANEL_MIN_WIDTH, Math.min(width, windowWidth - sidebarWidth - CONVERSATION_MIN_WIDTH))

/** Le panneau, à sa largeur minimale, laisse sa place à la conversation. */
export const panelFits = (windowWidth: number, sidebarWidth: number) =>
  windowWidth - sidebarWidth - PANEL_MIN_WIDTH >= CONVERSATION_MIN_WIDTH

/** Onglet de chaque groupe d'outils de l'app (`ask_user` et les conversations filles n'en ont pas). */
const TAB_OF_GROUP: Record<AppToolGroup, PanelTab | undefined> = {
  browser: 'browser',
  // Un serveur de développement lancé par l'agent s'ouvre dans le navigateur intégré (fiche 030).
  preview: 'browser',
  ios: 'simulator',
  android: 'android',
  terminal: 'terminal',
  ask: undefined,
  children: undefined,
  memory: undefined,
  bobine: undefined
}

/** Onglets dont la conversation s'est servie : outils de l'app (sous-agents compris), tâches. */
export function panelTabsUsed(items: readonly TranscriptItem[]): Set<PanelTab> {
  const used = new Set<PanelTab>()
  const visit = (list: readonly TranscriptItem[]) => {
    for (const item of list) {
      if (item.kind === 'plan' && item.entries.length > 0) used.add('tasks')
      if (item.kind !== 'tool') continue
      for (const tool of [item.appTool, ...(item.appTools ?? [])]) {
        const tab = tool && TAB_OF_GROUP[tool.group]
        if (tab) used.add(tab)
      }
      if (item.work) visit(item.work)
    }
  }
  visit(items)
  return used
}

export interface VisibleTabsInput {
  /** Onglets dont la conversation s'est servie (`panelTabsUsed`). */
  used: ReadonlySet<PanelTab>
  /** Onglet affiché. */
  active: PanelTab
  /** Onglets ouverts dans cette conversation (à la main, ou par l'agent) depuis le lancement. */
  opened: ReadonlySet<PanelTab>
  /** Onglets fermés par l'utilisateur (✕) : cachés même si l'outil a servi. */
  closed: ReadonlySet<PanelTab>
  /** L'agent a modifié des fichiers dans la conversation. */
  hasChanges: boolean
  /** Un document est en aperçu (l'onglet « Aperçu » n'existe qu'à cette condition). */
  hasPreview: boolean
  /** Outils que la plateforme n'a pas (`unavailablePanelTabs`) : jamais affichés. */
  unavailable?: ReadonlySet<PanelTab>
  /**
   * Ordre d'arrivée déjà retenu pour la conversation (`usePanel`) : ces onglets gardent leur
   * place, les nouveaux viennent après. Absent : tout se déduit de `used` puis `opened`.
   */
  arrival?: readonly PanelTab[]
}

/** Onglets d'outils absents de la plateforme (fiche 145) : ni affichés, ni proposés par « + ». */
export function unavailablePanelTabs(features: PlatformFeatures): ReadonlySet<PanelTab> {
  return new Set<PanelTab>(features.simulator ? [] : ['simulator'])
}

/**
 * Onglets du panneau, dans l'ordre d'arrivée ; les autres sont dans le menu « + ». Ceux de
 * `arrival` d'abord, à leur place ; les nouveaux ensuite, dans l'ordre où le fil s'en est servi
 * (`used`), puis où ils ont été ouverts (`opened`), puis dans celui de `PANEL_TABS`.
 */
export function visiblePanelTabs(input: VisibleTabsInput): PanelTab[] {
  const { used, active, opened, closed, hasChanges, hasPreview, unavailable, arrival = [] } = input
  const shown = PANEL_TABS.map((tab) => tab.id).filter((id) => {
    if (unavailable?.has(id)) return false
    if (id === 'document') return hasPreview
    if (id === active) return true
    if (closed.has(id)) return false
    // « Session » (fiche 166) : toujours là, tant qu'on ne l'a pas fermé.
    if (id === 'session') return true
    return used.has(id) || opened.has(id) || (id === 'changes' && hasChanges)
  })
  // « Session » reste en tête, hors de l'ordre d'arrivée (fiche 166).
  const first: PanelTab[] = shown.includes('session') ? ['session'] : []
  const rest = visibleInArrival(
    shown.filter((id) => id !== 'session'),
    arrival,
    [...used, ...opened]
  )
  return [...first, ...rest]
}

function visibleInArrival(
  shown: readonly PanelTab[],
  arrival: readonly PanelTab[],
  deduced: readonly PanelTab[]
): PanelTab[] {
  const kept = arrival.filter((id) => shown.includes(id))
  const rank = (id: PanelTab) => {
    const at = deduced.indexOf(id)
    return at < 0 ? deduced.length : at
  }
  // Tri stable : à rang égal, l'ordre de `PANEL_TABS`.
  const fresh = shown.filter((id) => !kept.includes(id)).sort((a, b) => rank(a) - rank(b))
  return [...kept, ...fresh]
}

/** Onglet affiché après la fermeture de `tab` : son voisin de droite, sinon de gauche. */
export function tabAfterClose(visible: readonly PanelTab[], tab: PanelTab): PanelTab | undefined {
  const index = visible.indexOf(tab)
  const rest = visible.filter((id) => id !== tab)
  return rest[index] ?? rest[index - 1] ?? rest.at(-1)
}

const CLOSED_KEY = 'bobine.panel.closedTabs'
/** Conversations dont on garde les onglets fermés (les plus récentes). */
const MAX_CLOSED = 100

/**
 * Onglets fermés de chaque conversation, gardés d'un lancement à l'autre (commodité : absents,
 * les onglets se déduisent du fil).
 */
export function loadClosedTabs(): Record<string, PanelTab[]> {
  try {
    const saved = JSON.parse(localStorage.getItem(CLOSED_KEY) ?? '{}') as unknown
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {}
    const ids = new Set(PANEL_TABS.map((tab) => tab.id as string))
    const result: Record<string, PanelTab[]> = {}
    for (const [id, tabs] of Object.entries(saved as Record<string, unknown>)) {
      if (!Array.isArray(tabs)) continue
      const valid = tabs.filter((tab): tab is PanelTab => typeof tab === 'string' && ids.has(tab))
      if (valid.length) result[id] = valid
    }
    return result
  } catch {
    return {}
  }
}

export function saveClosedTabs(closed: Record<string, PanelTab[]>): void {
  try {
    // Les conversations ajoutées en dernier sont à la fin : on garde celles-là.
    const kept = Object.entries(closed)
      .filter(([, tabs]) => tabs.length > 0)
      .slice(-MAX_CLOSED)
    localStorage.setItem(CLOSED_KEY, JSON.stringify(Object.fromEntries(kept)))
  } catch {
    // Stockage indisponible : les onglets fermés reviendront au prochain lancement.
  }
}

/** Outils proposés par le menu « + » : ceux qui n'ont pas d'onglet, si la plateforme les a. */
export function hiddenPanelTabs(
  visible: readonly PanelTab[],
  unavailable: ReadonlySet<PanelTab> = new Set()
): PanelTab[] {
  return PANEL_TABS.map((tab) => tab.id).filter(
    (id) => id !== 'document' && !visible.includes(id) && !unavailable.has(id)
  )
}
