/**
 * Lecture de la sortie d'une commande de connexion d'agent (fiche 293, ADR-0077), sans rien savoir
 * de l'agent : lignes débarrassées des codes de terminal, adresse de la page vérifiée, adresses
 * effacées de tout ce qui part au journal. Pur, sans `electron`.
 *
 * Mémoire bornée : on ne garde que la ligne en cours, au plus `MAX_LINE_CHARS` caractères ; une
 * ligne plus longue est jetée entière jusqu'au retour à la ligne suivant (jamais lue en partie).
 */
import { StringDecoder } from 'node:string_decoder'

/** Au-delà, une ligne est jetée (l'adresse attendue en fait au plus `MAX_URL_CHARS`). */
export const MAX_LINE_CHARS = 8192
/** Longueur maximale d'une adresse de page ouverte. */
export const MAX_URL_CHARS = 4096

/**
 * Retour en début de ligne : `\r` seul (pas celui d'un `\r\n`), ou déplacement du curseur vers la
 * gauche / à une colonne (`ESC [ n D`, `ESC [ n G`, le tourniquet d'OpenCode : `ESC[999D ESC[J`).
 * Ce qui précède est effacé, comme à l'écran : rien n'est recollé.
 */
const LINE_RESET = /\r(?!$)|\u001b\[[0-9;]*[DG]/g
/** Autres séquences : CSI (couleurs, effacements, curseur caché), OSC (titres, liens), ESC seul. */
const ESCAPES =
  /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)?|\u001b[@-_]?/g
/**
 * Caractères de contrôle restants (hors tabulation) : remplacés par U+FFFD, jamais retirés, pour
 * qu'une adresse qui en contenait soit refusée par la vérification au lieu d'être recollée.
 */
const CONTROLS = /[\u0000-\u0008\u000a-\u001f\u007f-\u009f]/g

/** Ce qu'afficherait un terminal pour cette ligne (sans son `\n`). */
export function renderLine(raw: string): string {
  const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw
  let start = 0
  for (const match of line.matchAll(LINE_RESET)) start = match.index + match[0].length
  return line.slice(start).replace(ESCAPES, '').replace(CONTROLS, '�')
}

/**
 * Découpe un flux d'octets en lignes rendues : UTF-8 décodé même coupé entre deux morceaux, lignes
 * recollées entre deux morceaux, tourniquet compacté au fil de l'eau, longueur bornée.
 */
export class TerminalLines {
  private readonly decoder = new StringDecoder('utf8')
  private pending = ''
  private overflow = false
  /** Lignes jetées car trop longues (journal). */
  dropped = 0

  /** `complete` faux : dernière ligne d'un flux fermé, sans retour à la ligne (peut-être coupée). */
  private readonly onLine: (line: string, complete: boolean) => void

  constructor(onLine: (line: string, complete: boolean) => void) {
    this.onLine = onLine
  }

  push(chunk: Buffer | string): void {
    this.feed(typeof chunk === 'string' ? chunk : this.decoder.write(chunk))
  }

  /** Fin du flux : la dernière ligne, même sans `\n`, marquée incomplète. */
  end(): void {
    this.feed(this.decoder.end())
    if (!this.overflow && this.pending) this.onLine(renderLine(this.pending), false)
    this.pending = ''
    this.overflow = false
  }

  private feed(text: string): void {
    let from = 0
    for (;;) {
      const newline = text.indexOf('\n', from)
      const piece = newline < 0 ? text.slice(from) : text.slice(from, newline)
      if (!this.overflow) this.append(piece)
      if (newline < 0) return
      if (!this.overflow) this.onLine(renderLine(this.pending), true)
      this.pending = ''
      this.overflow = false
      from = newline + 1
    }
  }

  private append(piece: string): void {
    this.pending += piece
    // Tourniquet : seul ce qui suit le dernier retour en début de ligne compte encore.
    let start = 0
    for (const match of this.pending.matchAll(LINE_RESET)) start = match.index + match[0].length
    if (start > 0) this.pending = this.pending.slice(start)
    if (this.pending.length > MAX_LINE_CHARS) {
      this.pending = ''
      this.overflow = true
      this.dropped++
    }
  }
}

export type PageCheck = { ok: true; url: string; host: string } | { ok: false; host?: string }

/** Page attendue d'un préréglage : hôte et chemin exacts. */
export interface ExpectedPage {
  host: string
  path: string
}

const ASCII = /^[\x21-\x7e]+$/

/** Hôte lisible d'une adresse (ASCII, punycode pour un nom international), ou `undefined`. */
function hostOf(raw: string): string | undefined {
  if (raw.length > MAX_URL_CHARS) return undefined
  try {
    const host = new URL(raw).hostname
    return host && host.length <= 253 && ASCII.test(host) ? host : undefined
  } catch {
    return undefined
  }
}

/**
 * Hôte et chemin tels qu'ils sont écrits dans l'adresse, avant toute normalisation par `URL`
 * (encodage `%2E`, `..`, `\`) : on n'accepte que ce qui est déjà écrit sous sa forme attendue.
 */
function written(raw: string): { host: string; path: string } | undefined {
  const match = /^https:\/\/([^/?#\\]*)([^?#]*)/i.exec(raw)
  return match ? { host: (match[1] ?? '').toLowerCase(), path: match[2] ?? '' } : undefined
}

/**
 * Retour de la connexion (`redirect_uri`) : absent, accepté ; sinon une seule fois, et vers l'agent
 * sur cette machine (`http`, `127.0.0.1` ou `localhost`, port explicite, sans identifiants). Deux
 * valeurs : refusé (le serveur pourrait prendre l'une ou l'autre). Décodé une fois seulement, comme
 * le lira le serveur : une valeur encodée deux fois ne se lit pas, refusée.
 */
function loopbackRedirect(url: URL): boolean {
  const values = url.searchParams.getAll('redirect_uri')
  if (values.length === 0) return true
  if (values.length > 1) return false
  try {
    const back = new URL(values[0] ?? '')
    return (
      back.protocol === 'http:' &&
      (back.hostname === '127.0.0.1' || back.hostname === 'localhost') &&
      back.port !== '' &&
      !back.username &&
      !back.password
    )
  } catch {
    return false
  }
}

/**
 * Adresse de page acceptée seulement si : ASCII imprimable, au plus `MAX_URL_CHARS`, lue en entier
 * par `new URL`, `https:`, hôte **exactement** celui attendu (ni sous-domaine, ni suffixe, ni point
 * final), sans port explicite autre que celui par défaut, sans identifiants, hôte et chemin **écrits**
 * exactement comme attendu (ni `..`, ni encodage, ni `\`), retour de connexion vers cette machine
 * s'il y en a un (`loopbackRedirect`). Rend l'adresse telle que `URL` l'écrit (c'est elle, vérifiée,
 * qui sera ouverte) ; sinon l'hôte seul, s'il se lit.
 */
export function checkPageUrl(raw: string, page: ExpectedPage): PageCheck {
  if (raw.length > MAX_URL_CHARS || !ASCII.test(raw)) {
    return { ok: false, ...hostField(hostOf(raw)) }
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false }
  }
  const host = page.host.toLowerCase()
  const exact =
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.port &&
    url.hostname === host &&
    [host, `${host}:443`].includes(written(raw)?.host ?? '') &&
    written(raw)?.path === page.path &&
    url.pathname === page.path &&
    loopbackRedirect(url)
  return exact
    ? { ok: true, url: url.href, host: url.hostname }
    : { ok: false, ...hostField(hostOf(raw)) }
}

const hostField = (host: string | undefined) => (host ? { host } : {})

/**
 * Mot d'un message qui pourrait porter une adresse ou ses paramètres : schéma (même mal écrit :
 * `https:/`, `https:\\`), paramètre (`=`, `?`), ou nom de domaine suivi d'un chemin.
 */
const SUSPECT = /:[\\/]|[=?]|[a-z0-9-]\.[a-z]{2,}[\\/#]/i

/**
 * Messages d'erreur du système (lancement, ouverture de la page) avant le journal : tout mot
 * suspect remplacé par l'hôte qu'il nomme, s'il se lit, sinon par « <masqué> ». La sortie de la
 * commande, elle, n'est jamais journalisée (ADR-0077).
 */
export function scrubUrls(text: string): string {
  return text.replace(/\S+/g, (word) => {
    if (!SUSPECT.test(word)) return word
    const host = hostOf(word)
    return host ? `<adresse ${host}>` : '<masqué>'
  })
}
