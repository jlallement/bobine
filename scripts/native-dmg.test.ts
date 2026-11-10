import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AfterPackContext, MacPackager } from 'electron-builder'
import { afterEach, describe, expect, it, vi } from 'vitest'
import afterSign, { createDmg, signDmg } from './native-dmg.mts'

const { native } = vi.hoisted(() => ({ native: vi.fn() }))
vi.mock('node:child_process', () => ({ execFileSync: native }))

afterEach(() => {
  vi.unstubAllEnvs()
  native.mockReset()
})

function argument(args: string[], index: number): string {
  const value = args.at(index)
  if (value === undefined) throw new Error(`Argument manquant : ${index}`)
  return value
}

function fixture() {
  // Espaces et apostrophe : les chemins doivent rester des arguments, jamais du shell.
  const root = mkdtempSync(join(tmpdir(), "bobine dmg d'essai-"))
  const app = join(root, 'Bobine.app')
  const executable = join(app, 'Contents', 'MacOS')
  mkdirSync(executable, { recursive: true })
  writeFileSync(join(executable, 'Bobine'), 'application signée')
  const destination = join(root, 'dist', 'Bobine-1.2.3-arm64.dmg')
  return { root, app, destination, volume: 'Bobine' }
}

describe('DMG natif (fiche 153)', () => {
  it('prépare l’app et Applications, vérifie puis remplace atomiquement le livrable', async () => {
    const options = fixture()
    mkdirSync(join(options.root, 'dist'))
    writeFileSync(options.destination, 'ancien livrable')
    const calls: string[] = []
    const sign = vi.fn(async (image: string) => {
      expect(readFileSync(image, 'utf8')).toBe('nouvelle image')
      calls.push('sign')
    })
    await createDmg({ ...options, sign }, (command, args) => {
      calls.push(`${command} ${args[0]}`)
      expect(readFileSync(options.destination, 'utf8')).toBe('ancien livrable')
      if (command === 'ditto') {
        cpSync(argument(args, 0), argument(args, 1), { recursive: true })
      } else if (args[0] === 'create') {
        expect(args).toContain('HFS+')
        expect(args).toContain('UDZO')
        const contents = argument(args, args.indexOf('-srcfolder') + 1)
        expect(readdirSync(contents).sort()).toEqual(['Applications', 'Bobine.app'])
        expect(readlinkSync(join(contents, 'Applications'))).toBe('/Applications')
        expect(
          readFileSync(join(contents, 'Bobine.app', 'Contents', 'MacOS', 'Bobine'), 'utf8')
        ).toBe('application signée')
        writeFileSync(argument(args, -1), 'nouvelle image')
      }
    })
    expect(calls).toEqual(['ditto ' + options.app, 'hdiutil create', 'sign', 'hdiutil verify'])
    expect(sign).toHaveBeenCalledOnce()
    expect(readFileSync(options.destination, 'utf8')).toBe('nouvelle image')
    expect(readdirSync(join(options.root, 'dist'))).toEqual(['Bobine-1.2.3-arm64.dmg'])
  })

  it.each(['copy', 'create', 'sign', 'verify'])(
    'échec %s : ancien livrable gardé et temporaires effacés',
    async (failure) => {
      const options = fixture()
      mkdirSync(join(options.root, 'dist'))
      writeFileSync(options.destination, 'ancien livrable')
      await expect(
        createDmg(
          {
            ...options,
            sign: async () => {
              if (failure === 'sign') throw new Error('sign')
            }
          },
          (command, args) => {
            if (command === 'ditto' && failure === 'copy') throw new Error('copy')
            if (args[0] === failure) throw new Error(failure)
            if (args[0] === 'create') writeFileSync(argument(args, -1), 'incomplet')
          }
        )
      ).rejects.toThrow(failure)
      expect(readFileSync(options.destination, 'utf8')).toBe('ancien livrable')
      expect(readdirSync(join(options.root, 'dist'))).toEqual(['Bobine-1.2.3-arm64.dmg'])
    }
  )

  it('le hook est inactif sans manifeste (--dir) ou hors macOS', async () => {
    vi.stubEnv('BOBINE_DMG_MANIFEST', '')
    await expect(afterSign({} as AfterPackContext)).resolves.toBeUndefined()
    const manifest = join(fixture().root, 'manifest')
    vi.stubEnv('BOBINE_DMG_MANIFEST', manifest)
    await afterSign({ electronPlatformName: 'linux' } as AfterPackContext)
    expect(existsSync(manifest)).toBe(false)
  })

  it.each([false, true])(
    'le manifeste annonce seulement le DMG terminé (échec natif : %s)',
    async (failure) => {
      const options = fixture()
      const manifest = join(options.root, 'manifest')
      writeFileSync(manifest, '')
      vi.stubEnv('BOBINE_DMG_MANIFEST', manifest)
      const context = {
        electronPlatformName: 'darwin',
        arch: 3,
        appOutDir: options.root,
        outDir: join(options.root, 'dist'),
        packager: {
          config: { dmg: { sign: false } },
          appInfo: { productFilename: 'Bobine', productName: 'Bobine' },
          expandArtifactNamePattern: () => 'Bobine-1.2.3-arm64.dmg'
        }
      } as unknown as AfterPackContext
      native.mockImplementation((command: string, args: string[]) => {
        if (command === 'ditto') cpSync(argument(args, 0), argument(args, 1), { recursive: true })
        if (args[0] === 'create') writeFileSync(argument(args, -1), 'image complète')
        if (args[0] === 'verify' && failure) throw new Error('image invalide')
      })
      if (failure) {
        await expect(afterSign(context)).rejects.toThrow('image invalide')
        expect(readFileSync(manifest, 'utf8')).toBe('')
        expect(existsSync(options.destination)).toBe(false)
      } else {
        await afterSign(context)
        expect(readFileSync(manifest, 'utf8')).toBe(options.destination + '\n')
        expect(readFileSync(options.destination, 'utf8')).toBe('image complète')
        expect(
          native.mock.calls.every(([command]) => command === 'ditto' || command === 'hdiutil')
        ).toBe(true)
      }
    }
  )

  it.each([null, '/temporary/ci signing.keychain'])(
    'signe avec l’identité désignée et son trousseau %s encore ouvert',
    async (keychainFile) => {
      const packager = {
        codeSigningInfo: { value: Promise.resolve({ keychainFile }) },
        platformSpecificBuildOptions: { identity: 'Identité choisie' }
      } as unknown as MacPackager
      const find = vi.fn(async () => ({ hash: 'CERTIFICATE_SHA1' }))
      const run = vi.fn()
      await signDmg(packager, '/image signée.dmg', run, find)
      expect(find).toHaveBeenCalledWith(
        'Developer ID Application',
        'Identité choisie',
        keychainFile
      )
      expect(run.mock.calls).toEqual([
        [
          'codesign',
          [
            '--sign',
            'CERTIFICATE_SHA1',
            ...(keychainFile ? ['--keychain', keychainFile] : []),
            '/image signée.dmg'
          ]
        ],
        ['codesign', ['--verify', '--strict', '/image signée.dmg']]
      ])
    }
  )

  it('refuse de livrer un DMG non signé si l’identité demandée manque', async () => {
    const packager = {
      codeSigningInfo: { value: Promise.resolve({}) },
      platformSpecificBuildOptions: {}
    } as unknown as MacPackager
    const run = vi.fn()
    await expect(signDmg(packager, '/image.dmg', run, async () => null)).rejects.toThrow(
      'Identité Developer ID introuvable'
    )
    expect(run).not.toHaveBeenCalled()
  })
})
