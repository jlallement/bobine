import { describe, expect, it } from 'vitest'
import { findAndroidSdk, type SdkMachine } from './sdk'

/** Machine simulée : ces fichiers existent, `build-tools` contient ces versions. */
const machine = (
  platform: NodeJS.Platform,
  home: string,
  files: string[],
  buildTools: string[] = []
): SdkMachine => ({
  platform,
  home,
  exists: (path) => files.includes(path),
  list: () => buildTools
})

describe('SDK Android de la machine (fiche 032)', () => {
  it('macOS : ~/Library/Android/sdk, programmes sans extension (comme avant)', () => {
    const sdk = findAndroidSdk(
      {},
      machine(
        'darwin',
        '/Users/ada',
        [
          '/Users/ada/Library/Android/sdk/platform-tools/adb',
          '/Users/ada/Library/Android/sdk/build-tools/35.0.0/aapt2'
        ],
        ['34.0.0', '35.0.0']
      )
    )
    expect(sdk).toEqual({
      root: '/Users/ada/Library/Android/sdk',
      adb: '/Users/ada/Library/Android/sdk/platform-tools/adb',
      emulator: '/Users/ada/Library/Android/sdk/emulator/emulator',
      aapt2: '/Users/ada/Library/Android/sdk/build-tools/35.0.0/aapt2'
    })
  })

  it('Windows (fiche 229) : %LOCALAPPDATA%\\Android\\Sdk, `.exe`, Java d’Android Studio', () => {
    const root = 'C:\\Users\\ada\\AppData\\Local\\Android\\Sdk'
    const sdk = findAndroidSdk(
      { LOCALAPPDATA: 'C:\\Users\\ada\\AppData\\Local', ProgramFiles: 'C:\\Program Files' },
      machine(
        'win32',
        'C:\\Users\\ada',
        [
          `${root}\\platform-tools\\adb.exe`,
          `${root}\\build-tools\\35.0.0\\aapt2.exe`,
          'C:\\Program Files\\Android\\Android Studio\\jbr'
        ],
        ['35.0.0']
      )
    )
    expect(sdk).toEqual({
      root,
      adb: `${root}\\platform-tools\\adb.exe`,
      emulator: `${root}\\emulator\\emulator.exe`,
      aapt2: `${root}\\build-tools\\35.0.0\\aapt2.exe`,
      javaHome: 'C:\\Program Files\\Android\\Android Studio\\jbr'
    })
  })

  it('Windows : ANDROID_HOME d’abord ; sans `adb.exe`, pas de SDK', () => {
    const files = ['D:\\sdk\\platform-tools\\adb.exe']
    expect(
      findAndroidSdk({ ANDROID_HOME: 'D:\\sdk' }, machine('win32', 'C:\\Users\\ada', files))?.adb
    ).toBe('D:\\sdk\\platform-tools\\adb.exe')
    const unix = ['D:\\sdk\\platform-tools\\adb']
    expect(
      findAndroidSdk({ ANDROID_HOME: 'D:\\sdk' }, machine('win32', 'C:\\Users\\ada', unix))
    ).toBeUndefined()
  })
})
