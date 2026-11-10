import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  cleanOutputFiles,
  MAX_OUTPUT_FILE_BYTES,
  toolOutputsDir,
  writeOutputFile
} from './output-file'

describe('sortie ouverte dans l’éditeur (fiche 192)', () => {
  it('fichier 0600 au nom tiré au hasard, dans un dossier 0700 de l’app ; nettoyé', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'outputs-')), 'tool-outputs')
    const a = await writeOutputFile(dir, 'ligne 1\nligne 2\n')
    const b = await writeOutputFile(dir, 'autre')
    expect(dirname(a)).toBe(dir)
    expect(basename(a)).toMatch(/^sortie-[0-9a-f-]{36}\.txt$/)
    expect(a).not.toBe(b)
    expect(readFileSync(a, 'utf8')).toBe('ligne 1\nligne 2\n')
    expect(statSync(a).mode & 0o777).toBe(0o600)
    expect(statSync(dir).mode & 0o777).toBe(0o700)
    cleanOutputFiles(dir)
    expect(existsSync(dir)).toBe(false)
    expect(() => cleanOutputFiles(dir)).not.toThrow()
  })

  it('sortie démesurée refusée', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'outputs-')), 'tool-outputs')
    await expect(writeOutputFile(dir, 'x'.repeat(MAX_OUTPUT_FILE_BYTES + 1))).rejects.toThrow()
  })
})

describe('dossier des sorties hors du profil (fiche 196)', () => {
  it('dans le dossier temporaire, un par profil, jamais dans le dossier de données', async () => {
    const temp = mkdtempSync(join(tmpdir(), 'temp-'))
    const profile = mkdtempSync(join(tmpdir(), 'profil-'))
    const dir = toolOutputsDir(temp, profile)
    expect(dirname(dir)).toBe(temp)
    expect(dir.startsWith(profile)).toBe(false)
    expect(basename(dir)).toMatch(/^bobine-tool-outputs-[0-9a-f]{8}$/)
    expect(toolOutputsDir(temp, profile)).toBe(dir)
    expect(toolOutputsDir(temp, mkdtempSync(join(tmpdir(), 'autre-')))).not.toBe(dir)
    const file = await writeOutputFile(dir, 'sortie')
    expect(statSync(dir).mode & 0o777).toBe(0o700)
    expect(statSync(file).mode & 0o777).toBe(0o600)
    cleanOutputFiles(dir)
    expect(existsSync(dir)).toBe(false)
  })
})
