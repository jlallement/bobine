import { describe, expect, it } from 'vitest'
import { ALL_FEATURES, featuresArgument, featuresFromArgv } from '@shared/platform'
import { currentPlatformFeatures, platformFeatures, systemName } from './platform'

describe('capacités de la plateforme (fiche 145)', () => {
  it('toutes sur macOS', () => {
    expect(platformFeatures('darwin')).toEqual(ALL_FEATURES)
  })

  it('sous Linux, rien de ce que seul macOS a ; polices livrées', () => {
    expect(platformFeatures('linux')).toEqual({
      simulator: false,
      selfInstall: false,
      nativeLanguage: false,
      screenCapture: false,
      finder: false,
      explorer: false,
      windowsPaths: false,
      dockBadge: false,
      appMenu: false,
      insetTitleBar: false,
      commandKey: false,
      overlayScrollbars: false,
      glass: false,
      bundledFonts: true
    })
  })

  it('sous Windows, comme Linux : rien de ce que seul macOS a (fiche 229)', () => {
    // Seule différence avec Linux : le gestionnaire de fichiers s'appelle l'Explorateur.
    expect(platformFeatures('win32')).toEqual({
      ...platformFeatures('linux'),
      explorer: true,
      windowsPaths: true
    })
    expect(platformFeatures('darwin').windowsPaths).toBe(false)
    expect(platformFeatures('darwin').explorer).toBe(false)
    expect(platformFeatures('linux').explorer).toBe(false)
    expect(currentPlatformFeatures({ BOBINE_PLATFORM: 'win32' }, 'darwin')).toEqual(
      platformFeatures('win32')
    )
  })

  it('nom du système des infos techniques', () => {
    expect(systemName('darwin')).toBe('macOS')
    expect(systemName('linux')).toBe('Linux')
    expect(systemName('win32')).toBe('Windows')
    expect(systemName('freebsd')).toBe('freebsd')
  })

  it('BOBINE_PLATFORM impose un système (essais)', () => {
    expect(currentPlatformFeatures({ BOBINE_PLATFORM: 'linux' }, 'darwin').simulator).toBe(false)
    expect(currentPlatformFeatures({}, 'darwin').simulator).toBe(true)
    expect(currentPlatformFeatures({ BOBINE_PLATFORM: '' }, 'linux').simulator).toBe(false)
  })
})

describe('argument du renderer', () => {
  it('relues telles quelles depuis la ligne de commande du renderer', () => {
    for (const platform of ['darwin', 'linux', 'win32']) {
      const features = platformFeatures(platform)
      expect(featuresFromArgv(['electron', featuresArgument(features)])).toEqual(features)
    }
  })

  it('liste vide : `none`, aucune capacité, même raccourcie par Chromium', () => {
    const none = featuresFromArgv(['--bobine-features=none'])
    expect(featuresArgument(none)).toBe('--bobine-features=none')
    expect(featuresFromArgv(['--bobine-features'])).toEqual(
      featuresFromArgv(['--bobine-features='])
    )
    expect(featuresFromArgv(['--bobine-features=none'])).toEqual({
      simulator: false,
      selfInstall: false,
      nativeLanguage: false,
      screenCapture: false,
      finder: false,
      explorer: false,
      windowsPaths: false,
      dockBadge: false,
      appMenu: false,
      insetTitleBar: false,
      commandKey: false,
      overlayScrollbars: false,
      glass: false,
      bundledFonts: false
    })
  })

  it('toutes sans l’argument ; noms inconnus ignorés', () => {
    expect(featuresFromArgv([])).toEqual(ALL_FEATURES)
    expect(featuresFromArgv(['--bobine-features=simulator,teleport'])).toEqual({
      simulator: true,
      selfInstall: false,
      nativeLanguage: false,
      screenCapture: false,
      finder: false,
      explorer: false,
      windowsPaths: false,
      dockBadge: false,
      appMenu: false,
      insetTitleBar: false,
      commandKey: false,
      overlayScrollbars: false,
      glass: false,
      bundledFonts: false
    })
  })
})
