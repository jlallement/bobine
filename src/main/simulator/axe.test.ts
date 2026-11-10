import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AXE_MISSING,
  axeProblemForAgent,
  axeProblemText,
  checkAxe,
  compareVersions,
  findAxe,
  formatScreen,
  MIN_AXE_VERSION,
  parseAxeVersion,
  type AxeElement
} from './axe'
import type { Run } from './run'

/** Extrait réel de `axe describe-ui` sur Réglages (iOS 26.5), allégé. */
const SCREEN: AxeElement[] = [
  {
    type: 'Application',
    AXLabel: 'Réglages',
    frame: { x: 0, y: 0, width: 402, height: 874 },
    children: [
      {
        type: 'Group',
        frame: { x: 0, y: 0, width: 402, height: 874 },
        children: [
          {
            type: 'Heading',
            AXLabel: 'Réglages',
            frame: { x: 16, y: 120, width: 147, height: 41 }
          },
          {
            type: 'Button',
            AXLabel: 'Général',
            frame: { x: 16, y: 398, width: 370, height: 52 },
            children: [
              {
                type: 'StaticText',
                AXLabel: 'Général',
                frame: { x: 30, y: 410, width: 102, height: 29 }
              }
            ]
          },
          {
            type: 'TextField',
            AXLabel: 'Rechercher',
            AXValue: 'wifi',
            AXUniqueId: 'search',
            frame: { x: 16, y: 800, width: 370, height: 36 }
          },
          {
            type: 'Button',
            AXLabel: 'Désactivé',
            enabled: false,
            frame: { x: 0, y: 0, width: 10, height: 10 }
          }
        ]
      }
    ]
  }
]

describe('lecture de l’écran du simulateur', () => {
  it('une ligne par élément nommé, référence = centre du cadre, texte répété omis', () => {
    const centers: { x: number; y: number }[] = []
    const { lines, screen } = formatScreen(SCREEN, 10_000, (c) => {
      centers.push(c)
      return `ref_${centers.length}`
    })
    expect(screen).toEqual({ width: 402, height: 874 })
    expect(lines).toEqual([
      '- Heading "Réglages" [ref_1]',
      '- Button "Général" [ref_2]',
      '- TextField "Rechercher" valeur="wifi" id=search [ref_3]',
      '- Button "Désactivé" (désactivé) [ref_4]'
    ])
    expect(centers[1]).toEqual({ x: 201, y: 424 })
  })

  it('tronqué au-delà de la taille demandée', () => {
    const { lines, truncated } = formatScreen(SCREEN, 40, () => 'ref')
    expect(truncated).toBe(true)
    expect(lines).toHaveLength(1)
  })
})

describe('version d’AXe', () => {
  const run =
    (reply: { code: number; stdout?: string; stderr?: string }): Run =>
    async () => ({
      code: reply.code,
      stdout: Buffer.from(reply.stdout ?? ''),
      stderr: reply.stderr ?? ''
    })

  it('lit « x.y.z » dans la sortie, compare les versions', () => {
    expect(parseAxeVersion('1.8.0\n')).toBe('1.8.0')
    expect(parseAxeVersion('axe version 1.10.2 (release)')).toBe('1.10.2')
    expect(parseAxeVersion('rien')).toBeUndefined()
    expect(compareVersions('1.8.0', '1.8.0')).toBe(0)
    expect(compareVersions('1.10.0', '1.8.0')).toBeGreaterThan(0)
    expect(compareVersions('1.7.1', '1.8.0')).toBeLessThan(0)
  })

  it('utilisable à partir de la version minimale', async () => {
    expect(await checkAxe(run({ code: 0, stdout: `${MIN_AXE_VERSION}\n` }), '/bin/axe')).toEqual({
      ok: true,
      version: MIN_AXE_VERSION
    })
    expect(await checkAxe(run({ code: 0, stdout: '2.0.0' }), '/bin/axe')).toMatchObject({
      ok: true
    })
  })

  it('absent, trop ancien ou muet : dit pourquoi à l’utilisateur et à l’agent', async () => {
    const missing = await checkAxe(run({ code: 0 }), undefined)
    expect(missing).toEqual({ ok: false, problem: 'missing' })
    expect(axeProblemText(missing)).toContain('n’est pas installé')
    // En développement, la marche à suivre (fiche 043) remplace le lien vers AXe.
    expect(axeProblemText(missing, 'Lancez «\u00a0pnpm fetch-axe\u00a0».')).toBe(
      'Touchers et vidéo indisponibles\u00a0: AXe n’est pas installé. Lancez «\u00a0pnpm fetch-axe\u00a0».'
    )
    expect(axeProblemForAgent(missing)).toBe(AXE_MISSING)

    const old = await checkAxe(run({ code: 0, stdout: '1.7.1' }), '/bin/axe')
    expect(old).toEqual({ ok: false, problem: 'too-old', version: '1.7.1' })
    expect(axeProblemText(old)).toContain('1.7.1 est trop ancien')
    expect(axeProblemForAgent(old)).toContain(`AXe ${MIN_AXE_VERSION} or newer (found 1.7.1)`)

    const mute = await checkAxe(run({ code: 1, stderr: 'dyld: Library not loaded' }), '/bin/axe')
    expect(mute).toEqual({ ok: false, problem: 'unusable', detail: 'dyld: Library not loaded' })
    expect(axeProblemText(mute)).toContain('ne répond pas')
    expect(axeProblemForAgent(mute)).toContain(
      'did not answer --version (dyld: Library not loaded)'
    )
    expect(axeProblemText({ ok: true, version: '1.8.0' })).toBeUndefined()
  })

  it('binaire livré ou téléchargé d’abord, puis le PATH', () => {
    const dir = mkdtempSync(join(tmpdir(), 'axe-'))
    const bundled = join(dir, 'vendor', 'axe')
    mkdirSync(join(dir, 'bin'), { recursive: true })
    writeFileSync(join(dir, 'bin', 'axe'), '')
    expect(findAxe({ PATH: join(dir, 'bin') }, [bundled])).toBe(join(dir, 'bin', 'axe'))
    mkdirSync(dirname(bundled), { recursive: true })
    writeFileSync(bundled, '')
    expect(findAxe({ PATH: join(dir, 'bin') }, [bundled])).toBe(bundled)
    expect(findAxe({ PATH: join(dir, 'nulle-part') }, [join(dir, 'absent')])).toBe(
      findAxe({ PATH: '' })
    )
  })
})
