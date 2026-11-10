/**
 * Avis de licence (fiche 217). Sans build : l'inventaire versionné est confronté au lockfile et
 * aux paquets installés, et THIRD-PARTY-NOTICES.md à ce qu'en tirerait le générateur. Le build
 * lui-même est confronté à l'inventaire par `pnpm third-party-notices --check` (pnpm package, pnpm
 * e2e).
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { packageRoot, packagesOf } from './third-party/bundled-plugin.mts'
import {
  INVENTORY,
  NOTICES,
  installedElectron,
  inventoryDiff,
  noticesFor,
  readInventory,
  shippedPackages,
  type StoredInventory
} from './third-party/notices.mts'
import {
  EXCLUDED_FROM_APP,
  LICENSE_CHOICES,
  licenseFiles,
  packageLicense,
  productionPackages
} from './third-party/packages.mts'
import { groupTexts } from './third-party/render.mts'

const root = resolve(__dirname, '..')
const regenerate = 'pnpm build && pnpm third-party-notices, puis committer'

/** `nom@version` présents dans pnpm-lock.yaml (clés des sections `packages` et `snapshots`). */
function lockedPackages(): Set<string> {
  const locked = new Set<string>()
  for (const line of readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8').split('\n')) {
    const match = /^ {2}'?(@?[^@'\s]+)@([^('\s:]+)/.exec(line)
    if (match) locked.add(`${match[1]}@${match[2]}`)
  }
  return locked
}

describe('inventaire versionné', () => {
  const inventory = readInventory(root)

  it('chaque paquet livré est celui du lockfile (sinon : dépendance montée, avis à refaire)', () => {
    const locked = lockedPackages()
    const missing = [
      ...inventory.bundled,
      ...inventory.production,
      { name: 'electron', version: inventory.electron }
    ]
      .map((p) => `${p.name}@${p.version}`)
      .filter((key) => !locked.has(key))
    expect(missing, `absents de pnpm-lock.yaml : ${regenerate}`).toEqual([])
  })

  it('dépendances de production et Electron : celles installées', () => {
    expect(inventory.production, regenerate).toEqual(productionPackages(root))
    expect(inventory.electron, regenerate).toBe(installedElectron(root))
  })

  it(`${NOTICES} est celui que produit le générateur`, () => {
    const current = readFileSync(join(root, NOTICES), 'utf8')
    expect(current === noticesFor(root, inventory), regenerate).toBe(true)
  })

  it('les doubles licences livrées ont leur choix écrit, avec le lien des sources', () => {
    const notices = readFileSync(join(root, NOTICES), 'utf8')
    expect(notices).toContain('Bobine distributes it under **EPL-2.0**')
    expect(notices).toContain('https://github.com/kieler/elkjs')
    expect(notices).toMatch(/dompurify [\d.]+\*\* is offered under .*\*\*Apache-2\.0\*\*/)
    expect(notices).toContain('Eclipse Public License - v 2.0')
    expect(notices).toContain('Attribution 4.0 International')
    expect(notices).toContain('SIL OPEN FONT LICENSE Version 1.1')
    expect(notices).not.toContain('node_modules/')
  })
})

describe('electron-builder.yml', () => {
  const config = readFileSync(join(root, 'electron-builder.yml'), 'utf8')

  it('exclut de l’app les dépendances que les avis ne citent pas', () => {
    for (const name of EXCLUDED_FROM_APP) expect(config).toContain(`'!node_modules/${name}/**'`)
    expect(config).toContain(`'!out/third-party/**'`)
  })

  it('livre les textes de licence dans licenses/', () => {
    for (const to of [
      'licenses/LICENSE',
      'licenses/NOTICE',
      'licenses/THIRD-PARTY-NOTICES.md',
      'licenses/electron/LICENSE',
      'licenses/electron/LICENSES.chromium.html',
      'licenses/fonts'
    ]) {
      expect(config).toContain(`to: ${to}\n`)
    }
    expect(config).toContain('copyright: Copyright © 2026 Jérôme Lallement')
  })
})

describe('paquet d’un module du build', () => {
  it('le dernier node_modules du chemin, paquet à portée compris', () => {
    const store = '/r/node_modules/.pnpm/a@1.0.0_b@2.0.0/node_modules'
    expect(packageRoot(`${store}/a/dist/index.js`)).toBe(`${store}/a`)
    expect(packageRoot(`${store}/@s/p/lib/x.css?inline`)).toBe(`${store}/@s/p`)
    expect(packageRoot('/r/src/main/index.ts')).toBeNull()
    expect(packageRoot('\0vite/preload-helper.js')).toBeNull()
    expect(packageRoot('/r/node_modules/.vite/deps/x.js')).toBeNull()
  })

  it('les modules virtuels de Vite et Rolldown comptent comme leur paquet', () => {
    expect(
      packagesOf(['\0vite/preload-helper.js', '\0rolldown/runtime.js'], {
        vite: '8.0.0',
        rolldown: '1.0.0'
      })
    ).toEqual([
      { name: 'rolldown', version: '1.0.0' },
      { name: 'vite', version: '8.0.0' }
    ])
    expect(() => packagesOf(['\0vite/preload-helper.js'])).toThrow(/vite/)
  })
})

describe('licence d’un paquet', () => {
  let dir = ''
  const cleanup = (): void => {
    if (dir) rmSync(dir, { recursive: true, force: true })
    dir = ''
  }
  afterEach(cleanup)

  /** Faux dépôt avec un paquet `node_modules/<name>`. */
  function fixture(name: string, pkg: object, files: Record<string, string> = {}): string {
    cleanup()
    dir = mkdtempSync(join(tmpdir(), 'bobine-notices-'))
    const at = join(dir, 'node_modules', name)
    mkdirSync(at, { recursive: true })
    writeFileSync(join(at, 'package.json'), JSON.stringify({ name, version: '1.0.0', ...pkg }))
    for (const [file, text] of Object.entries(files)) writeFileSync(join(at, file), text)
    return dir
  }

  it('une double licence sans choix écrit est refusée', () => {
    fixture('dual', { license: 'MIT OR GPL-3.0' }, { LICENSE: 'MIT' })
    expect(() => packageLicense(dir, { name: 'dual', version: '1.0.0' })).toThrow(/sans choix/)
  })

  it('un paquet sans licence déclarée ni fichier est refusé', () => {
    fixture('bare', {})
    expect(() => packageLicense(dir, { name: 'bare', version: '1.0.0' })).toThrow(/non déclarée/)
    fixture('apache', { license: 'Apache-2.0' })
    expect(() => packageLicense(dir, { name: 'apache', version: '1.0.0' })).toThrow(/aucun fichier/)
  })

  it('MIT sans fichier : texte MIT standard avec l’auteur', () => {
    fixture('tiny', { license: 'MIT', author: 'Ada <ada@example.com>' })
    const license = packageLicense(dir, { name: 'tiny', version: '1.0.0' })
    expect(license.texts[0]).toMatch(/^MIT License\n\nCopyright \(c\) Ada <ada@example.com>/)
  })

  it('NOTICE repris, scripts ignorés, mauvaise version refusée', () => {
    fixture(
      'apache',
      { license: 'Apache-2.0' },
      { LICENSE: 'Apache License', NOTICE: 'Avis', 'license-update.mjs': 'code' }
    )
    expect(licenseFiles(join(dir, 'node_modules', 'apache'))).toEqual(['LICENSE'])
    expect(packageLicense(dir, { name: 'apache', version: '1.0.0' }).notices).toEqual(['Avis'])
    expect(() => packageLicense(dir, { name: 'apache', version: '2.0.0' })).toThrow(/introuvable/)
  })

  it('chaque choix de licence désigne une licence proposée par un paquet livré', () => {
    const shipped = shippedPackages(readInventory(root))
    for (const [name, choice] of Object.entries(LICENSE_CHOICES)) {
      const pkg = shipped.find((p) => p.name === name)
      if (!pkg) throw new Error(`${name} n'est plus livré : retirer son choix`)
      expect(packageLicense(root, pkg).offered).toContain(choice.license)
    }
  })
})

describe('rédaction', () => {
  it('regroupe les textes identiques, garde distincts les avis de copyright différents', () => {
    const groups = groupTexts([
      { label: 'a 1', texts: ['MIT (c) A'] },
      { label: 'b 1', texts: ['MIT (c) B'] },
      { label: 'c 1', texts: ['MIT (c) A'] }
    ])
    expect(groups.map((g) => g.users)).toEqual([['a 1', 'c 1'], ['b 1']])
  })

  it('dit ce qui a changé entre deux inventaires', () => {
    const before: StoredInventory = {
      electron: '1.0.0',
      bundled: [{ name: 'a', version: '1.0.0', in: ['renderer'] }],
      production: []
    }
    const after: StoredInventory = {
      ...before,
      bundled: [{ name: 'a', version: '1.1.0', in: ['renderer'] }]
    }
    expect(inventoryDiff(before, after)).toEqual(['+ a@1.1.0 (renderer)', '- a@1.0.0 (renderer)'])
  })

  it(`${INVENTORY} : un paquet à la fois embarqué et en production n'est listé qu'une fois`, () => {
    const shipped = shippedPackages({
      bundled: [{ name: 'x', version: '1.0.0', in: ['main', 'renderer'] }],
      production: [{ name: 'x', version: '1.0.0' }]
    })
    expect(shipped).toEqual([
      {
        name: 'x',
        version: '1.0.0',
        where: 'main process, interface, app (production dependency)'
      }
    ])
  })
})
