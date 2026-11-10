import { describe, expect, it } from 'vitest'
import { ALL_FEATURES, featuresArgument, featuresFromArgv } from '@shared/platform'
import { currentPlatformFeatures, platformFeatures } from './platform'

describe('capacités de la plateforme (fiche 145)', () => {
  it('toutes sur macOS', () => {
    expect(platformFeatures('darwin')).toEqual(ALL_FEATURES)
  })

  it('sous Linux, rien de ce que seul macOS a', () => {
    expect(platformFeatures('linux')).toEqual({
      simulator: false,
      selfInstall: false,
      nativeLanguage: false,
      screenCapture: false,
      finder: false
    })
  })

  it('BOBINE_PLATFORM impose un système (essais)', () => {
    expect(currentPlatformFeatures({ BOBINE_PLATFORM: 'linux' }, 'darwin').simulator).toBe(false)
    expect(currentPlatformFeatures({}, 'darwin').simulator).toBe(true)
    expect(currentPlatformFeatures({ BOBINE_PLATFORM: '' }, 'linux').simulator).toBe(false)
  })
})

describe('argument du renderer', () => {
  it('relues telles quelles depuis la ligne de commande du renderer', () => {
    for (const platform of ['darwin', 'linux']) {
      const features = platformFeatures(platform)
      expect(featuresFromArgv(['electron', featuresArgument(features)])).toEqual(features)
    }
  })

  it('liste vide : `none`, aucune capacité, même raccourcie par Chromium', () => {
    expect(featuresArgument(platformFeatures('linux'))).toBe('--bobine-features=none')
    expect(featuresFromArgv(['--bobine-features'])).toEqual(
      featuresFromArgv(['--bobine-features='])
    )
    expect(featuresFromArgv(['--bobine-features=none'])).toEqual({
      simulator: false,
      selfInstall: false,
      nativeLanguage: false,
      screenCapture: false,
      finder: false
    })
  })

  it('toutes sans l’argument ; noms inconnus ignorés', () => {
    expect(featuresFromArgv([])).toEqual(ALL_FEATURES)
    expect(featuresFromArgv(['--bobine-features=simulator,teleport'])).toEqual({
      simulator: true,
      selfInstall: false,
      nativeLanguage: false,
      screenCapture: false,
      finder: false
    })
  })
})
