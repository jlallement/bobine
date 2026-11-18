import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { androidProjectAppears, hasAndroidProject } from './android/gradle'
import { appleProjectAppears, hasAppleProject } from './simulator/xcode'

const folder = () => mkdtempSync(join(tmpdir(), 'bobine-scan-'))

/** Recherche asynchrone de fin de tour (fiche 241) : mêmes réponses que la recherche à l'ouverture. */
describe('recherche d’un projet sans bloquer le main (fiche 241)', () => {
  it('Xcode : profondeur 3, `Package.swift` à la racine ; dossiers ignorés et trop profonds', async () => {
    const cases: [string, (root: string) => void][] = [
      ['vide', () => {}],
      ['ios/App.xcodeproj', (r) => mkdirSync(join(r, 'ios', 'App.xcodeproj'), { recursive: true })],
      [
        'a/b/App.xcworkspace',
        (r) => mkdirSync(join(r, 'a', 'b', 'App.xcworkspace'), { recursive: true })
      ],
      [
        'a/b/c/App.xcodeproj',
        (r) => mkdirSync(join(r, 'a', 'b', 'c', 'App.xcodeproj'), { recursive: true })
      ],
      [
        'node_modules/x/App.xcodeproj',
        (r) => mkdirSync(join(r, 'node_modules', 'x', 'App.xcodeproj'), { recursive: true })
      ],
      ['Package.swift', (r) => writeFileSync(join(r, 'Package.swift'), '')],
      [
        'sous/Package.swift',
        (r) => {
          mkdirSync(join(r, 'sous'))
          writeFileSync(join(r, 'sous', 'Package.swift'), '')
        }
      ]
    ]
    for (const [name, make] of cases) {
      const root = folder()
      make(root)
      expect([name, await appleProjectAppears(root)]).toEqual([name, hasAppleProject(root)])
    }
    const found = folder()
    mkdirSync(join(found, 'ios', 'App.xcodeproj'), { recursive: true })
    expect(await appleProjectAppears(found)).toBe(true)
  })

  it('Android : `settings.gradle` et `gradlew` ensemble, profondeur 3', async () => {
    const gradle = (dir: string, wrapper = true) => {
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'settings.gradle.kts'), '')
      if (wrapper)
        writeFileSync(join(dir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'), '')
    }
    const cases: [string, (root: string) => void][] = [
      ['vide', () => {}],
      ['racine', (r) => gradle(r)],
      ['android/', (r) => gradle(join(r, 'android'))],
      ['sans gradlew', (r) => gradle(join(r, 'android'), false)],
      ['trop profond', (r) => gradle(join(r, 'a', 'b', 'c'))]
    ]
    for (const [name, make] of cases) {
      const root = folder()
      make(root)
      expect([name, await androidProjectAppears(root)]).toEqual([name, hasAndroidProject(root)])
    }
  })
})
