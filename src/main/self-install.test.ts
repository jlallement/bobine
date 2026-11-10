import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  bundleOf,
  diskImageOf,
  ejectDiskImage,
  installDirs,
  isInstalled,
  nodeInstallerIo,
  refusalMarker,
  SelfInstaller,
  type InstallerIo
} from './self-install'

const HOME = '/Users/ada'
const DIRS = installDirs(HOME)

function setup(
  bundle: string,
  options: { admin?: boolean; exists?: string[]; dismissed?: boolean; root?: string } = {}
) {
  const calls: string[] = []
  const io: InstallerIo = {
    // Administrateur : /Applications accessible en écriture ; le dossier personnel, toujours.
    canWrite: (dir) => dir.endsWith(`${HOME}/Applications`) || (options.admin ?? false),
    exists: (path) => (options.exists ?? []).includes(path),
    ensureDir: (dir) => calls.push(`mkdir ${dir}`),
    copy: async (from, to) => {
      calls.push(`copy ${from} → ${to}`)
    },
    trash: async (path) => {
      calls.push(`trash ${path}`)
    },
    relaunch: (to, volume) => calls.push(`relaunch ${to}${volume ? ` puis éjecter ${volume}` : ''}`)
  }
  const dismiss = vi.fn()
  const installer = new SelfInstaller({
    bundle,
    dirs: installDirs(HOME, options.root),
    enabled: true,
    dismissed: () => options.dismissed ?? false,
    dismiss,
    io
  })
  return { installer, calls, dismiss }
}

describe('installation par l’app elle-même (fiche 073)', () => {
  it('chemins : app, disque image, déjà installée', () => {
    expect(bundleOf('/Volumes/Bobine/Bobine.app/Contents/MacOS/Bobine')).toBe(
      '/Volumes/Bobine/Bobine.app'
    )
    expect(bundleOf('/usr/local/bin/node')).toBeUndefined()
    expect(diskImageOf('/Volumes/Bobine/Bobine.app')).toBe('/Volumes/Bobine')
    expect(diskImageOf('/Users/ada/Downloads/Bobine.app')).toBeUndefined()
    expect(isInstalled('/Applications/Bobine.app', DIRS)).toBe(true)
    expect(isInstalled('/Users/ada/Applications/Bobine.app', DIRS)).toBe(true)
    expect(isInstalled('/Users/ada/Downloads/Bobine.app', DIRS)).toBe(false)
    expect(installDirs(HOME, '/tmp/essai')).toEqual({
      everyone: '/tmp/essai/Applications',
      me: '/tmp/essai/Users/ada/Applications'
    })
  })

  it('sans droits d’administrateur : « pour tous » refusé, « pour moi » proposé et installé', async () => {
    const { installer, calls } = setup('/Volumes/Bobine/Bobine.app')
    expect(installer.offer()).toEqual({
      choices: [
        { scope: 'everyone', target: '/Applications/Bobine.app', allowed: false, replacing: false },
        {
          scope: 'me',
          target: '/Users/ada/Applications/Bobine.app',
          allowed: true,
          replacing: false
        }
      ],
      suggested: 'me',
      fromDiskImage: true
    })
    await expect(installer.install('everyone')).rejects.toThrow('droits d’administrateur')
    expect(calls).toEqual([])
    await installer.install('me')
    expect(calls).toEqual([
      'mkdir /Users/ada/Applications',
      'copy /Volumes/Bobine/Bobine.app → /Users/ada/Applications/Bobine.app',
      'relaunch /Users/ada/Applications/Bobine.app puis éjecter /Volumes/Bobine'
    ])
  })

  it('administrateur : les deux choix, /Applications d’office ; l’ancienne version à la corbeille', async () => {
    const { installer, calls } = setup('/Users/ada/Downloads/Bobine.app', {
      admin: true,
      exists: ['/Applications/Bobine.app']
    })
    const offer = installer.offer()
    expect(offer?.choices.map((c) => [c.scope, c.allowed, c.replacing])).toEqual([
      ['everyone', true, true],
      ['me', true, false]
    ])
    expect(offer).toMatchObject({ suggested: 'everyone', fromDiskImage: false })
    await installer.install('everyone')
    expect(calls[0]).toBe('trash /Applications/Bobine.app')
    expect(calls.at(-1)).toBe('relaunch /Applications/Bobine.app')
  })

  it('choix coché d’office : là où Bobine est déjà installée', () => {
    const { installer } = setup('/Volumes/Bobine/Bobine.app', {
      admin: true,
      exists: ['/Users/ada/Applications', '/Users/ada/Applications/Bobine.app']
    })
    expect(installer.offer()?.suggested).toBe('me')
  })

  it('rien à proposer : déjà installée, refusé pour de bon, ou désactivé', async () => {
    expect(setup('/Applications/Bobine.app').installer.offer()).toBeNull()
    expect(setup('/Users/ada/Applications/Bobine.app').installer.offer()).toBeNull()
    expect(setup('/Volumes/Bobine/Bobine.app', { dismissed: true }).installer.offer()).toBeNull()
    const off = new SelfInstaller({
      bundle: undefined,
      dirs: DIRS,
      enabled: true,
      dismissed: () => false,
      dismiss: () => {},
      io: setup('/x.app').installer['options'].io
    })
    expect(off.offer()).toBeNull()
    await expect(setup('/Applications/Bobine.app').installer.install('me')).rejects.toThrow(
      'déjà dans Applications'
    )
    await expect(
      setup('/Volumes/Bobine/Bobine.app').installer.install('partout' as never)
    ).rejects.toThrow('Installation inconnue')
  })

  it('racine imposée (essais) : même si l’app est déjà dans /Applications', () => {
    const { installer } = setup('/Applications/Bobine.app', { root: '/tmp/essai' })
    expect(installer.offer()?.choices.map((c) => c.target)).toEqual([
      '/tmp/essai/Applications/Bobine.app',
      '/tmp/essai/Users/ada/Applications/Bobine.app'
    ])
  })

  it('éjection : quelques essais si le volume est encore occupé, chemins refusés', async () => {
    let tries = 0
    const detach = vi.fn(async () => {
      if (++tries < 2) throw new Error('occupé')
    })
    expect(await ejectDiskImage('/Volumes/Bobine', detach, async () => {})).toBe(true)
    expect(detach).toHaveBeenCalledTimes(2)
    expect(await ejectDiskImage('/Users/ada', detach, async () => {})).toBe(false)
  })
})

describe('entrées-sorties de l’installation par Node (fiche 089)', () => {
  it('« Ne plus proposer » retenu par un fichier ; dossier créé, accès en écriture vu', () => {
    const dir = mkdtempSync(join(tmpdir(), 'installation-'))
    const marker = refusalMarker(join(dir, 'installation-refusee'))
    expect(marker.dismissed()).toBe(false)
    marker.dismiss()
    expect(marker.dismissed()).toBe(true)
    const io = nodeInstallerIo({ trash: async () => {}, relaunch: () => {} })
    io.ensureDir(join(dir, 'Applications'))
    expect(io.exists(join(dir, 'Applications'))).toBe(true)
    expect(io.canWrite(join(dir, 'Applications'))).toBe(true)
    expect(io.canWrite(join(dir, 'absent'))).toBe(false)
  })
})
