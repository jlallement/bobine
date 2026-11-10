import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findAndroidProjects, gradleErrors, GradleBuilds, hasAndroidProject } from './gradle'

const dir = () => mkdtempSync(join(tmpdir(), 'gradle-'))

/** Projet Gradle avec un faux `gradlew` qui produit un APK, ou échoue. */
function project(fail: boolean): string {
  const root = dir()
  writeFileSync(join(root, 'settings.gradle.kts'), 'include(":app")')
  writeFileSync(
    join(root, 'gradlew'),
    fail
      ? `#!/bin/sh\necho "e: file:///src/Main.kt:3:5 Unresolved reference 'foo'."\necho "FAILURE: Build failed with an exception."\nexit 1\n`
      : `#!/bin/sh\nmkdir -p app/build/outputs/apk/debug && echo apk > app/build/outputs/apk/debug/app-debug.apk\necho "BUILD SUCCESSFUL"\n`
  )
  chmodSync(join(root, 'gradlew'), 0o755)
  return root
}

const sdk = { root: '/sdk', adb: '/sdk/platform-tools/adb', emulator: '/sdk/emulator/emulator' }

describe('projets et compilation Gradle', () => {
  it('projet Android trouvé, y compris dans android/ (Flutter, React Native)', () => {
    const root = dir()
    mkdirSync(join(root, 'android'))
    writeFileSync(join(root, 'android/settings.gradle'), '')
    writeFileSync(join(root, 'android/gradlew'), '')
    expect(findAndroidProjects(root)).toEqual([join(root, 'android')])
    expect(hasAndroidProject(dir())).toBe(false)
  })

  it('compilation en tâche de fond : APK trouvé, ou échec avec ses erreurs', async () => {
    const ok = new GradleBuilds(sdk)
    const root = project(false)
    const job = ok.start(root, 'assembleDebug')
    expect(ok.start(root, 'assembleDebug')).toBe(job)
    await job.done
    expect(job.status).toBe('succeeded')
    expect(job.apkPath).toMatch(/app-debug\.apk$/)
    const failed = new GradleBuilds(sdk).start(project(true), 'assembleDebug')
    await failed.done
    expect(failed.status).toBe('failed')
    expect(gradleErrors(failed.lines)).toEqual([
      "e: file:///src/Main.kt:3:5 Unresolved reference 'foo'.",
      'FAILURE: Build failed with an exception.'
    ])
  })

  it('projet Flutter : APK cherché aussi sous ../build/app/outputs (fiche 122)', async () => {
    const root = dir()
    const android = join(root, 'android')
    mkdirSync(android)
    writeFileSync(join(android, 'settings.gradle'), '')
    writeFileSync(
      join(android, 'gradlew'),
      `#!/bin/sh\nmkdir -p ../build/app/outputs/flutter-apk && echo apk > ../build/app/outputs/flutter-apk/app-debug.apk\necho "BUILD SUCCESSFUL"\n`
    )
    chmodSync(join(android, 'gradlew'), 0o755)
    const job = new GradleBuilds(sdk).start(android, 'assembleDebug')
    await job.done
    expect(job.status).toBe('succeeded')
    expect(job.apkPath).toBe(join(root, 'build/app/outputs/flutter-apk/app-debug.apk'))
  })

  it('Gradle réussi sans APK : la compilation reste réussie, les dossiers cherchés sont dits', async () => {
    const root = dir()
    writeFileSync(join(root, 'settings.gradle'), '')
    writeFileSync(join(root, 'gradlew'), `#!/bin/sh\necho "BUILD SUCCESSFUL"\n`)
    chmodSync(join(root, 'gradlew'), 0o755)
    const job = new GradleBuilds(sdk).start(root, 'assembleDebug')
    await job.done
    expect(job.status).toBe('succeeded')
    expect(job.apkPath).toBeUndefined()
    expect(job.apkSearched).toEqual([
      join(root, 'app/build/outputs/apk'),
      join(root, 'build/outputs/apk'),
      join(root, '../build/app/outputs/flutter-apk'),
      join(root, '../build/app/outputs/apk')
    ])
    expect(job.lines.join('\n')).not.toMatch(/Aucun APK/)
  })
})
