/**
 * Lecture de la sortie d'une commande de connexion d'agent (fiche 293, ADR-0075), sans rien savoir
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

  private readonly onLine: (line: string) => void

  constructor(onLine: (line: string) => void) {
    this.onLine = onLine
  }

  push(chunk: Buffer | string): void {
    this.feed(typeof chunk === 'string' ? chunk : this.decoder.write(chunk))
  }

  /** Fin du flux : la dernière ligne, même sans `\n`. */
  end(): void {
    this.feed(this.decoder.end())
    if (!this.overflow && this.pending) this.onLine(renderLine(this.pending))
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
      if (!this.overflow) this.onLine(renderLine(this.pending))
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

/** Hôte lisible d'une adresse (ASCII, punycode pour un nom international), ou `undefined`. */
function hostOf(raw: string): string | undefined {
  if (raw.length > MAX_URL_CHARS) return undefined
  try {
    const host = new URL(raw).hostname
    return host && host.length <= 253 && /^[\x21-\x7e]+$/.test(host) ? host : undefined
  } catch {
    return undefined
  }
}

/**
 * Adresse de page acceptée seulement si : ASCII imprimable, au plus `MAX_URL_CHARS`, lue en entier
 * par `new URL`, `https:`, hôte **exactement** `expectedHost` (ni sous-domaine, ni suffixe, ni point
 * final), sans port explicite autre que celui par défaut, sans identifiants. Rend l'adresse telle que
 * `URL` l'écrit (c'est elle, vérifiée, qui sera ouverte) ; sinon l'hôte seul, s'il se lit.
 */
export function checkPageUrl(raw: string, expectedHost: string): PageCheck {
  if (raw.length > MAX_URL_CHARS || !/^[\x21-\x7e]+$/.test(raw)) {
    return { ok: false, ...hostField(hostOf(raw)) }
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false }
  }
  const host = hostOf(raw)
  const exact =
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.port &&
    url.hostname === expectedHost.toLowerCase()
  return exact ? { ok: true, url: url.href, host: url.hostname } : { ok: false, ...hostField(host) }
}

const hostField = (host: string | undefined) => (host ? { host } : {})

/** Toute adresse (`schéma://…`) d'un texte remplacée par son seul hôte : pour le journal. */
export function scrubUrls(text: string): string {
  return text.replace(/[a-z][a-z0-9+.-]*:\/\/\S*/gi, (url) => `<adresse ${hostOf(url) ?? '?'}>`)
}
