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
  /**
   * Taille d'écran **posée** sur la page de l'onglet actif, et sa réduction pour tenir dans la zone :
   * celle de l'essai de l'agent (`browser_resize`, jusqu'à la fin de son tour) ou du réglage de
   * l'utilisateur (fiche 295) ; absente : la page suit la largeur du panneau.
   */
  emulation?: BrowserEmulation
  /** Thème posé sur la page de l'onglet actif (fiche 295) ; absent : Auto, celui du système. */
  colorScheme?: BrowserColorScheme
  /** Réglage de l'utilisateur pour la conversation (fiche 295) ; absent : barre fermée. */
  device?: BrowserDeviceRequest
  /** Essai de l'agent sur l'onglet actif, jusqu'à la fin de son tour (fiche 295) ; absent : aucun. */
  agent?: BrowserAgentTrial
  /**
   * Qui a la main sur l'onglet actif (fiche 295, ADR-0078) : l'agent pendant son essai, sinon
   * l'utilisateur s'il a un réglage ; absent : ni l'un ni l'autre (largeur du panneau, thème Auto).
   */
  control?: 'user' | 'agent'
  /**
   * Certificat refusé pour la page de l'onglet actif (fiche 269, ADR-0064) : l'onglet montre
   * l'avertissement à la place de la page.
   */
  certificate?: BrowserCertificateProblem
  /**
   * La page est affichée sous une exception de certificat accordée par l'utilisateur (fiche 269) :
   * laquelle (« Non sécurisé », et « Ne plus accepter » de sa puce).
   */
  insecure?: CertificateException
}

/**
 * Certificat refusé par Chromium pour la page d'un onglet (fiche 269, ADR-0064), tel que
 * l'avertissement le montre. Tout vient du main ; le renderer ne renvoie que `token`.
 */
export interface BrowserCertificateProblem {
  /** Jeton aléatoire de cet avertissement : « Continuer » le cite, rien d'autre. */
  token: string
  url: string
  host: string
  port: number
  /** Code de Chromium (`net::ERR_CERT_AUTHORITY_INVALID`…). */
  error: string
  /** Nom commun du sujet et de l'émetteur, tels que le certificat les donne. */
  subject: string
  issuer: string
  /** Empreinte SHA-256 du certificat (`AB:CD:…`, 32 octets) ; vide si illisible. */
  fingerprint: string
  /**
   * Continuer est permis : adresse locale ou privée (et, pour un nom, l'IP contactée aussi), erreur
   * d'un certificat de serveur de développement, empreinte lisible.
   */
  bypassable: boolean
  /** L'adresse d'un nom (`*.test`, `*.local`) est en cours de vérification. */
  checking?: boolean
  /** Pourquoi continuer n'est pas permis (absent : permis, ou vérification en cours). */
  refusal?: CertificateRefusal
  /** « Se souvenir » possible (pas en profil en lecture seule). */
  rememberable: boolean
}

/**
 * Refus de continuer (fiche 269) : site public, erreur qu'un serveur de développement n'explique
 * pas (révoqué, clé faible…), nom qui mène à une IP publique, certificat illisible.
 */
export type CertificateRefusal = 'public' | 'error' | 'address' | 'unreadable'

/** Exception de certificat (fiche 269) : hôte, port, empreinte SHA-256 exacte et code refusé. */
export interface CertificateException {
  host: string
  port: number
  fingerprint: string
  /** Code de Chromium accepté (`net::ERR_CERT_AUTHORITY_INVALID`…) : un autre redemande. */
  error: string
}

/**
 * Taille d'écran posée sur la page (fiche 129 ; agent ou utilisateur, fiche 295) : pixels CSS de la
 * page, et réduction appliquée pour qu'elle tienne entière dans la zone (`scale` ≤ 1).
 */
export interface BrowserEmulation {
  width: number
  height: number
  mobile: boolean
  scale: number
}

/** Thème forcé pour la page (`prefers-color-scheme`). */
export type BrowserColorScheme = 'light' | 'dark'

/** Écran imité : pixels CSS de la page ; `mobile` : mode mobile de Chromium et tactile. */
export interface EmulatedScreen {
  width: number
  height: number
  mobile: boolean
}

/**
 * Réglage de l'utilisateur (fiche 295, ADR-0078), seul objet que l'interface envoie
 * (`browser:setDevice`) : « Adaptatif » (largeur du panneau), un appareil de la liste
 * (`shared/browser-devices.ts`, par identifiant), ou une taille libre ; et le thème (`null` : Auto).
 * Le main revérifie tout.
 */
export type BrowserDeviceRequest =
  | { kind: 'responsive'; colorScheme: BrowserColorScheme | null }
  | { kind: 'preset'; id: string; landscape: boolean; colorScheme: BrowserColorScheme | null }
  | {
      kind: 'custom'
      width: number
      height: number
      mobile: boolean
      colorScheme: BrowserColorScheme | null
    }

/**
 * Essai de l'agent sur un onglet (`browser_resize`), champ par champ : absent, le réglage de
 * l'utilisateur s'applique ; `panel` / `auto` (préréglage `desktop`, thème `auto`) : la largeur du
 * panneau, le thème du système, devant le réglage de l'utilisateur.
 */
export interface BrowserAgentTrial {
  screen?: EmulatedScreen | 'panel'
  colorScheme?: BrowserColorScheme | 'auto'
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

/**
 * Site à faire approuver pour la page affichée (fiche 249) : comme `siteToApprove`, mais
 * `undefined` pour ce qui n'est pas une page web (`about:blank`, page d'erreur, adresse vide).
 */
export function pageSiteToApprove(url: string): string | undefined {
  if (!/^https?:\/\//i.test(url)) return undefined
  try {
    return siteToApprove(url)
  } catch {
    return undefined
  }
}
