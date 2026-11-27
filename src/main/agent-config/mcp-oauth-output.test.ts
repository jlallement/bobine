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
const EXPECTED = { host: HOST, path: '/oauth/mcp' }
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

describe('vérification de l’adresse de la page (fiche 293, ADR-0077)', () => {
  /** Chaque cas adverse garde le bon chemin : son refus vient de la règle qu'il vise, pas d'une autre. */
  const P = '/oauth/mcp'
  const LOOP = 'redirect_uri=http%3A%2F%2F127.0.0.1%3A54321%2Fcallback'

  it('acceptée : https, hôte et chemin exacts, sans port ni identifiants ; rendue normalisée', () => {
    expect(checkPageUrl(PAGE, EXPECTED)).toEqual({ ok: true, url: PAGE, host: HOST })
    // Hôte en majuscules : le même hôte (DNS), écrit en minuscules par `URL` ; c'est lui qui s'ouvre.
    const upper = checkPageUrl(`HTTPS://WWW.FIGMA.COM${P}?state=S`, EXPECTED)
    expect(upper).toEqual({ ok: true, url: `https://www.figma.com${P}?state=S`, host: HOST })
    // Port par défaut écrit : retiré par `URL`, même origine.
    expect(checkPageUrl(`https://www.figma.com:443${P}`, EXPECTED)).toMatchObject({ ok: true })
    // Retour vers l'agent sur cette machine (relevé), `localhost` aussi ; sans retour : accepté.
    expect(checkPageUrl(`https://www.figma.com${P}?${LOOP}&state=S`, EXPECTED).ok).toBe(true)
    const local = `https://www.figma.com${P}?redirect_uri=http%3A%2F%2Flocalhost%3A9%2Fcb`
    expect(checkPageUrl(local, EXPECTED).ok).toBe(true)
  })

  it.each([
    ['suffixe', `https://www.figma.com.evil.tld${P}`, 'www.figma.com.evil.tld'],
    ['hôte dans la requête', `https://evil.tld${P}?x=www.figma.com`, 'evil.tld'],
    ['http', `http://www.figma.com${P}`, 'www.figma.com'],
    ['identifiants et @', `https://user@www.figma.com@evil.tld${P}`, 'evil.tld'],
    ['utilisateur seul', `https://user@www.figma.com${P}`, 'www.figma.com'],
    ['mot de passe seul', `https://:pw@www.figma.com${P}`, 'www.figma.com'],
    ['utilisateur et mot de passe', `https://user:pw@www.figma.com${P}`, 'www.figma.com'],
    ['sous-domaine', `https://evil.www.figma.com${P}`, 'evil.www.figma.com'],
    ['domaine parent', `https://figma.com${P}`, 'figma.com'],
    ['point final', `https://www.figma.com.${P}`, 'www.figma.com.'],
    ['autre port', `https://www.figma.com:8443${P}`, 'www.figma.com'],
    ['IDN (i cyrillique)', `https://www.fіgma.com${P}`, 'www.xn--fgma-l9d.com'],
    ['punycode', `https://www.xn--fgma-l9d.com${P}`, 'www.xn--fgma-l9d.com'],
    ['antislash avant @', `https://www.figma.com\\@evil.tld${P}`, 'www.figma.com'],
    ['antislash après l’hôte', `https://evil.tld\\@www.figma.com${P}`, 'evil.tld'],
    ['hôte encodé', `https://www%2Efigma%2Ecom${P}`, 'www.figma.com'],
    ['javascript', 'javascript:alert(1)//www.figma.com/oauth/mcp', undefined],
    ['file', 'file:///www.figma.com/oauth/mcp', undefined],
    ['coupée par U+FFFD', `https://www.fig\uFFFDma.com${P}`, undefined],
    ['non ASCII dans la requête', `https://www.figma.com${P}?x=é`, HOST],
    ['contrôle dans la requête', `https://www.figma.com${P}?x=\u0007`, HOST],
    ['espace', `https://www.figma.com${P} x`, 'www.figma.com'],
    ['pas une adresse', 'https://', undefined],
    // Chemin (préréglage : `/oauth/mcp`, exact et tel qu'écrit).
    ['autre chemin', 'https://www.figma.com/oauth', 'www.figma.com'],
    ['chemin plus long', `https://www.figma.com${P}/x`, 'www.figma.com'],
    ['chemin vide, fragment', 'https://www.figma.com#@evil.tld', 'www.figma.com'],
    ['chemin avec ..', `https://www.figma.com/x/..${P}`, 'www.figma.com'],
    ['chemin avec . ', `https://www.figma.com/.${P}`, 'www.figma.com'],
    ['chemin encodé', 'https://www.figma.com/oauth%2Fmcp', 'www.figma.com'],
    ['.. encodé', `https://www.figma.com/x/%2e%2e${P}`, 'www.figma.com'],
    ['lettre encodée', 'https://www.figma.com/%6Fauth/mcp', 'www.figma.com'],
    ['double barre', `https://www.figma.com/${P}`, 'www.figma.com'],
    // Retour de la connexion (`redirect_uri`).
    ['retour externe', `https://www.figma.com${P}?redirect_uri=https%3A%2F%2Fevil.tld%2Fcb`, HOST],
    [
      'retour http externe avec port',
      `https://www.figma.com${P}?redirect_uri=http%3A%2F%2Fevil.tld%3A5%2Fcb`,
      HOST
    ],
    [
      'retour https local',
      `https://www.figma.com${P}?redirect_uri=https%3A%2F%2F127.0.0.1%3A5%2Fcb`,
      HOST
    ],
    [
      'retour local sans port',
      `https://www.figma.com${P}?redirect_uri=http%3A%2F%2F127.0.0.1%2Fcb`,
      HOST
    ],
    [
      'retour non encodé externe',
      `https://www.figma.com${P}?redirect_uri=https://evil.tld/cb`,
      HOST
    ],
    [
      'retour avec identifiants',
      `https://www.figma.com${P}?redirect_uri=http%3A%2F%2Fu%40127.0.0.1%3A5%2F`,
      HOST
    ],
    [
      'retour répété (local puis externe)',
      `https://www.figma.com${P}?${LOOP}&redirect_uri=https%3A%2F%2Fevil.tld`,
      HOST
    ],
    ['retour répété (deux fois local)', `https://www.figma.com${P}?${LOOP}&${LOOP}`, HOST],
    [
      'retour encodé deux fois',
      `https://www.figma.com${P}?redirect_uri=http%253A%252F%252F127.0.0.1%253A5%252Fcb`,
      HOST
    ],
    ['retour vide', `https://www.figma.com${P}?redirect_uri=`, HOST]
  ])('refusée : %s', (_label, raw, host) => {
    const check = checkPageUrl(raw, EXPECTED)
    expect(check.ok).toBe(false)
    expect(check.ok ? undefined : check.host).toBe(host)
  })

  it('refusée : trop longue (au-delà de 4 096 caractères), sans même la lire', () => {
    const long = `https://www.figma.com${P}?x=${'a'.repeat(MAX_URL_CHARS)}`
    expect(checkPageUrl(long, EXPECTED)).toEqual({ ok: false })
    expect(checkPageUrl(long.slice(0, MAX_URL_CHARS), EXPECTED)).toMatchObject({ ok: true })
  })

  it('adresse coupée par un retour chariot : seule la fin reste, refusée (rien n’est recollé)', () => {
    const [line] = collect([`https://www.fig\rma.com${P}?state=S\n`])
    expect(line).toBe(`ma.com${P}?state=S`)
    // Couleur au milieu : retirée comme à l'écran ; l'adresse entière est vérifiée ensuite.
    const [colored] = collect([`https://www.figma.com\u001b[31m.evil.tld${P}\n`])
    expect(checkPageUrl(colored ?? '', EXPECTED)).toEqual({
      ok: false,
      host: 'www.figma.com.evil.tld'
    })
    const [bell] = collect([`https://www.fig\u0007ma.com${P}\n`])
    expect(checkPageUrl(bell ?? '', EXPECTED).ok).toBe(false)
    // Retour du curseur de deux colonnes au milieu : tout ce qui précède est effacé.
    const [left] = collect([`●  https://evil.tld/\u001b[2Dwww.figma.com${P}\n`])
    expect(left).toBe(`www.figma.com${P}`)
    // Lien OSC 8 : sa cible cachée est retirée, seul le texte visible reste.
    const [osc] = collect([
      `\u001b]8;;https://evil.tld\u0007https://www.figma.com${P}\u001b]8;;\u0007\n`
    ])
    expect(osc).toBe(`https://www.figma.com${P}`)
    // CSI sur un octet (U+009B) : neutralisé, l'adresse ne se lit plus.
    const [c1] = collect([`\u009b2Dhttps://www.figma.com${P}\n`])
    expect(checkPageUrl(c1 ?? '', EXPECTED).ok).toBe(false)
  })

  it('messages d’erreur : tout mot qui pourrait porter une adresse ou ses paramètres est masqué', () => {
    const text = scrubUrls(
      [
        `page ${PAGE} puis http://127.0.0.1:54321/callback?code=Z fin`,
        'see www.figma.com/oauth?state=FAKESTATE and https:/www.figma.com?state=X',
        'and https:\\\\www.figma.com?state=Y, puis client_id=FAKECLIENTID state=FAKESTATE',
        'C:\\Users\\x\\code_challenge=FAKECHALLENGE spawn opencode ENOENT'
      ].join(' ')
    )
    for (const secret of ['state=', 'code_challenge', 'client_id', 'code=', 'FAKE', '?']) {
      expect(text, secret).not.toContain(secret)
    }
    expect(text).toContain('<adresse www.figma.com>')
    expect(text).toContain('spawn opencode ENOENT')
  })
})
