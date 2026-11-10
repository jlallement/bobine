import { t } from 'i18next' /**
 * Navigateur intégré (fiche 007) : état d'une page tel que l'UI l'affiche, et règles sur les
 * adresses (partagées par le main et le renderer).
 */

/** Onglet du navigateur d'une conversation (fiche 031). */
export interface BrowserTabInfo {
  id: string
  title: string
  url: string
}

/** Page du navigateur d'une conversation (celle de l'onglet actif). */
export interface BrowserState {
  conversationId: string
  tabs: BrowserTabInfo[]
  activeTab: string
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  /** Zoom de la page de l'onglet actif (1 = 100 %), propre à l'onglet (fiche 129). */
  zoom: number
  /** Taille d'écran imposée par l'agent (`browser_resize`), jusqu'à la fin de son tour. */
  emulation?: BrowserEmulation
}

/**
 * Taille d'écran imposée par l'agent (fiche 129) : pixels CSS de la page, et réduction appliquée
 * pour qu'elle tienne entière dans la zone (`scale` ≤ 1).
 */
export interface BrowserEmulation {
  width: number
  height: number
  mobile: boolean
  scale: number
}

/** Demande de la page à l'onglet du panneau (fiche 129) : ⌘L tapé dans la page. */
export interface BrowserCommand {
  conversationId: string
  /** `annotate-escape` : Échap tapé dans la page en mode Annoter (fiche 146). */
  command: 'focus-address' | 'annotate-escape'
}

/** Zoom de la page : un palier de plus, de moins, ou 100 %. */
export type BrowserZoom = 'in' | 'out' | 'reset'

/** Emplacement de la page dans la fenêtre (pixels CSS), fourni par l'onglet du panneau. */
export interface BrowserBounds {
  x: number
  y: number
  width: number
  height: number
}

export type BrowserGo = 'back' | 'forward' | 'reload' | 'stop'

/**
 * Téléchargement de la page terminé (fiche 094, ADR-0018), pour le bandeau de l'onglet : enregistré
 * là où l'utilisateur l'a choisi, ou en échec. Annulé : rien à dire.
 */
export interface BrowserDownload {
  conversationId: string
  /** Nom du fichier. */
  name: string
  state: 'completed' | 'interrupted'
  /** Chemin choisi par l'utilisateur (enregistré). */
  path?: string
}

/** Hôtes du poste : toujours autorisés (l'app que l'agent développe). */
export function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.test')
  )
}

/**
 * Adresse saisie (par l'utilisateur ou l'agent) → URL http(s). `localhost:3000` devient
 * `http://localhost:3000`, `exemple.com` devient `https://exemple.com`. Tout autre schéma (`file:`,
 * `javascript:`…) est refusé.
 */
export function normalizeUrl(input: string): string {
  const raw = input.trim()
  if (!raw) throw new Error(t('browser.url.empty'))
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `${isLocalHost(raw.split(/[/:?#]/)[0] ?? '') || /^\d+\.\d+\.\d+\.\d+/.test(raw) ? 'http' : 'https'}://${raw}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    throw new Error(t('browser.url.invalid', { input }))
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(t('browser.url.protocol', { protocol: url.protocol }))
  }
  return url.toString()
}

/** Site à faire approuver avant que l'agent l'ouvre (`hôte:port`), ou `undefined` si local. */
export function siteToApprove(url: string): string | undefined {
  const { hostname, host } = new URL(url)
  return isLocalHost(hostname) ? undefined : host
}
