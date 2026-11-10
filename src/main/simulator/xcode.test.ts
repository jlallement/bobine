import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildErrors, findXcodeProjects, hasAppleProject, XcodeBuilds } from './xcode'

const dir = () => mkdtempSync(join(tmpdir(), 'xcode-'))

/** Faux `xcodebuild` : écrit le .app dans le DerivedData demandé, ou échoue. */
function fakeXcodebuild(fail: boolean): string {
  const file = join(dir(), 'xcodebuild')
  writeFileSync(
    file,
    `#!/bin/sh
echo "Compilation…"
${fail ? 'echo "/src/App.swift:12:5: error: cannot find \'foo\' in scope" >&2; echo "** BUILD FAILED **"; exit 65' : ''}
dd=""
while [ $# -gt 0 ]; do if [ "$1" = "-derivedDataPath" ]; then dd="$2"; fi; shift; done
mkdir -p "$dd/Build/Products/Debug-iphonesimulator/Demo.app"
echo "** BUILD SUCCEEDED **"
`
  )
  chmodSync(file, 0o755)
  return file
}

const request = (workspace: string) => ({
  workspace,
  project: { path: join(workspace, 'Demo.xcodeproj'), kind: 'project' as const },
  scheme: 'Demo',
  configuration: 'Debug',
  udid: 'A'
})

describe('projets et compilation Xcode', () => {
  it('projets trouvés (espaces de travail d’abord), dossiers lourds ignorés', () => {
    const root = dir()
    mkdirSync(join(root, 'ios/Runner.xcodeproj'), { recursive: true })
    mkdirSync(join(root, 'ios/Runner.xcworkspace'), { recursive: true })
    mkdirSync(join(root, 'node_modules/x/Lib.xcodeproj'), { recursive: true })
    expect(findXcodeProjects(root).map((p) => p.kind)).toEqual(['workspace', 'project'])
    expect(hasAppleProject(root)).toBe(true)
    expect(hasAppleProject(dir())).toBe(false)
  })

  it('erreurs de compilation extraites sans doublons', () => {
    expect(
      buildErrors([
        'CompileSwift normal arm64',
        '/a.swift:1:1: error: boom',
        '/a.swift:1:1: error: boom',
        '** BUILD FAILED **'
      ])
    ).toEqual(['/a.swift:1:1: error: boom', '** BUILD FAILED **'])
  })

  it('compilation en tâche de fond : .app trouvé, ou échec avec ses erreurs', async () => {
    const workspace = dir()
    const ok = new XcodeBuilds(dir(), fakeXcodebuild(false))
    const job = ok.start(request(workspace))
    expect(ok.start(request(workspace))).toBe(job)
    await job.done
    expect(job.status).toBe('succeeded')
    expect(job.appPath).toMatch(/Debug-iphonesimulator\/Demo\.app$/)
    expect(ok.derivedData(workspace)).not.toContain(workspace)

    const ko = new XcodeBuilds(dir(), fakeXcodebuild(true))
    const failed = ko.start(request(workspace))
    await failed.done
    expect(failed.status).toBe('failed')
    expect(buildErrors(failed.lines)[0]).toContain("error: cannot find 'foo'")
  })
})
