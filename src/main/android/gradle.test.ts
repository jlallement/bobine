import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findAndroidProjects, gradleErrors, GradleBuilds, hasAndroidProject } from './gradle'
import { fakeProgram, ON_WINDOWS } from '../test-platform'

const dir = () => mkdtempSync(join(tmpdir(), 'gradle-'))

/** Faux script de Gradle du projet : `gradlew` (sh) sous Unix, `gradlew.bat` (node) sous Windows. */
const gradlew = (projectDir: string, behaviour: { sh: string; js: string }) =>
  fakeProgram(projectDir, 'gradlew', behaviour, '.bat')

/** Comportement en JavaScript : écrit un APK dans `apkDir` (relatif), puis « BUILD SUCCESSFUL ». */
const apkWriter = (apkDir: string) =>
  `const fs = require('fs')\nfs.mkdirSync(${JSON.stringify(apkDir)}, { recursive: true })\n` +
  `fs.writeFileSync(${JSON.stringify(`${apkDir}/app-debug.apk`)}, 'apk\\n')\nconsole.log('BUILD SUCCESSFUL')\n`

/** Projet Gradle avec un faux `gradlew` qui produit un APK, ou échoue. */
function project(fail: boolean): string {
  const root = dir()
  writeFileSync(join(root, 'settings.gradle.kts'), 'include(":app")')
  gradlew(
    root,
    fail
      ? {
          sh: `echo "e: file:///src/Main.kt:3:5 Unresolved reference 'foo'."\necho "FAILURE: Build failed with an exception."\nexit 1`,
          js: `console.log("e: file:///src/Main.kt:3:5 Unresolved reference 'foo'.")\nconsole.log('FAILURE: Build failed with an exception.')\nprocess.exit(1)\n`
        }
      : {
          sh: `mkdir -p app/build/outputs/apk/debug && echo apk > app/build/outputs/apk/debug/app-debug.apk\necho "BUILD SUCCESSFUL"`,
          js: apkWriter('app/build/outputs/apk/debug')
        }
  )
  return root
}

const sdk = { root: '/sdk', adb: '/sdk/platform-tools/adb', emulator: '/sdk/emulator/emulator' }

describe('projets et compilation Gradle', () => {
  it('projet Android trouvé, y compris dans android/ (Flutter, React Native)', () => {
    const root = dir()
    mkdirSync(join(root, 'android'))
    writeFileSync(join(root, 'android/settings.gradle'), '')
    // Script de Gradle du projet : `gradlew` sous Unix, `gradlew.bat` sous Windows.
    writeFileSync(join(root, 'android', ON_WINDOWS ? 'gradlew.bat' : 'gradlew'), '')
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
    gradlew(android, {
      sh: `mkdir -p ../build/app/outputs/flutter-apk && echo apk > ../build/app/outputs/flutter-apk/app-debug.apk\necho "BUILD SUCCESSFUL"`,
      js: apkWriter('../build/app/outputs/flutter-apk')
    })
    const job = new GradleBuilds(sdk).start(android, 'assembleDebug')
    await job.done
    expect(job.status).toBe('succeeded')
    expect(job.apkPath).toBe(join(root, 'build/app/outputs/flutter-apk/app-debug.apk'))
  })

  it('Gradle réussi sans APK : la compilation reste réussie, les dossiers cherchés sont dits', async () => {
    const root = dir()
    writeFileSync(join(root, 'settings.gradle'), '')
    gradlew(root, { sh: 'echo "BUILD SUCCESSFUL"', js: "console.log('BUILD SUCCESSFUL')\n" })
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
