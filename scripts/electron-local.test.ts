import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')
const VERSION = '44.7.0'
const NAME = `electron-v${VERSION}-darwin-${process.arch === 'arm64' ? 'arm64' : 'x64'}.zip`

/** Electron simulé : `Electron.app` minimal (exécutable, Info.plist) et le fichier `version`. */
function fakeElectron(dir: string, version = VERSION): void {
  const macos = join(dir, 'Electron.app', 'Contents', 'MacOS')
  mkdirSync(macos, { recursive: true })
  writeFileSync(join(macos, 'Electron'), '#!/bin/sh\necho electron\n')
  chmodSync(join(macos, 'Electron'), 0o755)
  writeFileSync(
    join(dir, 'Electron.app', 'Contents', 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleShortVersionString</key><string>${version}</string></dict></plist>`
  )
  writeFileSync(join(dir, 'version'), version)
}

/** Paquet `electron` simulé (sans dist), et une archive dont l'empreinte est connue de lui. */
function setup(archiveVersion = VERSION) {
  const root = mkdtempSync(join(tmpdir(), 'electron-local-'))
  const pkg = join(root, 'electron')
  mkdirSync(pkg)
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: 'electron', version: VERSION }))
  const content = join(root, 'contenu')
  fakeElectron(content, archiveVersion)
  const zip = join(root, NAME)
  execFileSync('ditto', ['-c', '-k', '.', zip], { cwd: content })
  const sha = createHash('sha256').update(readFileSync(zip)).digest('hex')
  writeFileSync(join(pkg, 'checksums.json'), JSON.stringify({ [NAME]: sha }))
  const run = (script: string, ...args: string[]) =>
    spawnSync(join(ROOT, 'scripts', script), args, {
      env: { ...process.env, ELECTRON_PACKAGE_DIR: pkg },
      encoding: 'utf8'
    })
  /** Chemin du paquet relatif au dépôt, comme `node_modules/electron` par défaut. */
  const runRelative = (script: string) =>
    spawnSync(join(ROOT, 'scripts', script), [], {
      env: { ...process.env, ELECTRON_PACKAGE_DIR: relative(ROOT, pkg) },
      encoding: 'utf8'
    })
  return { root, pkg, zip, run, runRelative }
}

const quarantined = (path: string) =>
  spawnSync('xattr', ['-p', 'com.apple.quarantine', path]).status === 0

// `ditto`, `xattr`, `PlistBuddy` : outils de macOS.
describe.skipIf(process.platform !== 'darwin')('Electron obtenu ailleurs (fiche 065)', () => {
  it('absent : check-electron dit quelle archive récupérer et quoi lancer', () => {
    const { run } = setup()
    const check = run('check-electron')
    expect(check.status).toBe(1)
    expect(check.stderr).toContain(NAME)
    expect(check.stderr).toContain('pnpm electron-local')
    // Chemin relatif (cas par défaut) : même message, pas une erreur de Node (fiche 071).
    const relativeCheck = setup().runRelative('check-electron')
    expect(relativeCheck.status).toBe(1)
    expect(relativeCheck.stderr).toContain(NAME)
    expect(relativeCheck.stderr).not.toContain('MODULE_NOT_FOUND')
  })

  it('archive : empreinte vérifiée, extraite sans quarantaine, path.txt écrit', () => {
    const { pkg, zip, run } = setup()
    // Téléchargée par un navigateur : en quarantaine.
    execFileSync('xattr', ['-w', 'com.apple.quarantine', '0083;00000000;Safari;', zip])
    const result = run('electron-local', zip)
    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(join(pkg, 'path.txt'), 'utf8')).toBe('Electron.app/Contents/MacOS/Electron')
    expect(readFileSync(join(pkg, 'dist', 'version'), 'utf8')).toBe(VERSION)
    const binary = join(pkg, 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron')
    expect(existsSync(binary)).toBe(true)
    expect(quarantined(binary)).toBe(false)
    expect(run('check-electron').status).toBe(0)
  })

  it('refusé : empreinte inconnue, mauvaise version', () => {
    const { root, pkg, zip, run } = setup()
    writeFileSync(join(pkg, 'checksums.json'), JSON.stringify({ [NAME]: '0'.repeat(64) }))
    const tampered = run('electron-local', zip)
    expect(tampered.status).toBe(1)
    expect(tampered.stderr).toContain('Empreinte SHA-256 inattendue')
    expect(existsSync(join(pkg, 'path.txt'))).toBe(false)

    const old = join(root, 'ancienne')
    fakeElectron(old, '43.0.0')
    const wrong = run('electron-local', join(old, 'Electron.app'))
    expect(wrong.status).toBe(1)
    expect(wrong.stderr).toContain('version 43.0.0, attendu 44.7.0')
  })

  it('app déjà décompressée : version vérifiée, installée avec un avertissement', () => {
    const { root, pkg, run } = setup()
    const app = join(root, 'decompressee')
    fakeElectron(app)
    const result = run('electron-local', join(app, 'Electron.app'))
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('préférez l’archive'.replace('’', "'"))
    expect(readFileSync(join(pkg, 'dist', 'version'), 'utf8')).toBe(VERSION)
    expect(run('check-electron').status).toBe(0)
  })
})
