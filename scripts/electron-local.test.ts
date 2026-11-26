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

const FLOOR = '44.5.0'
const ARCH = process.arch === 'arm64' ? 'arm64' : 'x64'
const zipName = (version: string) => `electron-v${version}-darwin-${ARCH}.zip`

/** Archive d'un Electron simulé, et son empreinte SHA-256. */
function fakeZip(root: string, version: string, name = zipName(version)) {
  const content = join(root, `contenu-${version}`)
  fakeElectron(content, version)
  const zip = join(root, name)
  execFileSync('ditto', ['-c', '-k', '.', zip], { cwd: content })
  return { zip, sha: createHash('sha256').update(readFileSync(zip)).digest('hex') }
}

/**
 * Paquet `electron` simulé (sans dist), une archive dont l'empreinte est connue de lui, et un
 * plancher simulé (fiche 288) : `ELECTRON_FLOOR_FILE`, avec l'empreinte de l'archive du plancher.
 */
function setup(archiveVersion = VERSION) {
  const root = mkdtempSync(join(tmpdir(), 'electron-local-'))
  const pkg = join(root, 'electron')
  mkdirSync(pkg)
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: 'electron', version: VERSION }))
  const { zip, sha } = fakeZip(root, archiveVersion, NAME)
  writeFileSync(join(pkg, 'checksums.json'), JSON.stringify({ [NAME]: sha }))
  const floorDir = join(root, 'plancher')
  mkdirSync(floorDir)
  const floor = fakeZip(floorDir, FLOOR)
  const floorFile = join(root, 'electron-floor.json')
  const writeFloor = (version: string, checksums: Record<string, string>) =>
    writeFileSync(floorFile, JSON.stringify({ version, checksums }))
  writeFloor(FLOOR, {
    [`electron-v${FLOOR}-darwin-arm64.zip`]: ARCH === 'arm64' ? floor.sha : 'c'.repeat(64),
    [`electron-v${FLOOR}-darwin-x64.zip`]: ARCH === 'x64' ? floor.sha : 'c'.repeat(64)
  })
  const env = { ...process.env, ELECTRON_PACKAGE_DIR: pkg, ELECTRON_FLOOR_FILE: floorFile }
  const run = (script: string, ...args: string[]) =>
    spawnSync(join(ROOT, 'scripts', script), args, { env, encoding: 'utf8' })
  /** Chemin du paquet relatif au dépôt, comme `node_modules/electron` par défaut. */
  const runRelative = (script: string) =>
    spawnSync(join(ROOT, 'scripts', script), [], {
      env: { ...env, ELECTRON_PACKAGE_DIR: relative(ROOT, pkg) },
      encoding: 'utf8'
    })
  return {
    root,
    pkg,
    zip,
    sha,
    floorZip: floor.zip,
    floorSha: floor.sha,
    writeFloor,
    run,
    runRelative
  }
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
    expect(wrong.stderr).toContain('Electron 43.0.0 : autre majeure')
    expect(existsSync(join(pkg, 'path.txt'))).toBe(false)
  })

  it('app déjà décompressée : version vérifiée, installée avec un avertissement', () => {
    const { root, pkg, run } = setup()
    const app = join(root, 'decompressee')
    fakeElectron(app)
    const result = run('electron-local', join(app, 'Electron.app'))
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("préférez l'archive")
    expect(readFileSync(join(pkg, 'dist', 'version'), 'utf8')).toBe(VERSION)
    expect(run('check-electron').status).toBe(0)
  })
  it('version du projet inchangée : seules les empreintes du paquet npm la valident', () => {
    const { pkg, zip, sha, writeFloor, run } = setup()
    // Empreinte juste dans le fichier du plancher, fausse dans celui du paquet : refusée.
    writeFileSync(join(pkg, 'checksums.json'), JSON.stringify({ [NAME]: '0'.repeat(64) }))
    writeFloor(FLOOR, { [NAME]: sha })
    const result = run('electron-local', zip)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Empreinte SHA-256 inattendue')
    expect(existsSync(join(pkg, 'path.txt'))).toBe(false)
  })
})

describe.skipIf(process.platform !== 'darwin')('plancher d’Electron (fiche 288)', () => {
  it('archive du plancher : empreinte du dépôt vérifiée, installée, dite partout', () => {
    const { pkg, floorZip, run } = setup()
    execFileSync('xattr', ['-w', 'com.apple.quarantine', '0083;00000000;Safari;', floorZip])
    const result = run('electron-local', floorZip)
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain(`Electron ${FLOOR} installé`)
    expect(result.stdout).toContain('plancher accepté')
    expect(result.stdout).toContain(`n'a pas les correctifs de sécurité d'Electron ${VERSION}`)
    expect(readFileSync(join(pkg, 'dist', 'version'), 'utf8')).toBe(FLOOR)
    const binary = join(pkg, 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron')
    expect(quarantined(binary)).toBe(false)
    const check = run('check-electron')
    expect(check.status, check.stderr).toBe(0)
    expect(check.stdout).toContain(`Electron ${FLOOR} installé : plancher accepté`)
    expect(check.stdout).toContain(`correctifs de sécurité d'Electron ${VERSION}`)
  })

  it('Electron.app nu du plancher : accepté sur sa version, avec l’avertissement', () => {
    const { root, pkg, run } = setup()
    const app = join(root, 'app-plancher')
    fakeElectron(app, FLOOR)
    const result = run('electron-local', join(app, 'Electron.app'))
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("préférez l'archive")
    expect(result.stdout).toContain('plancher accepté')
    expect(readFileSync(join(pkg, 'dist', 'version'), 'utf8')).toBe(FLOOR)
  })

  it('refusés, avec la raison : sous le plancher, entre les deux, autre majeure', () => {
    const { root, pkg, run } = setup()
    for (const version of ['44.4.0', '44.6.0']) {
      const { zip } = fakeZip(root, version)
      const result = run('electron-local', zip)
      expect(result.status, version).toBe(1)
      expect(result.stderr).toContain(
        `Electron ${version} : acceptées : ${VERSION} (version du projet) ou ${FLOOR} (plancher`
      )
    }
    for (const version of ['43.9.0', '45.0.0']) {
      const { zip } = fakeZip(root, version)
      const result = run('electron-local', zip)
      expect(result.status, version).toBe(1)
      expect(result.stderr).toContain(`Electron ${version} : autre majeure`)
    }
    const app = join(root, 'app-dessous')
    fakeElectron(app, '44.4.0')
    expect(run('electron-local', join(app, 'Electron.app')).status).toBe(1)
    expect(existsSync(join(pkg, 'path.txt'))).toBe(false)
  })

  it('empreinte fausse du plancher : refusée', () => {
    const { pkg, floorZip, writeFloor, run } = setup()
    writeFloor(FLOOR, {
      [`electron-v${FLOOR}-darwin-arm64.zip`]: '0'.repeat(64),
      [`electron-v${FLOOR}-darwin-x64.zip`]: '0'.repeat(64)
    })
    const result = run('electron-local', floorZip)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`Empreinte SHA-256 inattendue pour ${zipName(FLOOR)}`)
    expect(existsSync(join(pkg, 'path.txt'))).toBe(false)
  })

  it('plancher d’une autre majeure que le projet (non redéfini) : refusé', () => {
    const { pkg, floorZip, floorSha, writeFloor, run } = setup()
    // Le projet passe à la 45 sans redéfinir le plancher (44.5.0).
    writeFileSync(
      join(pkg, 'package.json'),
      JSON.stringify({ name: 'electron', version: '45.0.0' })
    )
    writeFloor(FLOOR, {
      [`electron-v${FLOOR}-darwin-arm64.zip`]: floorSha,
      [`electron-v${FLOOR}-darwin-x64.zip`]: floorSha
    })
    const result = run('electron-local', floorZip)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('plancher inutilisable')
    expect(result.stderr).toContain('à redéfinir')
  })

  it('check-electron : une autre version installée à la main est refusée, avec quoi faire', () => {
    const { pkg, run } = setup()
    fakeElectron(join(pkg, 'dist'), '44.6.0')
    writeFileSync(join(pkg, 'path.txt'), 'Electron.app/Contents/MacOS/Electron')
    const check = run('check-electron')
    expect(check.status).toBe(1)
    expect(check.stderr).toContain('Electron 44.6.0 installé')
    expect(check.stderr).toContain(`rm -rf ${pkg}/dist`)
  })
})
