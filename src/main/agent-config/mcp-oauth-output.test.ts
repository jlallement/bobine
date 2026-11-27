import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checkPageUrl,
  MAX_LINE_CHARS,
  MAX_URL_CHARS,
  renderLine,
  scrubUrls,
  TerminalLines
} from './mcp-oauth-output'

const FIXTURES = join(__dirname, 'fixtures', 'opencode-2.3.0-mcp-auth')
const HOST = 'www.figma.com'
const PAGE = 'https://www.figma.com/oauth/mcp?client_id=C&state=S&code_challenge=X'

function collect(chunks: (Buffer | string)[]): string[] {
  const lines: string[] = []
  const reader = new TerminalLines((line) => lines.push(line))
  for (const chunk of chunks) reader.push(chunk)
  reader.end()
  return lines
}

describe('lignes d’une sortie de terminal (fiche 293)', () => {
  it('sortie relevée : même résultat d’un bloc, octet par octet ou en morceaux quelconques', () => {
    const bytes = readFileSync(join(FIXTURES, 'sortie-reussie.txt'))
    const whole = collect([bytes])
    expect(whole).toContain('◇  Authorization started')
    expect(whole.some((l) => l.includes('Starting'))).toBe(false)
    expect(whole).toContain('◆  Connected to figma')
    const byteByByte = collect([...bytes].map((b) => Buffer.from([b])))
    expect(byteByByte).toEqual(whole)
    for (const size of [2, 3, 7, 64, 333]) {
      const chunks: Buffer[] = []
      for (let i = 0; i < bytes.length; i += size) chunks.push(bytes.subarray(i, i + size))
      expect(collect(chunks), `morceaux de ${size}`).toEqual(whole)
    }
  })

  it('caractère UTF-8 coupé entre deux morceaux : recollé, pas remplacé', () => {
    const glyph = Buffer.from('●  ok\n')
    expect(collect([glyph.subarray(0, 1), glyph.subarray(1, 2), glyph.subarray(2)])).toEqual([
      '●  ok'
    ])
  })

  it('`\\r` seul et retour du curseur : ce qui précède est effacé, rien n’est recollé', () => {
    expect(renderLine('ancien\rnouveau')).toBe('nouveau')
    expect(renderLine('a\u001b[999D\u001b[Jb')).toBe('b')
    expect(renderLine('ligne\r')).toBe('ligne')
    expect(collect(['ancien\r', 'nouveau\n'])).toEqual(['nouveau'])
    expect(collect(['ligne\r', '\n'])).toEqual(['ligne'])
  })

  it('codes de couleur, OSC, contrôles : couleurs retirées, contrôles neutralisés (U+FFFD)', () => {
    expect(renderLine('\u001b[32mvert\u001b[0m')).toBe('vert')
    expect(renderLine('\u001b]0;titre\u0007texte')).toBe('texte')
    expect(renderLine('a\u0007b')).toBe('a�b')
  })

  it('ligne trop longue : jetée entière, la suivante est lue ; mémoire bornée', () => {
    const lines = collect(['x'.repeat(MAX_LINE_CHARS + 10), PAGE.slice(0, 10), '\nsuite\n'])
    expect(lines).toEqual(['suite'])
    // Sortie énorme sans retour à la ligne : rien ne s'accumule au-delà de la borne.
    const reader = new TerminalLines(() => {})
    for (let i = 0; i < 2000; i++) reader.push('y'.repeat(4096))
    expect(reader.dropped).toBe(1)
    expect((reader as unknown as { pending: string }).pending.length).toBeLessThanOrEqual(
      MAX_LINE_CHARS
    )
  })

  it('tourniquet sans fin sur une ligne : compacté au fil de l’eau, jamais jeté', () => {
    const reader: string[] = []
    const lines = new TerminalLines((line) => reader.push(line))
    for (let i = 0; i < 10_000; i++) lines.push('◒  Starting authorization\u001b[999D\u001b[J')
    lines.push('◇  Authorization started\n')
    expect(reader).toEqual(['◇  Authorization started'])
    expect(lines.dropped).toBe(0)
  })
})

describe('vérification de l’adresse de la page (fiche 293, ADR-0075)', () => {
  it('acceptée : https, hôte exact, sans port ni identifiants ; rendue normalisée', () => {
    expect(checkPageUrl(PAGE, HOST)).toEqual({ ok: true, url: PAGE, host: HOST })
    // Hôte en majuscules : le même hôte (DNS), écrit en minuscules par `URL` ; c'est lui qui s'ouvre.
    const upper = checkPageUrl('https://WWW.FIGMA.COM/oauth/mcp?state=S', HOST)
    expect(upper).toEqual({ ok: true, url: 'https://www.figma.com/oauth/mcp?state=S', host: HOST })
    // Port par défaut écrit : retiré par `URL`, même origine.
    expect(checkPageUrl('https://www.figma.com:443/oauth', HOST)).toMatchObject({ ok: true })
  })

  it.each([
    ['suffixe', 'https://www.figma.com.evil.tld/oauth/mcp', 'www.figma.com.evil.tld'],
    ['hôte dans la requête', 'https://evil.tld/?x=www.figma.com', 'evil.tld'],
    ['http', 'http://www.figma.com/oauth/mcp', 'www.figma.com'],
    ['identifiants et @', 'https://user@www.figma.com@evil.tld/', 'evil.tld'],
    ['identifiants', 'https://user:pass@www.figma.com/oauth', 'www.figma.com'],
    ['sous-domaine', 'https://evil.www.figma.com/oauth', 'evil.www.figma.com'],
    ['domaine parent', 'https://figma.com/oauth', 'figma.com'],
    ['point final', 'https://www.figma.com./oauth', 'www.figma.com.'],
    ['autre port', 'https://www.figma.com:8443/oauth', 'www.figma.com'],
    ['IDN (i cyrillique)', 'https://www.fіgma.com/oauth', 'www.xn--fgma-l9d.com'],
    ['punycode', 'https://www.xn--fgma-l9d.com/oauth', 'www.xn--fgma-l9d.com'],
    ['javascript', 'javascript:alert(1)//www.figma.com', undefined],
    ['file', 'file:///www.figma.com/etc/passwd', undefined],
    ['coupée par U+FFFD', 'https://www.fig�ma.com/oauth', undefined],
    ['espace', 'https://www.figma.com/oauth mcp', 'www.figma.com'],
    ['pas une adresse', 'https://', undefined]
  ])('refusée : %s', (_label, raw, host) => {
    const check = checkPageUrl(raw, HOST)
    expect(check.ok).toBe(false)
    expect(check.ok ? undefined : check.host).toBe(host)
  })

  it('refusée : trop longue (au-delà de 4 096 caractères), sans même la lire', () => {
    const long = `https://www.figma.com/oauth?x=${'a'.repeat(MAX_URL_CHARS)}`
    expect(checkPageUrl(long, HOST)).toEqual({ ok: false })
    expect(checkPageUrl(long.slice(0, MAX_URL_CHARS), HOST)).toMatchObject({ ok: true })
  })

  it('adresse coupée par un retour chariot : seule la fin reste, refusée (rien n’est recollé)', () => {
    const [line] = collect(['https://www.fig\rma.com/oauth/mcp?state=S\n'])
    expect(line).toBe('ma.com/oauth/mcp?state=S')
    // Couleur au milieu : retirée comme à l'écran ; l'adresse entière est vérifiée ensuite.
    const [colored] = collect(['https://www.figma.com\u001b[31m.evil.tld/oauth\n'])
    expect(checkPageUrl(colored ?? '', HOST)).toEqual({ ok: false, host: 'www.figma.com.evil.tld' })
    const [bell] = collect(['https://www.fig\u0007ma.com/oauth\n'])
    expect(checkPageUrl(bell ?? '', HOST).ok).toBe(false)
  })

  it('journal : toute adresse réduite à son hôte, plus de `state`, `code_challenge`, `client_id`', () => {
    const text = scrubUrls(`page ${PAGE} puis http://127.0.0.1:54321/callback?code=Z fin`)
    expect(text).toBe('page <adresse www.figma.com> puis <adresse 127.0.0.1> fin')
    for (const secret of ['state=', 'code_challenge', 'client_id', 'code=']) {
      expect(text).not.toContain(secret)
    }
  })
})
