import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import {
  electronStatus,
  floorBuilderConfig,
  floorProblems,
  readFloor,
  type ElectronFloor
} from './electron-floor.mts'
import { installedElectron, NOTICES, noticesFor, readInventory } from './third-party/notices.mts'

const root = resolve(__dirname, '..')
const floor = readFloor(join(root, 'scripts', 'electron-floor.json'))
const project =
  (
    JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      devDependencies: Record<string, string>
    }
  ).devDependencies['electron'] ?? ''

const fake: ElectronFloor = {
  version: '44.5.0',
  checksums: {
    'electron-v44.5.0-darwin-arm64.zip': 'a'.repeat(64),
    'electron-v44.5.0-darwin-x64.zip': 'b'.repeat(64)
  }
}

describe('plancher d’Electron (fiche 288, ADR-0074)', () => {
  it('celui du dépôt tient face à la version fixée : même majeure, plus ancien, empreintes macOS', () => {
    expect(project, 'version exacte dans package.json').toMatch(/^\d+\.\d+\.\d+$/)
    expect(installedElectron(root)).toBe(project)
    expect(floorProblems(floor, project)).toEqual([])
  })

  it('deux versions acceptées, pas une plage', () => {
    expect(electronStatus('44.7.0', '44.7.0', fake)).toEqual({ kind: 'project' })
    expect(electronStatus('44.5.0', '44.7.0', fake)).toEqual({ kind: 'floor' })
    for (const between of ['44.6.0', '44.5.1', '44.4.9', '44.8.0']) {
      const status = electronStatus(between, '44.7.0', fake)
      expect(status.kind, between).toBe('refused')
      expect(status.kind === 'refused' && status.reason).toContain(
        'acceptées : 44.7.0 (version du projet) ou 44.5.0 (plancher, ADR-0074)'
      )
    }
    for (const other of ['43.9.9', '45.0.0']) {
      const status = electronStatus(other, '44.7.0', fake)
      expect(status.kind === 'refused' && status.reason, other).toContain('autre majeure')
    }
    expect(electronStatus('', '44.7.0', fake).kind).toBe('refused')
  })

  it('plancher inutilisable : autre majeure que le projet (à redéfinir), pas plus ancien, mal formé', () => {
    expect(electronStatus('44.5.0', '45.0.0', fake)).toMatchObject({ kind: 'refused' })
    expect(floorProblems(fake, '45.0.0').join()).toContain('à redéfinir')
    expect(floorProblems(fake, '44.5.0').join()).toContain('pas plus ancien')
    expect(floorProblems(fake, '44.4.0').join()).toContain('pas plus ancien')
    const one = { ...fake, checksums: { 'electron-v44.5.0-darwin-arm64.zip': 'a'.repeat(64) } }
    expect(floorProblems(one, '44.7.0').join()).toContain('empreintes attendues')
    const bad = {
      ...fake,
      checksums: { ...fake.checksums, 'electron-v44.5.0-darwin-x64.zip': 'x' }
    }
    expect(floorProblems(bad, '44.7.0').join()).toContain('mal formée')
  })

  it('configuration de construction : celle du dépôt, seuls les avis de licence pris ailleurs', async () => {
    const original = parse(readFileSync(join(root, 'electron-builder.yml'), 'utf8')) as {
      extraResources: { from: string; to: string }[]
    }
    const config = (await floorBuilderConfig('/tmp/plancher/avis.md')) as typeof original
    const notices = config.extraResources.find((e) => e.to === 'licenses/THIRD-PARTY-NOTICES.md')
    expect(notices?.from).toBe('/tmp/plancher/avis.md')
    const withoutNotices = (c: typeof original) =>
      JSON.stringify({
        ...c,
        extraResources: c.extraResources.filter((e) => e.to !== 'licenses/THIRD-PARTY-NOTICES.md')
      })
    expect(withoutNotices(config)).toBe(withoutNotices(original))
  })

  it('avis de licence du plancher : ceux du dépôt, nommant l’Electron livré', () => {
    const committed = readFileSync(join(root, NOTICES), 'utf8')
    const inventory = readInventory(root)
    const forFloor = noticesFor(root, inventory, floor.version)
    expect(forFloor).toContain(`runs on [Electron](https://www.electronjs.org) ${floor.version} `)
    expect(forFloor).not.toContain(`electron ${project}`)
    expect(forFloor).not.toContain(`(https://www.electronjs.org) ${project}`)
    // Le reste à l'identique : seules les mentions de la version d'Electron changent.
    const neutral = (text: string, version: string) =>
      text
        .replace(`(https://www.electronjs.org) ${version} `, '(https://www.electronjs.org) X ')
        .replace(`Used by: electron ${version}.`, 'Used by: electron X.')
    expect(neutral(forFloor, floor.version)).toBe(neutral(committed, project))
    // Version du projet : exactement le fichier du dépôt (contrôle strict de --check inchangé).
    expect(noticesFor(root, inventory, project)).toBe(committed)
  })
})
