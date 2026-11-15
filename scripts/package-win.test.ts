import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import {
  ROOT_ONLY_EXCLUSIONS,
  WINDOWS_EXCLUSIONS,
  asarProblems,
  expectedFiles,
  koffiBinary,
  windowsFiles,
  parseWindowsArgs,
  peArch,
  unpackedDir,
  windowsPackageProblems
} from './package-win.mts'
import { BUNDLED_FONT_FILES } from './bundled-fonts.mjs'

/** Petit en-tête PE : « MZ », pointeur en 0x3c, « PE\0\0 » puis le champ Machine. */
function fakeExe(machine: number): Buffer {
  const exe = Buffer.alloc(0x100)
  exe.write('MZ', 0, 'latin1')
  exe.writeUInt32LE(0x80, 0x3c)
  exe.write('PE\0\0', 0x80, 'latin1')
  exe.writeUInt16LE(machine, 0x84)
  return exe
}

describe('paquet Windows (fiche 229)', () => {
  it('options : les deux architectures par défaut, le reste à electron-builder', () => {
    expect(parseWindowsArgs(['--win'])).toEqual({
      archs: ['x64', 'arm64'],
      dirOnly: false,
      builderArgs: []
    })
    expect(parseWindowsArgs(['--win', '--arm64', '--dir', '--publish', 'never'])).toEqual({
      archs: ['arm64'],
      dirOnly: true,
      builderArgs: ['--publish', 'never']
    })
    expect(() => parseWindowsArgs(['--win', '--dry-run'])).toThrow(/sans objet/)
  })

  it('lit l’architecture dans l’en-tête PE', () => {
    expect(peArch(fakeExe(0x8664))).toBe('x64')
    expect(peArch(fakeExe(0xaa64))).toBe('arm64')
    expect(peArch(fakeExe(0x14c))).toBe('other')
    expect(peArch(Buffer.from('#!/bin/sh\n'))).toBeUndefined()
  })

  it('dossiers d’electron-builder', () => {
    expect(unpackedDir('x64')).toBe('win-unpacked')
    expect(unpackedDir('arm64')).toBe('win-arm64-unpacked')
  })

  it('un paquet complet n’a aucun problème', () => {
    expect(windowsPackageProblems(expectedFiles('arm64'), 'arm64', 'arm64')).toEqual([])
  })

  it('signale manques, mauvaise architecture et fichiers en trop', () => {
    const pty = 'resources/app.asar.unpacked/node_modules/node-pty/prebuilds'
    const files = [
      ...expectedFiles('x64').filter((f) => !f.endsWith('OpenConsole.exe')),
      `${pty}/darwin-arm64/pty.node`,
      `${pty}/win32-arm64/conpty.node`,
      `${pty}/win32-x64/conpty.pdb`,
      `${pty}/win32-x64/winpty.dll`,
      'resources/app.asar.unpacked/out/mock-agent/main.js',
      'resources/default_app.asar'
    ]
    const problems = windowsPackageProblems(files, 'x64', 'arm64')
    expect(problems).toEqual([
      `absent : ${pty}/win32-x64/conpty/OpenConsole.exe`,
      'Bobine.exe est arm64, attendu x64',
      `binaire d'un autre système : ${pty}/darwin-arm64/pty.node`,
      `binaire d'un autre système : ${pty}/win32-arm64/conpty.node`,
      `symboles de débogage livrés : ${pty}/win32-x64/conpty.pdb`,
      `winpty livré : ${pty}/win32-x64/winpty.dll`,
      'fichier de développement livré : resources/app.asar.unpacked/out/mock-agent/main.js',
      "reste de l'archive d'Electron : resources/default_app.asar"
    ])
  })

  it('app.asar : le build, les dépendances, package.json ; koffi de l’architecture', () => {
    const fonts = BUNDLED_FONT_FILES.map(
      (f) => `/out/renderer/assets/${f.replace('.woff2', '-Ab1_cD2e.woff2')}`
    )
    const base = [
      '/out/main/index.js',
      '/node_modules/koffi/package.json',
      '/package.json',
      ...fonts
    ]
    expect(
      asarProblems([...base, '/node_modules/@koromix/koffi-win32-arm64/package.json'], 'arm64')
    ).toEqual([])
    expect(
      asarProblems(
        [
          '/out',
          '/src/main/index.ts',
          '/docs/README.md',
          '\\vendor\\axe',
          '/node_modules/koffi/node_modules/@koromix/koffi-darwin-arm64/index.js'
        ],
        'x64'
      )
    ).toEqual([
      'hors du build dans app.asar : docs',
      'hors du build dans app.asar : src',
      'hors du build dans app.asar : vendor',
      'koffi absent de app.asar',
      "binaire de koffi d'un autre système : koffi-darwin-arm64",
      ...BUNDLED_FONT_FILES.map((f) => `police absente de app.asar : ${f}`)
    ])
  })

  it('reprend la liste `files` de la racine, adaptée à Windows', () => {
    const config = parse(
      readFileSync(join(import.meta.dirname, '..', 'electron-builder.yml'), 'utf8')
    ) as { files: string[]; win: Record<string, unknown> }
    const files = windowsFiles(config.files)
    expect(files).toEqual([
      ...config.files.filter((p) => !ROOT_ONLY_EXCLUSIONS.includes(p)),
      ...WINDOWS_EXCLUSIONS
    ])
    expect(files).toContain('out/**')
    // Jamais de liste `files` dans la section `win` (seules exclusions : tout le dépôt dans l'app).
    expect(config.win['files']).toBeUndefined()
    expect(() => windowsFiles(['out/**'])).toThrow(/absent de `files`/)
  })

  it('chemin du binaire de koffi', () => {
    const path =
      'resources/app.asar.unpacked/node_modules/@koromix/koffi-win32-x64/win32_x64/koffi.node'
    expect(koffiBinary('x64').test(path)).toBe(true)
    expect(koffiBinary('arm64').test(path)).toBe(false)
  })
})
