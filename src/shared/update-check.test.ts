import { describe, expect, it } from 'vitest'
import {
  compareStrict,
  isReleasePageUrl,
  parseStrictVersion,
  pickUpdate,
  releasePageUrl
} from './update-check'

/** Version lue, ou l'essai échoue. */
const strict = (tag: string | undefined) => {
  const version = parseStrictVersion(tag)
  if (!version) throw new Error(`illisible : ${tag}`)
  return version
}

/** Une Release comme l'API de GitHub la rend (champs utiles seulement). */
const release = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  html_url: releasePageUrl(tag),
  draft: false,
  prerelease: tag.includes('-'),
  name: `<img src=x onerror=alert(1)> ${tag}`,
  body: '**notes** <script>alert(1)</script>',
  ...extra
})

describe('version semver stricte (fiche 274)', () => {
  it('lit X.Y.Z et X.Y.Z-pré, v facultatif', () => {
    expect(parseStrictVersion('v1.0.0-rc.3')).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      pre: ['rc', '3']
    })
    expect(parseStrictVersion('2.10.1')).toEqual({ major: 2, minor: 10, patch: 1, pre: [] })
  })

  it('refuse ce qui n’est pas du semver strict', () => {
    for (const tag of [
      '1.0',
      '1.0.0.0',
      '01.0.0',
      '1.0.0-',
      '1.0.0-rc..1',
      '1.0.0-01',
      '1.0.0+build',
      'latest',
      ' 1.0.0',
      'v1.0.0/../x',
      '',
      null,
      42
    ]) {
      expect(parseStrictVersion(tag), String(tag)).toBeUndefined()
    }
  })

  it('ordre semver : préversions avant la finale, identifiants numériques comparés en nombres', () => {
    const order = [
      '1.0.0-beta.2',
      '1.0.0-beta.10',
      '1.0.0-rc.1',
      '1.0.0-rc.3',
      '1.0.0',
      '1.0.1',
      '1.1.0-beta.1',
      '1.1.0',
      '2.0.0'
    ]
    for (let i = 0; i < order.length - 1; i++) {
      const a = strict(order[i])
      const b = strict(order[i + 1])
      expect(compareStrict(a, b), `${order[i]} < ${order[i + 1]}`).toBe(-1)
      expect(compareStrict(b, a)).toBe(1)
    }
    expect(compareStrict(strict('v1.2.3'), strict('1.2.3'))).toBe(0)
  })
})

describe('page vérifiée d’une Release (fiche 274)', () => {
  it('seulement https://github.com/jlallement/bobine/releases/tag/<étiquette>', () => {
    expect(
      isReleasePageUrl('https://github.com/jlallement/bobine/releases/tag/v1.0.1', 'v1.0.1')
    ).toBe(true)
    for (const url of [
      'http://github.com/jlallement/bobine/releases/tag/v1.0.1',
      'https://github.com.evil.example/jlallement/bobine/releases/tag/v1.0.1',
      'https://evil.example/jlallement/bobine/releases/tag/v1.0.1',
      'https://github.com/autre/bobine/releases/tag/v1.0.1',
      'https://github.com/jlallement/bobine/releases/tag/v1.0.2',
      'https://github.com/jlallement/bobine/releases/tag/v1.0.1/../../../evil',
      'https://github.com@evil.example/jlallement/bobine/releases/tag/v1.0.1',
      'https://user@github.com/jlallement/bobine/releases/tag/v1.0.1',
      'https://github.com:444/jlallement/bobine/releases/tag/v1.0.1',
      'https://github.com/jlallement/bobine/releases/tag/v1.0.1?x=1',
      'https://github.com/jlallement/bobine/releases/tag/v1.0.1#x',
      'javascript:alert(1)',
      42
    ]) {
      expect(isReleasePageUrl(url, 'v1.0.1'), String(url)).toBe(false)
    }
  })
})

describe('version à annoncer (fiche 274, ADR-0066)', () => {
  const list = [
    release('v1.1.0-beta.1'),
    release('v1.0.1'),
    release('v1.0.0'),
    release('v1.0.0-rc.4'),
    release('v1.0.0-rc.3'),
    release('v0.9.0')
  ]

  it('finale installée : la plus haute finale plus récente, jamais une préversion', () => {
    expect(pickUpdate(list, '1.0.0')).toEqual({
      version: '1.0.1',
      prerelease: false,
      url: 'https://github.com/jlallement/bobine/releases/tag/v1.0.1'
    })
    expect(pickUpdate([release('v1.1.0-beta.1')], '1.0.0')).toBeNull()
    expect(pickUpdate(list, '1.0.1')).toBeNull()
  })

  it('préversion installée : préversions de sa ligne et finales de toute ligne', () => {
    // 1.0.0-rc.3 : la plus haute est la 1.0.1 (finale) ; la 1.1.0-beta.1 n'est pas de sa ligne.
    expect(pickUpdate(list, '1.0.0-rc.3')?.version).toBe('1.0.1')
    expect(pickUpdate([release('v1.0.0-rc.4'), release('v1.1.0-beta.1')], '1.0.0-rc.3')).toEqual({
      version: '1.0.0-rc.4',
      prerelease: true,
      url: releasePageUrl('v1.0.0-rc.4')
    })
    expect(pickUpdate([release('v1.1.0-beta.1')], '1.0.0-rc.3')).toBeNull()
    // La rc d'un correctif de la même ligne, oui ; une finale d'une autre ligne, oui.
    expect(pickUpdate([release('v1.0.1-rc.1')], '1.0.0-rc.3')?.version).toBe('1.0.1-rc.1')
    expect(pickUpdate([release('v2.0.0')], '1.0.0-rc.3')?.version).toBe('2.0.0')
    expect(pickUpdate([release('v2.0.0-beta.1')], '1.0.0-rc.3')).toBeNull()
  })

  it('marquée préversion par GitHub sans « - » : traitée en préversion', () => {
    const odd = release('v1.0.1', { prerelease: true })
    expect(pickUpdate([odd], '1.0.0')).toBeNull()
    expect(pickUpdate([odd], '1.0.1-rc.1')).toEqual({
      version: '1.0.1',
      prerelease: true,
      url: releasePageUrl('v1.0.1')
    })
  })

  it('brouillons, étiquettes invalides et pages inattendues ignorés', () => {
    const rejected: string[] = []
    const found = pickUpdate(
      [
        release('v9.0.0', { draft: true }),
        release('v8.0.0', { draft: undefined }),
        release('latest'),
        release('v7.0.0', {
          html_url: 'https://evil.example/jlallement/bobine/releases/tag/v7.0.0'
        }),
        release('v6.0.0', { html_url: 'https://github.com/autre/bobine/releases/tag/v6.0.0' }),
        null,
        'v5.0.0',
        release('v1.0.1')
      ],
      '1.0.0',
      (tag) => rejected.push(tag)
    )
    expect(found?.version).toBe('1.0.1')
    expect(rejected).toEqual(['v7.0.0', 'v6.0.0'])
  })

  it('rien de GitHub ne passe hors numéro et page : ni nom ni notes', () => {
    expect(Object.keys(pickUpdate(list, '1.0.0') ?? {}).sort()).toEqual([
      'prerelease',
      'url',
      'version'
    ])
  })

  it('réponse qui n’est pas une liste : illisible (`undefined`) ; liste vide : rien', () => {
    expect(pickUpdate({ message: 'API rate limit exceeded' }, '1.0.0')).toBeUndefined()
    expect(pickUpdate('[]', '1.0.0')).toBeUndefined()
    expect(pickUpdate([], '1.0.0')).toBeNull()
  })
})
