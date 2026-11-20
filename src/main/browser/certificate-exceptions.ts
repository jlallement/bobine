/**
 * Exceptions de certificat du navigateur intégré (fiche 269, ADR-0064) : ce qui se décide sans
 * Electron, donc testable. Une exception vaut pour un hôte, un port, une empreinte SHA-256 exacte
 * et un code d'erreur ; elle ne se propose que pour une adresse locale ou privée (serveur de
 * développement), et seulement pour une erreur qu'un serveur de développement explique.
 */
import { X509Certificate } from 'node:crypto'
import { isIP } from 'node:net'
import type {
  BrowserCertificateProblem,
  CertificateException,
  CertificateRefusal
} from '@shared/browser'
import { isLocalHost } from '@shared/browser'

/** Empreinte SHA-256 au format de `X509Certificate.fingerprint256` (32 octets `AB:` en majuscules). */
export const FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/

/**
 * Erreurs qu'un certificat de serveur de développement explique (auto-signé, nom, dates) : les
 * seules qui permettent de continuer. Révoqué, clé faible, algorithme refusé… : jamais.
 */
export const BYPASSABLE_ERRORS: readonly string[] = [
  'net::ERR_CERT_AUTHORITY_INVALID',
  'net::ERR_CERT_COMMON_NAME_INVALID',
  'net::ERR_CERT_DATE_INVALID'
]

/** Longueur d'une adresse citée à l'agent. */
const AGENT_URL_MAX = 120

/** Hôte et port d'une adresse chiffrée (`https:`, `wss:`), port par défaut 443 ; sinon rien. */
export function certificateSite(url: string): { host: string; port: number } | undefined {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return undefined
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'wss:') return undefined
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) return undefined
  return { host, port: parsed.port ? Number(parsed.port) : 443 }
}

/**
 * Adresse IP locale ou privée : IPv4 `127/8`, `10/8`, `172.16/12`, `192.168/16` ; IPv6 `::1`,
 * `fc00::/7` (locales uniques), `fe80::/10` (lien local, souvent celle d'un `.local`), et une IPv4
 * privée écrite en IPv6 (`::ffff:192.168.1.2`).
 */
export function isPrivateAddress(address: string): boolean {
  const ip = address
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/%.*$/, '')
  if (isIP(ip) === 4) {
    const [a = -1, b = -1] = ip.split('.').map(Number)
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  }
  if (isIP(ip) !== 6) return false
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip)
  if (mapped?.[1]) return isPrivateAddress(mapped[1])
  if (ip === '::1') return true
  const first = parseInt(ip.split(':')[0] || '0', 16)
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80
}

/**
 * Adresse locale ou privée, seule à pouvoir recevoir une exception : `localhost`, `*.localhost`,
 * `*.test` (`isLocalHost`), `*.local`, et toute IP de `isPrivateAddress`. Un nom en `.test` ou
 * `.local` peut pointer n'importe où : l'IP contactée est vérifiée en plus (`needsAddressCheck`).
 */
export function isPrivateDevHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!host || host.endsWith('.')) return false
  if (isIP(host)) return isPrivateAddress(host)
  if (isLocalHost(host)) return true
  return host.endsWith('.local') && host.length > '.local'.length
}

/**
 * L'hôte est un nom que le DNS (ou mDNS) résout : `*.test`, `*.local`. `localhost` et
 * `*.localhost` vont toujours à la boucle locale dans Chromium, une IP n'a rien à résoudre.
 */
export function needsAddressCheck(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return !isIP(host) && host !== 'localhost' && !host.endsWith('.localhost')
}

/** Toutes les adresses résolues sont locales ou privées (aucune : non). */
export function privateAddresses(addresses: readonly string[]): boolean {
  return addresses.length > 0 && addresses.every(isPrivateAddress)
}

/** Empreinte SHA-256 d'un certificat (PEM, ou DER brut), `undefined` s'il est illisible. */
export function fingerprintOf(certificate: string | Buffer): string | undefined {
  try {
    const fingerprint = new X509Certificate(certificate).fingerprint256.toUpperCase()
    return FINGERPRINT.test(fingerprint) ? fingerprint : undefined
  } catch {
    return undefined
  }
}

export function sameException(a: CertificateException, b: CertificateException): boolean {
  return (
    a.host === b.host && a.port === b.port && a.fingerprint === b.fingerprint && a.error === b.error
  )
}

/** Exception valide (fichier relu, IPC) : hôte local ou privé, port, empreinte, erreur permise. */
export function parseException(value: unknown): CertificateException | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { host, port, fingerprint, error } = value as Record<string, unknown>
  if (typeof host !== 'string' || host.length > 255 || !isPrivateDevHost(host)) return undefined
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    return undefined
  }
  if (typeof fingerprint !== 'string' || !FINGERPRINT.test(fingerprint)) return undefined
  if (typeof error !== 'string' || !BYPASSABLE_ERRORS.includes(error)) return undefined
  return { host: host.toLowerCase(), port, fingerprint, error }
}

/** Exceptions accordées par l'utilisateur : pour la session, ou retenues (`approvals.ts`). */
export interface CertificateMemory {
  has: (exception: CertificateException) => boolean
  /** Exceptions de cet hôte et ce port, quelle que soit l'empreinte, la plus récente en dernier. */
  forSite: (host: string, port: number) => CertificateException[]
  add: (exception: CertificateException, remember: boolean) => void
  /** « Se souvenir » possible (faux pour un profil en lecture seule, fiche 196). */
  canRemember?: () => boolean
  /**
   * Certificat que le serveur présente maintenant (refusé ou accepté) : une exception d'une autre
   * empreinte pour cet hôte et ce port devient « ancienne » dans les Réglages.
   */
  seen?: (presented: { host: string; port: number; fingerprint: string }) => void
}

/** Certificat tel que Chromium le donne (`Electron.Certificate`, en partie). */
export interface SeenCertificate {
  data: string
  subjectName?: string
  issuerName?: string
}

/** Ce que Chromium refuse : hôte, port, empreinte et code ; `undefined` hors `https:`, illisible. */
export function certificateIdentity(
  url: string,
  error: string,
  certificate: SeenCertificate
): CertificateException | undefined {
  const site = certificateSite(url)
  const fingerprint = fingerprintOf(certificate.data)
  return site && fingerprint ? { ...site, fingerprint, error } : undefined
}

/**
 * Décision pour un certificat refusé par Chromium dans un onglet du panneau : `true` seulement si
 * l'utilisateur a accordé exactement cet hôte, ce port, cette empreinte et ce code.
 */
export function certificateAccepted(
  memory: CertificateMemory | undefined,
  url: string,
  error: string,
  certificate: SeenCertificate
): boolean {
  const presented = certificateIdentity(url, error, certificate)
  return !!memory && !!presented && memory.has(presented)
}

/**
 * Continuer est-il permis ? Empreinte lisible, erreur de `BYPASSABLE_ERRORS`, hôte local ou
 * privé ; pour un nom résolu (`needsAddressCheck`), les adresses que Chromium contacte doivent
 * l'être aussi (`addresses` absentes : pas encore vérifié, donc non).
 */
export function canBypass(
  problem: Pick<BrowserCertificateProblem, 'host' | 'fingerprint' | 'error'>,
  addresses?: readonly string[]
): boolean {
  return !refusalOf(problem, addresses)
}

/** Pourquoi continuer n'est pas permis (dit dans l'avertissement) ; `undefined` : permis. */
export function refusalOf(
  problem: Pick<BrowserCertificateProblem, 'host' | 'fingerprint' | 'error'>,
  addresses?: readonly string[]
): CertificateRefusal | undefined {
  if (!FINGERPRINT.test(problem.fingerprint)) return 'unreadable'
  if (!isPrivateDevHost(problem.host)) return 'public'
  if (!BYPASSABLE_ERRORS.includes(problem.error)) return 'error'
  if (needsAddressCheck(problem.host) && !(addresses && privateAddresses(addresses))) {
    return 'address'
  }
  return undefined
}

/**
 * Avertissement d'un cadre principal refusé ; `undefined` hors `https:`. `bypassable` reste faux
 * tant que l'adresse d'un nom résolu n'est pas vérifiée (`checking`).
 */
export function certificateProblem(
  url: string,
  error: string,
  certificate: SeenCertificate,
  token: string,
  rememberable = true
): BrowserCertificateProblem | undefined {
  const site = certificateSite(url)
  if (!site) return undefined
  const fingerprint = fingerprintOf(certificate.data) ?? ''
  const problem: BrowserCertificateProblem = {
    token,
    url,
    ...site,
    error,
    subject: (certificate.subjectName ?? '').slice(0, 200),
    issuer: (certificate.issuerName ?? '').slice(0, 200),
    fingerprint,
    bypassable: false,
    rememberable
  }
  // Tout le reste permis, et un nom à résoudre : la vérification de l'adresse décidera
  // (`BrowserManager`, `session.resolveHost`).
  const refusal = refusalOf(problem, ['127.0.0.1'])
  if (!refusal && needsAddressCheck(site.host)) return { ...problem, checking: true }
  return refusal ? { ...problem, refusal } : { ...problem, bypassable: true }
}

/**
 * Exception sous laquelle l'onglet affiche sa page (« Non sécurisé ») : parmi celles que Chromium
 * a vraiment utilisées dans ce document (`used`, toute ressource), et encore accordées, celle du
 * site de la page d'abord ; `undefined` sinon.
 */
export function insecureException(
  memory: CertificateMemory | undefined,
  url: string,
  used: readonly CertificateException[]
): CertificateException | undefined {
  if (!memory) return undefined
  const valid = used.filter((e) => memory.has(e))
  const site = certificateSite(url)
  return valid.find((e) => e.host === site?.host && e.port === site?.port) ?? valid[0]
}

/**
 * Ce que l'agent apprend d'une page sous un avertissement de certificat : il ne peut rien y faire,
 * seul l'utilisateur décide dans le panneau. L'adresse est tronquée.
 */
export function certificateAgentNote(problem: BrowserCertificateProblem): string {
  const url =
    problem.url.length > AGENT_URL_MAX ? `${problem.url.slice(0, AGENT_URL_MAX)}…` : problem.url
  const decision = problem.bypassable
    ? 'You cannot accept a certificate. The user can choose to continue in the panel; do not insist.'
    : 'Bobine does not allow continuing to this site. Do not try to work around it.'
  return `The page ${url} was not opened: its TLS certificate was refused (${problem.error}). Bobine shows the user a security warning in the Browser panel instead of the page. ${decision}`
}

/**
 * Commande CDP permise à `CdpTab` : aucune du domaine `Security` (certificats), ni de quoi parler
 * à une autre cible (`Target.attachToTarget`, `Target.sendMessageToTarget`) qui le permettrait.
 */
export function cdpMethodAllowed(method: string): boolean {
  const name = method.trim().toLowerCase()
  return (
    !name.startsWith('security.') &&
    name !== 'target.attachtotarget' &&
    name !== 'target.sendmessagetotarget'
  )
}
