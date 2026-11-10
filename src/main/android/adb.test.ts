import { describe, expect, it } from 'vitest'
import type { Run } from '../simulator/run'
import { Adb, parseDevices, parseOrientation, shellQuote } from './adb'

describe('adb', () => {
  it('appareils prêts d’abord', () => {
    expect(
      parseDevices(
        'List of devices attached\nemulator-5556   offline\nemulator-5554   device product:sdk model:sdk_gphone64_arm64 device:emu64a\n\n'
      )
    ).toEqual([
      { serial: 'emulator-5554', state: 'device', model: 'sdk_gphone64_arm64' },
      { serial: 'emulator-5556', state: 'offline' }
    ])
  })

  it('orientation : taille courante, rotation et coins (relevés de l’émulateur, fiche 081)', () => {
    const corners = (r: number) =>
      `      mRoundedCorners=RoundedCorners{[RoundedCorner{position=TopLeft, radius=${r}, center=Point(0, 0)}, RoundedCorner{position=TopRight, radius=${r}, center=Point(0, 0)}, RoundedCorner{position=BottomRight, radius=${r + 4}, center=Point(0, 0)}, RoundedCorner{position=BottomLeft, radius=${r + 4}, center=Point(0, 0)}]}\n`
    expect(
      parseOrientation(
        '    init=1080x2400 420dpi mMinSizeOfResizeableTaskDp=220 cur=1080x2400 app=1080x2400 rng=1080x1080-2400x2400\n      mCurrentRotation=ROTATION_0\n' +
          corners(0)
      )
    ).toEqual({ width: 1080, height: 2400, rotation: 0, cornerRadius: 0 })
    expect(
      parseOrientation(
        '    init=1080x2400 420dpi mMinSizeOfResizeableTaskDp=220 cur=2400x1080 app=2400x1080 rng=1080x1080-2400x2400\n      mCurrentRotation=ROTATION_270\n' +
          corners(110)
      )
    ).toEqual({ width: 2400, height: 1080, rotation: 3, cornerRadius: 110 })
    // Sans rotation lisible : position naturelle ; sans taille : rien.
    expect(parseOrientation('cur=1600x2560 app=1600x2560')).toMatchObject({ rotation: 0 })
    expect(parseOrientation('')).toBeNull()
  })

  it('arguments sûrs pour le shell de l’appareil', () => {
    expect(shellQuote("l'app; rm -rf /")).toBe(`'l'\\''app; rm -rf /'`)
  })

  it('lancement par l’activité résolue ; saisie : espaces en %s ; exception Java = erreur', async () => {
    const calls: string[] = []
    const run: Run = async (_file, args) => {
      calls.push(args.join(' '))
      const command = args.at(-1) ?? ''
      if (command.startsWith('cmd package resolve-activity')) {
        return {
          code: 0,
          stdout: Buffer.from('priority=0 preferredOrder=0\ncom.demo/.MainActivity\n'),
          stderr: ''
        }
      }
      if (command.startsWith('input text')) {
        return {
          code: 0,
          stdout: Buffer.from("Exception occurred while executing 'text':\n..."),
          stderr: ''
        }
      }
      return { code: 0, stdout: Buffer.from(''), stderr: '' }
    }
    const adb = new Adb(run, 'adb', 'emulator')
    expect(await adb.launch('emulator-5554', 'com.demo')).toBe('com.demo/.MainActivity')
    expect(calls).toContain("-s emulator-5554 shell am start -W -n 'com.demo/.MainActivity'")
    await expect(adb.text('emulator-5554', 'a b')).rejects.toThrow('Exception occurred')
    expect(calls).toContain("-s emulator-5554 shell input text 'a%sb'")
  })

  it('erreur d’adb entière : la raison d’un échec d’installation n’est pas coupée (fiche 122)', async () => {
    const run: Run = async () => ({
      code: 1,
      stdout: Buffer.from(''),
      stderr:
        'Performing Streamed Install\nadb: failed to install /b/app.apk: \nFailure [INSTALL_FAILED_INSUFFICIENT_STORAGE: Failed to override installation location]\n'
    })
    const adb = new Adb(run, 'adb', 'emulator')
    await expect(adb.install('emulator-5554', '/b/app.apk')).rejects.toThrow(
      'adb install -r : Performing Streamed Install\nadb: failed to install /b/app.apk:\nFailure [INSTALL_FAILED_INSUFFICIENT_STORAGE: Failed to override installation location]'
    )
  })
})
