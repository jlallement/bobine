/**
 * Certificats refusés dans le navigateur intégré (fiche 269, ADR-0064) : le lien entre Chromium
 * (`app.on('certificate-error')`, CDP, résolution DNS de la session) et les décisions pures de
 * `certificate-exceptions.ts`. Sorti de `browser-manager.ts` (taille bornée, fiche 089).
 *
 * - Seules les pages de la session du panneau sont traitées ; toute autre page garde le refus
 *   d'Electron.
 * - Onglet : accepté sous une exception exacte de l'utilisateur ; sinon refusé, et le cadre
 *   principal montre l'avertissement (dans l'interface, pas dans la page).
 * - Popup de l'utilisateur : jamais d'exception ; un refus, ou une page d'un site sous exception,
 *   y affiche un message clair à la place.
 */
import { randomUUID } from 'node:crypto'
import {
  shell,
  type BrowserWindow,
  type Certificate,
  type Session,
  type WebContents
} from 'electron'
import { t } from 'i18next'
import type { BrowserCertificateProblem, CertificateException } from '@shared/browser'
import type { CdpTab } from './cdp-tab'
import {
  canBypass,
  certificateIdentity,
  certificateProblem,
  certificateSite,
  fingerprintOf,
  insecureException,
  needsAddressCheck,
  refusalOf,
  sameException,
  type CertificateMemory
} from './certificate-exceptions'

/** Ce que la garde lit et écrit sur un onglet. */
export interface CertificateTab {
  view: { webContents: WebContents }
  cdp: Pick<CdpTab, 'certificateOf'> & { onInsecureResponse: CdpTab['onInsecureResponse'] }
  /** Certificat refusé pour sa page : l'avertissement la remplace. */
  certificate?: BrowserCertificateProblem | undefined
  /** Exceptions que Chromium a vraiment utilisées dans ce document (toute ressource). */
  usedCertificates: CertificateException[]
}

export interface CertificateGuardDeps {
  memory: CertificateMemory | undefined
  session: () => Session | undefined
  /** Conversation et onglet d'une page (un onglet, ou une popup de l'utilisateur sans onglet). */
  ownerOf: (contents: WebContents) => { conversationId: string; tab?: CertificateTab } | undefined
  tabs: () => Iterable<[conversationId: string, tab: CertificateTab]>
  /** L'onglet a changé : placer la vue (masquée sous l'avertissement) et dire l'état. */
  changed: (conversationId: string) => void
}

/** Codes de Chromium d'un certificat refusé (`net::ERR_CERT_*`, -200 à -299). */
const isCertificateFailure = (code: number) => code <= -200 && code > -300

export class CertificateGuard {
  private readonly deps: CertificateGuardDeps

  constructor(deps: CertificateGuardDeps) {
    this.deps = deps
  }

  /** `app.on('certificate-error')`. */
  readonly onError = (
    event: Electron.Event,
    contents: WebContents,
    url: string,
    error: string,
    certificate: Certificate,
    callback: (trusted: boolean) => void,
    isMainFrame: boolean
  ): void => {
    const session = this.deps.session()
    if (!session || contents.session !== session) return
    const owner = this.deps.ownerOf(contents)
    if (!owner) return
    event.preventDefault()
    const memory = this.deps.memory
    const presented = certificateIdentity(url, error, certificate)
    if (presented) memory?.seen?.(presented)
    const tab = owner.tab
    // Popup : aucune exception, jamais (sa page de refus vient de `watchPopup`).
    if (tab && presented && memory?.has(presented)) {
      callback(true)
      this.use(owner.conversationId, tab, presented)
      return
    }
    callback(false)
    if (!isMainFrame || !tab) return
    const problem = certificateProblem(
      url,
      error,
      certificate,
      randomUUID(),
      memory?.canRemember?.() ?? false
    )
    if (!problem) return
    tab.certificate = problem
    this.deps.changed(owner.conversationId)
    if (problem.checking) void this.checkAddress(owner.conversationId, tab, problem)
  }

  /** Suit un onglet : nouvelle navigation, réponses acceptées sur une connexion réutilisée. */
  watch(conversationId: string, tab: CertificateTab): void {
    const contents = tab.view.webContents
    contents.on('did-start-navigation', (details) => {
      if (!details.isMainFrame || details.isSameDocument) return
      // Nouveau document : l'avertissement d'avant ne vaut plus, ni les exceptions utilisées.
      const had = !!tab.certificate || tab.usedCertificates.length > 0
      tab.certificate = undefined
      tab.usedCertificates = []
      if (had) this.deps.changed(conversationId)
    })
    tab.cdp.onInsecureResponse = (url) => void this.noteInsecure(conversationId, tab, url)
  }

  /**
   * Popup de l'utilisateur : aucune exception n'y vaut. Une page d'un site sous exception (la
   * connexion acceptée serait réutilisée sans vérification) ou un certificat refusé : un message
   * clair à la place, jamais une page blanche.
   */
  watchPopup(popup: BrowserWindow, firstUrl: string): void {
    const contents = popup.webContents
    const refuse = (url: string) => {
      const site = certificateSite(url)
      const name = site ? `${site.host}:${site.port}` : url
      void contents.loadURL(refusalPage(name)).catch(() => {})
    }
    const underException = (url: string) => {
      const site = certificateSite(url)
      return !!site && (this.deps.memory?.forSite(site.host, site.port).length ?? 0) > 0
    }
    for (const event of ['will-navigate', 'will-redirect'] as const) {
      contents.on(event as 'will-navigate', (details) => {
        if (!details.isMainFrame || !underException(details.url)) return
        details.preventDefault()
        refuse(details.url)
      })
    }
    contents.on('did-fail-load', (_event, code, _description, url, isMainFrame) => {
      if (isMainFrame && isCertificateFailure(code)) refuse(url)
    })
    // Première page de la popup (ouverte par `window.open`) : pas de `will-navigate`, remplacée
    // tout de suite par le message.
    if (underException(firstUrl)) refuse(firstUrl)
  }

  /**
   * « Continuer » (IPC de l'interface seulement) : le jeton désigne l'avertissement noté par le
   * main, qui en tire hôte, port, empreinte et code ; tout est revérifié, l'adresse d'un nom aussi.
   */
  async allow(
    conversationId: string,
    tab: CertificateTab | undefined,
    remember: boolean
  ): Promise<string> {
    const problem = tab?.certificate
    if (!tab || !problem) throw new Error('Certificate warning unknown or out of date')
    const memory = this.deps.memory
    const addresses = needsAddressCheck(problem.host)
      ? await this.addressesOf(problem.host)
      : undefined
    if (!memory || !problem.bypassable || !canBypass(problem, addresses)) {
      throw new Error(`No certificate exception allowed for ${problem.host}`)
    }
    // Le jeton a pu changer pendant la résolution (autre navigation) : on ne décide plus rien.
    if (tab.certificate !== problem) throw new Error('Certificate warning out of date')
    const { host, port, fingerprint, error } = problem
    memory.add({ host, port, fingerprint, error }, remember && (memory.canRemember?.() ?? false))
    tab.certificate = undefined
    this.deps.changed(conversationId)
    return problem.url
  }

  /** « Ouvrir dans le navigateur » : l'adresse notée pour ce jeton, dans celui du système. */
  async openSite(tab: CertificateTab | undefined): Promise<void> {
    const problem = tab?.certificate
    if (!problem) throw new Error('Certificate warning unknown or out of date')
    if (!/^https:\/\//i.test(problem.url)) throw new Error('Not a web address')
    await shell.openExternal(problem.url)
  }

  /**
   * Exception révoquée : les connexions se ferment (WebSocket comprises), le cache de cette origine
   * s'efface, et tout onglet qui l'a utilisée, ou qui est sur ce site, se recharge (il retombe
   * sur l'avertissement).
   */
  async revoked(exception: CertificateException): Promise<void> {
    const session = this.deps.session()
    const affected: [string, CertificateTab][] = []
    for (const [conversationId, tab] of this.deps.tabs()) {
      const site = certificateSite(tab.view.webContents.getURL())
      const used = tab.usedCertificates.some((e) => sameException(e, exception))
      if (used || (site?.host === exception.host && site.port === exception.port)) {
        tab.usedCertificates = tab.usedCertificates.filter((e) => !sameException(e, exception))
        affected.push([conversationId, tab])
      }
    }
    if (session) {
      await session.closeAllConnections()
      const origin = `https://${exception.host.includes(':') ? `[${exception.host}]` : exception.host}:${exception.port}`
      await session
        .clearData({ origins: [origin], dataTypes: ['cache'] })
        .catch(() => session.clearCache())
    }
    for (const [conversationId, tab] of affected) {
      if (!tab.view.webContents.isDestroyed()) tab.view.webContents.reload()
      this.deps.changed(conversationId)
    }
  }

  /** Exception sous laquelle l'onglet affiche sa page (« Non sécurisé »), pour l'état. */
  insecureOf(tab: CertificateTab): { insecure?: CertificateException } {
    if (tab.certificate) return {}
    const url = tab.view.webContents.getURL()
    const exception = insecureException(this.deps.memory, url, tab.usedCertificates)
    return exception ? { insecure: exception } : {}
  }

  private use(conversationId: string, tab: CertificateTab, exception: CertificateException): void {
    if (tab.usedCertificates.some((e) => sameException(e, exception))) return
    tab.usedCertificates = [...tab.usedCertificates, exception]
    this.deps.changed(conversationId)
  }

  /**
   * Réponse chargée malgré un certificat refusé, sans évènement (connexion réutilisée) : son
   * certificat est relu par le CDP, et l'exception qui l'a permise notée sur l'onglet.
   */
  private async noteInsecure(conversationId: string, tab: CertificateTab, url: string) {
    const site = certificateSite(url)
    const candidates = site ? (this.deps.memory?.forSite(site.host, site.port) ?? []) : []
    if (!site || !candidates.length) return
    if (tab.usedCertificates.some((e) => e.host === site.host && e.port === site.port)) return
    const host = site.host.includes(':') ? `[${site.host}]` : site.host
    const der = await tab.cdp.certificateOf(`https://${host}:${site.port}`).catch(() => undefined)
    const fingerprint = der ? fingerprintOf(der) : undefined
    const exception = candidates.find((e) => e.fingerprint === fingerprint)
    if (exception) this.use(conversationId, tab, exception)
  }

  /** Adresse d'un nom (`*.test`, `*.local`) vérifiée : « Continuer » seulement si privée. */
  private async checkAddress(
    conversationId: string,
    tab: CertificateTab,
    problem: BrowserCertificateProblem
  ): Promise<void> {
    const addresses = await this.addressesOf(problem.host)
    if (tab.certificate !== problem) return
    const { checking: _done, ...rest } = problem
    const refusal = refusalOf(problem, addresses)
    tab.certificate = refusal ? { ...rest, refusal } : { ...rest, bypassable: true }
    this.deps.changed(conversationId)
  }

  /** Adresses que la session du panneau contacte pour ce nom (son propre résolveur). */
  private async addressesOf(host: string): Promise<string[]> {
    const session = this.deps.session()
    if (!session) return []
    try {
      const resolved = await session.resolveHost(host)
      return resolved.endpoints.map((endpoint) => endpoint.address)
    } catch {
      return []
    }
  }
}

/** Page de la popup refusée : texte seul, sans script, hôte échappé. */
function refusalPage(site: string): string {
  const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
  const html =
    `<!doctype html><meta charset="utf-8"><title>${escape(t('browser.certificate.popupTitle'))}</title>` +
    `<body style="font:14px -apple-system,system-ui,sans-serif;margin:32px;line-height:1.5">` +
    `<h1 style="font-size:18px">${escape(t('browser.certificate.popupTitle'))}</h1>` +
    `<p>${escape(t('browser.certificate.popupRefused', { site }))}</p></body>`
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}
