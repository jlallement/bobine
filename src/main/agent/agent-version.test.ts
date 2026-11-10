import { describe, expect, it } from 'vitest'
import {
  compareVersions,
  formatVersion,
  incompatibleProtocol,
  matchesTested,
  MAX_VERSION_LENGTH,
  parseVersion,
  SUPPORTED_PROTOCOLS,
  versionVerdict,
  type ParsedVersion
} from './agent-version'

const v = (raw: string): ParsedVersion => {
  const parsed = parseVersion(raw)
  if (!parsed) throw new Error(`illisible : ${raw}`)
  return parsed
}

describe('versions des agents : lecture (fiche 198)', () => {
  it('formats réels : agentInfo et sorties de --version', () => {
    expect(parseVersion('2.0.9')).toEqual({ numbers: [2, 0, 9], pre: [] })
    // `bob --version` : la version, puis le commit sur une autre ligne.
    expect(parseVersion('2.0.9\ncommit: 9690f20b0')).toEqual({ numbers: [2, 0, 9], pre: [] })
    // `opencode --version` (2.2.5) : préfixe « v », parfois précédé du nom.
    expect(parseVersion('v2.2.5')).toEqual({ numbers: [2, 2, 5], pre: [] })
    expect(parseVersion('opencode v2.2.5')).toEqual({ numbers: [2, 2, 5], pre: [] })
    expect(parseVersion('1.19')).toEqual({ numbers: [1, 19], pre: [] })
    expect(parseVersion('  2.0.32\n')).toEqual({ numbers: [2, 0, 32], pre: [] })
  })

  it('préversions et métadonnées de construction', () => {
    expect(parseVersion('2.3.0-beta.3')).toEqual({ numbers: [2, 3, 0], pre: ['beta', '3'] })
    expect(parseVersion('2.3.0-rc.1+build.42')).toEqual({ numbers: [2, 3, 0], pre: ['rc', '1'] })
    expect(parseVersion('0.0.0-dev-202610280534')?.pre).toEqual(['dev-202610280534'])
  })

  it('sorties bizarres : rien, plutôt qu’une version inventée', () => {
    for (const raw of ['', 'unknown', 'dev', 'v', '2', 'version', '.1.2', 'abc2.0.1']) {
      expect(parseVersion(raw), raw).toBeUndefined()
    }
    expect(parseVersion(undefined)).toBeUndefined()
    expect(parseVersion('99999999999999999999.1')).toBeUndefined()
  })
})

describe('versions des agents : ordre semver', () => {
  const cases: [string, string, number][] = [
    ['2.0.9', '2.0.6', 1],
    ['2.0.10', '2.0.9', 1],
    ['2.2.5', '2.0.32', 1],
    ['1.19', '1.19.0', 0],
    ['1.19.3', '1.19', 1],
    ['2.3.0-beta.1', '2.3.0', -1],
    ['2.3.0-beta.2', '2.3.0-beta.10', -1],
    ['2.3.0-alpha', '2.3.0-beta', -1],
    ['2.3.0-1', '2.3.0-alpha', -1],
    ['2.3.0-beta', '2.3.0-beta.1', -1],
    ['2.3.0-beta.1', '2.2.5', 1]
  ]
  it.each(cases)('%s comparé à %s', (a, b, expected) => {
    expect(compareVersions(v(a), v(b))).toBe(expected)
    expect(compareVersions(v(b), v(a))).toBe(-expected || 0)
  })

  it('une entrée à deux numéros vaut pour toute sa branche', () => {
    expect(matchesTested(v('1.19.5'), v('1.19'))).toBe(true)
    expect(matchesTested(v('1.19.0-rc.1'), v('1.19'))).toBe(true)
    expect(matchesTested(v('1.20.0'), v('1.19'))).toBe(false)
    expect(matchesTested(v('2.0.9'), v('2.0.9'))).toBe(true)
    expect(matchesTested(v('2.0.9-beta.1'), v('2.0.9'))).toBe(false)
    expect(matchesTested(v('2.0'), v('2.0.9'))).toBe(false)
  })
})

describe('versions des agents : verdict d’après le profil', () => {
  const opencode = { testedVersions: ['1.19', '2.0.31', '2.0.32', '2.2.5'] }
  const bob = { testedVersions: ['2.0.6', '2.0.9'] }

  it('versions essayées, branche comprise', () => {
    expect(versionVerdict(opencode, '2.2.5')).toEqual({ kind: 'tested', version: '2.2.5' })
    expect(versionVerdict(opencode, '1.19.5')).toEqual({ kind: 'tested', version: '1.19.5' })
    expect(versionVerdict(opencode, 'v2.2.5')).toEqual({ kind: 'tested', version: '2.2.5' })
  })

  it('plus récente : préversion comprise, avec la dernière essayée', () => {
    expect(versionVerdict(opencode, '2.2.6')).toEqual({
      kind: 'newer',
      version: '2.2.6',
      newest: '2.2.5'
    })
    expect(versionVerdict(bob, '2.1.0-beta.1')).toMatchObject({ kind: 'newer', newest: '2.0.9' })
    expect(versionVerdict({ testedVersions: ['1.19'] }, '1.20.0')).toMatchObject({ kind: 'newer' })
  })

  it('entre deux versions essayées : ni avis ni refus', () => {
    expect(versionVerdict(bob, '2.0.7')).toEqual({ kind: 'untested', version: '2.0.7' })
    expect(versionVerdict(opencode, '2.1.4')).toEqual({ kind: 'untested', version: '2.1.4' })
    expect(versionVerdict(bob, '2.0.9-rc.1')).toEqual({ kind: 'untested', version: '2.0.9-rc.1' })
  })

  it('plus ancienne que les essayées : avertissement, jamais un refus sans plancher', () => {
    expect(versionVerdict(bob, '2.0.3')).toEqual({
      kind: 'older',
      version: '2.0.3',
      oldest: '2.0.6'
    })
    expect(versionVerdict(opencode, '1.18.31')).toMatchObject({ kind: 'older', oldest: '1.19' })
  })

  it('plancher documenté : refus en dessous, avec sa raison', () => {
    const profile = { testedVersions: ['0.1.0'], minVersion: { version: '0.0.5', reason: 'r' } }
    expect(versionVerdict(profile, '0.0.1')).toEqual({
      kind: 'below-floor',
      version: '0.0.1',
      floor: '0.0.5',
      reason: 'r'
    })
    expect(versionVerdict(profile, '0.0.5')).toMatchObject({ kind: 'older' })
    // Plancher sans versions essayées : il s'applique quand même.
    expect(versionVerdict({ minVersion: { version: '2.0', reason: 'r' } }, '1.9')).toMatchObject({
      kind: 'below-floor'
    })
  })

  it('illisible, absente, construction locale ou profil sans versions : inconnue', () => {
    expect(versionVerdict(bob, undefined)).toEqual({ kind: 'unknown' })
    expect(versionVerdict(bob, '')).toEqual({ kind: 'unknown' })
    expect(versionVerdict(bob, 'unknown')).toEqual({ kind: 'unknown' })
    expect(versionVerdict(opencode, '0.0.0-dev-202610280534')).toEqual({ kind: 'unknown' })
    expect(versionVerdict({}, '9.9.9')).toEqual({ kind: 'unknown' })
    expect(versionVerdict({ testedVersions: ['?'] }, '9.9.9')).toEqual({ kind: 'unknown' })
    // Construction locale sous un plancher : jamais de refus.
    const floored = { minVersion: { version: '1.0.0', reason: 'r' } }
    expect(versionVerdict(floored, '0.0.0-next-1')).toEqual({ kind: 'unknown' })
  })
})

describe('protocole ACP', () => {
  it('version prise en charge : compatible ; absente : tolérée', () => {
    expect(SUPPORTED_PROTOCOLS).toEqual([1])
    expect(incompatibleProtocol(1)).toBeUndefined()
    expect(incompatibleProtocol(undefined)).toBeUndefined()
    expect(incompatibleProtocol(null)).toBeUndefined()
  })

  it('un ensemble de versions, pas l’égalité avec celle du SDK', () => {
    // Le jour où l'app parlera 1 et 2 : les deux passent, 3 non, 0 est trop ancien.
    expect(incompatibleProtocol(2, [1, 2])).toBeUndefined()
    expect(incompatibleProtocol(1, [1, 2])).toBeUndefined()
    expect(incompatibleProtocol(3, [1, 2])).toEqual({ announced: '3', tooOld: false })
    expect(incompatibleProtocol(0, [1, 2])).toEqual({ announced: '0', tooOld: true })
  })

  it('autre version, ou valeur inattendue : incompatible, texte nettoyé et borné', () => {
    expect(incompatibleProtocol(2)).toEqual({ announced: '2', tooOld: false })
    expect(incompatibleProtocol(0)).toEqual({ announced: '0', tooOld: true })
    expect(incompatibleProtocol('2025-06-18')).toEqual({ announced: '2025-06-18', tooOld: false })
    // Une chaîne « 1 » n'est pas le nombre 1.
    expect(incompatibleProtocol('1')).toEqual({ announced: '1', tooOld: false })
    const weird = incompatibleProtocol(`v2\n${'x'.repeat(5000)}`)
    expect(weird?.announced.length).toBeLessThanOrEqual(20)
    expect(weird?.announced).not.toContain('\n')
    expect(incompatibleProtocol('\n\t')).toEqual({ announced: '?', tooOld: false })
  })
})

describe('version affichée : normalisée et bornée', () => {
  it('jamais le texte brut', () => {
    expect(versionVerdict({ testedVersions: ['1.0'] }, 'opencode v2.2.5\ncommit abc')).toEqual({
      kind: 'newer',
      version: '2.2.5',
      newest: '1.0'
    })
    const long = versionVerdict({ testedVersions: ['1.0'] }, `9.9.9-${'a'.repeat(5000)}`)
    expect(long.kind === 'newer' && long.version.length).toBe(MAX_VERSION_LENGTH)
    expect(formatVersion(v('2.3.0-beta.1+build.7'))).toBe('2.3.0-beta.1')
  })
})
