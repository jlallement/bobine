/**
 * Exceptions de certificat du navigateur intégré (fiche 269, ADR-0064) : ce qui se décide sans
 * Electron, donc testable. Une exception vaut pour un hôte, un port et une empreinte SHA-256
 * exacte ; elle ne se propose que pour une adresse locale ou privée (serveur de développement).
 */
import { X509Certificate } from 'node:crypto'
import { isIP } from 'node:net'
import type { BrowserCertificateProblem, CertificateException } from '@shared/browser'
import { isLocalHost } from '@shared/browser'

/** Empreinte SHA-256 au format de `X509Certificate.fingerprint256` (32 octets `AB:` en majuscules). */
export const FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/

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

/** IPv4 en notation pointée, ses quatre octets ; sinon `undefined`. */
function ipv4(host: string): number[] | undefined {
  if (isIP(host) !== 4) return undefined
  return host.split('.').map(Number)
}

/**
 * Adresse locale ou privée, seule à pouvoir recevoir une exception : `localhost`, `*.localhost`,
 * `::1`, `*.test` (`isLocalHost`), `127.0.0.0/8`, `*.local`, et les IPv4 de la RFC 1918.
 */
export function isPrivateDevHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!host || host.endsWith('.')) return false
  if (isLocalHost(host)) return true
  const v4 = ipv4(host)
  if (v4) {
    const [a = -1, b = -1] = v4
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  }
  // Nom (pas une IPv6 autre que `::1`, déjà vue) en `.local` (mDNS) : jamais `local` seul.
  return isIP(host) === 0 && host.endsWith('.local') && host.length > '.local'.length
}

/** Empreinte SHA-256 d'un certificat PEM, `undefined` s'il est illisible. */
export function fingerprintOf(pem: string): string | undefined {
  try {
    const fingerprint = new X509Certificate(pem).fingerprint256.toUpperCase()
    return FINGERPRINT.test(fingerprint) ? fingerprint : undefined
  } catch {
    return undefined
  }
}

export function sameException(a: CertificateException, b: CertificateException): boolean {
  return a.host === b.host && a.port === b.port && a.fingerprint === b.fingerprint
}

/** Exception valide (fichier relu, IPC) : hôte local ou privé, port, empreinte au bon format. */
export function parseException(value: unknown): CertificateException | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { host, port, fingerprint } = value as Record<string, unknown>
  if (typeof host !== 'string' || host.length > 255 || !isPrivateDevHost(host)) return undefined
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    return undefined
  }
  if (typeof fingerprint !== 'string' || !FINGERPRINT.test(fingerprint)) return undefined
  return { host: host.toLowerCase(), port, fingerprint }
}

/** Exceptions accordées par l'utilisateur : pour la session, ou retenues (`approvals.ts`). */
export interface CertificateMemory {
  has: (exception: CertificateException) => boolean
  /** Une exception, quelle que soit l'empreinte, pour cet hôte et ce port. */
  hasSite: (host: string, port: number) => boolean
  add: (exception: CertificateException, remember: boolean) => void
}

/** Certificat tel que Chromium le donne (`Electron.Certificate`, en partie). */
export interface SeenCertificate {
  data: string
  subjectName?: string
  issuerName?: string
}

/**
 * Décision pour un certificat refusé par Chromium dans une page du panneau : `true` seulement si
 * l'utilisateur a accordé exactement cet hôte, ce port et cette empreinte.
 */
export function certificateAccepted(
  memory: CertificateMemory | undefined,
  url: string,
  certificate: SeenCertificate
): boolean {
  const site = certificateSite(url)
  const fingerprint = fingerprintOf(certificate.data)
  if (!memory || !site || !fingerprint) return false
  return memory.has({ ...site, fingerprint })
}

/** Avertissement d'un cadre principal refusé ; `undefined` hors `https:`. */
export function certificateProblem(
  url: string,
  error: string,
  certificate: SeenCertificate,
  token: string
): BrowserCertificateProblem | undefined {
  const site = certificateSite(url)
  if (!site) return undefined
  const fingerprint = fingerprintOf(certificate.data) ?? ''
  return {
    token,
    url,
    ...site,
    error,
    subject: (certificate.subjectName ?? '').slice(0, 200),
    issuer: (certificate.issuerName ?? '').slice(0, 200),
    fingerprint,
    bypassable: !!fingerprint && isPrivateDevHost(site.host)
  }
}

/**
 * Ce que l'agent apprend d'une page sous un avertissement de certificat : il ne peut rien y faire,
 * seul l'utilisateur décide dans le panneau.
 */
export function certificateAgentNote(problem: BrowserCertificateProblem): string {
  const decision = problem.bypassable
    ? 'Only the user can decide to continue, from that warning; you cannot accept a certificate. Tell the user, and try again once they have continued.'
    : 'Bobine does not allow continuing to a public site with a refused certificate. Do not try to work around it; tell the user.'
  return `The page ${problem.url} was not opened: its TLS certificate was refused (${problem.error}). Bobine shows the user a security warning in the Browser panel instead of the page. ${decision}`
}

/** Commande CDP permise à `CdpTab` : aucune du domaine `Security` (certificats). */
export function cdpMethodAllowed(method: string): boolean {
  return !/^security\./i.test(method.trim())
}
