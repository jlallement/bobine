import { existsSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Run } from './run'
import { parseDevices, runtimeName, Simctl, toMacRoman } from './simctl'

const LIST = JSON.stringify({
  devices: {
    'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [
      { udid: 'B', name: 'iPhone 17', state: 'Shutdown', isAvailable: true },
      { udid: 'C', name: 'iPad', state: 'Shutdown', isAvailable: false }
    ],
    'com.apple.CoreSimulator.SimRuntime.iOS-26-0': [
      { udid: 'A', name: 'iPhone Air', state: 'Booted', isAvailable: true }
    ]
  }
})

describe('simctl', () => {
  it('appareils disponibles, démarrés d’abord, runtime lisible', () => {
    expect(parseDevices(LIST)).toEqual([
      { udid: 'A', name: 'iPhone Air', state: 'Booted', runtime: 'iOS 26.0' },
      { udid: 'B', name: 'iPhone 17', state: 'Shutdown', runtime: 'iOS 26.5' }
    ])
    expect(runtimeName('com.apple.CoreSimulator.SimRuntime.watchOS-11-2')).toBe('watchOS 11.2')
  })

  it('lancement : pid lu ; erreur de simctl rendue lisible', async () => {
    const calls: string[][] = []
    const run: Run = async (_file, args) => {
      calls.push(args)
      if (args[1] === 'launch')
        return { code: 0, stdout: Buffer.from('com.demo.app: 4242\n'), stderr: '' }
      return {
        code: 149,
        stdout: Buffer.alloc(0),
        stderr: 'An error was encountered processing the command\nmore'
      }
    }
    const simctl = new Simctl(run)
    expect(await simctl.launch('A', 'com.demo.app')).toBe(4242)
    expect(calls[0]).toEqual([
      'simctl',
      'launch',
      '--terminate-running-process',
      'A',
      'com.demo.app'
    ])
    await expect(simctl.install('A', '/x.app')).rejects.toThrow(
      'simctl install : An error was encountered processing the command'
    )
  })

  it('capture par un fichier temporaire (simctl n’écrit plus sur la sortie standard), supprimé ensuite', async () => {
    let target = ''
    const run: Run = async (_file, args) => {
      target = args.at(-1) ?? ''
      writeFileSync(target, Buffer.from([0xff, 0xd8, 0xff]))
      return { code: 0, stdout: Buffer.alloc(0), stderr: '' }
    }
    const image = await new Simctl(run).screenshot('A')
    expect([...image]).toEqual([0xff, 0xd8, 0xff])
    expect(target).not.toBe('-')
    expect(existsSync(target)).toBe(false)
  })

  it('démarrage : déjà démarré n’est pas une erreur', async () => {
    const run: Run = async () => ({
      code: 149,
      stdout: Buffer.alloc(0),
      stderr: 'Unable to boot device in current state: Booted'
    })
    await expect(new Simctl(run).boot('A')).resolves.toBeUndefined()
  })

  it('texte encodé en MacRoman pour le presse-papiers (ce que lit simctl pbcopy)', () => {
    const encoded = toMacRoman('Zoé « ça » € œ\nfin')
    expect('bytes' in encoded && [...encoded.bytes]).toEqual([
      0x5a, 0x6f, 0x8e, 0x20, 0xc7, 0x20, 0x8d, 0x61, 0x20, 0xc8, 0x20, 0xdb, 0x20, 0xcf, 0x0d,
      0x66, 0x69, 0x6e
    ])
    expect(toMacRoman('ok 🚀 ☃')).toEqual({ missing: ['🚀', '☃'] })
  })
})
