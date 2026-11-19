/**
 * Garde des navigations de la page pendant une action de l'agent (fiche 249, audit SEC-1).
 *
 * L'accord par site (fiche 072) ne valait que pour `browser_navigate` : un clic, un
 * `location = …` ou une redirection emmenaient la page ailleurs. Pendant une action de l'agent (et
 * le délai qui la suit, où ce qui arrive vient encore de lui), la page ne part pas vers un site que
 * l'utilisateur n'a pas accordé : la navigation est arrêtée et notée, l'agent en est prévenu.
 * Hors d'une action de l'agent, l'utilisateur navigue librement ; l'outil suivant de l'agent
 * vérifie alors le site affiché (`browser-tools.ts`).
 *
 * Sans `electron` : testable avec un faux émetteur.
 */

/** Ce que la garde lit et écrit sur un onglet. */
export interface AgentWindow {
  /** Jusqu'à quand ce qui arrive dans la page vient de l'agent. */
  agentUntil: number
  /** Actions de l'agent en cours dans l'onglet (une navigation peut durer plus que le délai). */
  agentBusy: number
  /** Navigations arrêtées pendant ses actions, à lui dire. */
  blockedNavigations: string[]
}

/** Une action de l'agent est en cours, ou vient de finir. */
export function agentActive(tab: AgentWindow, now = Date.now()): boolean {
  return tab.agentBusy > 0 || now < tab.agentUntil
}

/**
 * Adresse que l'agent ne doit pas atteindre maintenant : action de l'agent en cours et site non
 * accordé. Notée pour l'agent quand c'est le cas.
 */
export function stopsAgentNavigation(
  tab: AgentWindow,
  url: string,
  allowed: (url: string) => boolean,
  now = Date.now()
): boolean {
  if (!agentActive(tab, now) || allowed(url)) return false
  if (!tab.blockedNavigations.includes(url)) tab.blockedNavigations.push(url)
  return true
}

interface NavigationEvent {
  url: string
  isMainFrame: boolean
  preventDefault: () => void
}

/** Ce qu'il faut d'un `WebContents` : ses deux évènements de navigation. */
export interface NavigationSource {
  on(
    event: 'will-navigate' | 'will-redirect',
    listener: (details: NavigationEvent) => void
  ): unknown
}

/**
 * Branche la garde sur une page : schémas autres que http(s) toujours refusés (comme avant),
 * site non accordé refusé pendant une action de l'agent (navigation de la page ou redirection du
 * serveur, cadre principal).
 */
export function guardNavigations(
  contents: NavigationSource,
  tab: AgentWindow,
  allowed: (url: string) => boolean
): void {
  contents.on('will-navigate', (details) => {
    if (!/^https?:/i.test(details.url) || stopsAgentNavigation(tab, details.url, allowed)) {
      details.preventDefault()
    }
  })
  contents.on('will-redirect', (details) => {
    if (details.isMainFrame && stopsAgentNavigation(tab, details.url, allowed)) {
      details.preventDefault()
    }
  })
}

/** Ce que l'agent apprend d'une navigation arrêtée. */
export function blockedNavigationNote(urls: string[]): string {
  return `Note: during your action the page tried to go to ${urls.join(', ')}, and Bobine stopped it: the user has not approved that site for this conversation. To open it, call browser_navigate with that URL (the user will be asked).`
}
