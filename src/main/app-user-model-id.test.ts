import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { APP_USER_MODEL_ID, applyAppUserModelId } from './app-user-model-id'

describe('identifiant d’app de Windows (fiche 229)', () => {
  it('est l’appId d’electron-builder.yml (celui du raccourci posé par l’installeur)', () => {
    const config = readFileSync(
      join(import.meta.dirname, '..', '..', 'electron-builder.yml'),
      'utf8'
    )
    expect(/^appId: (\S+)$/m.exec(config)?.[1]).toBe(APP_USER_MODEL_ID)
  })

  it('n’est posé que sous Windows', () => {
    for (const platform of ['darwin', 'linux'] as const) {
      const app = { setAppUserModelId: vi.fn() }
      expect(applyAppUserModelId(app, platform)).toBe(false)
      expect(app.setAppUserModelId).not.toHaveBeenCalled()
    }
    const app = { setAppUserModelId: vi.fn() }
    expect(applyAppUserModelId(app, 'win32')).toBe(true)
    expect(app.setAppUserModelId).toHaveBeenCalledWith('dev.bobine.app')
  })
})
