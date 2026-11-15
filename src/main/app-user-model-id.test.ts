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
      const app = { setAppUserModelId: vi.fn(), setToastActivatorCLSID: vi.fn() }
      expect(applyAppUserModelId(app, platform)).toBe(false)
      expect(app.setAppUserModelId).not.toHaveBeenCalled()
      expect(app.setToastActivatorCLSID).not.toHaveBeenCalled()
    }
    const app = { setAppUserModelId: vi.fn(), setToastActivatorCLSID: vi.fn() }
    expect(applyAppUserModelId(app, 'win32')).toBe(true)
    expect(app.setAppUserModelId).toHaveBeenCalledWith('dev.bobine.app')
    // CLSID fixe, d'un lancement à l'autre (Windows retrouve l'app au clic).
    expect(app.setToastActivatorCLSID).toHaveBeenCalledWith(
      '{55D36188-D3A9-490A-8F53-79D773728C1F}'
    )
  })
})

describe('raccourci de l’activateur des toasts (fiche 229)', () => {
  const shellWith = (current: { toastActivatorClsid?: string; appUserModelId?: string }) => ({
    readShortcutLink: vi.fn(() => ({ target: 'C:\\Bobine.exe', ...current })),
    writeShortcutLink: vi.fn(() => true)
  })

  it('pose le CLSID et l’AUMID sur le raccourci de l’installeur', async () => {
    const { ensureToastShortcut } = await import('./app-user-model-id')
    const shell = shellWith({ appUserModelId: 'dev.bobine.app' })
    expect(ensureToastShortcut(shell, 'C:\\x\\Bobine.lnk', () => true)).toBe('updated')
    expect(shell.writeShortcutLink).toHaveBeenCalledWith('C:\\x\\Bobine.lnk', 'update', {
      target: 'C:\\Bobine.exe',
      toastActivatorClsid: '{55D36188-D3A9-490A-8F53-79D773728C1F}',
      appUserModelId: 'dev.bobine.app'
    })
  })

  it('déjà à jour (casse et accolades indifférentes) : rien n’est réécrit', async () => {
    const { ensureToastShortcut } = await import('./app-user-model-id')
    const shell = shellWith({
      toastActivatorClsid: '55d36188-d3a9-490a-8f53-79d773728c1f',
      appUserModelId: 'dev.bobine.app'
    })
    expect(ensureToastShortcut(shell, 'C:\\x\\Bobine.lnk', () => true)).toBe('up-to-date')
    expect(shell.writeShortcutLink).not.toHaveBeenCalled()
  })

  it('sans raccourci (pnpm dev) : rien ; une erreur de lecture : échec dit, sans lever', async () => {
    const { ensureToastShortcut } = await import('./app-user-model-id')
    expect(ensureToastShortcut(shellWith({}), 'C:\\x\\Bobine.lnk', () => false)).toBe('absent')
    const broken = {
      readShortcutLink: vi.fn(() => {
        throw new Error('illisible')
      }),
      writeShortcutLink: vi.fn(() => true)
    }
    expect(ensureToastShortcut(broken, 'C:\\x\\Bobine.lnk', () => true)).toBe('failed')
  })
})

describe('raccourci des toasts au lancement (fiche 229)', () => {
  it('hors de Windows : rien n’est lu ni écrit', async () => {
    const { windowsToastShortcut } = await import('./app-user-model-id')
    const shell = { readShortcutLink: vi.fn(), writeShortcutLink: vi.fn() }
    for (const platform of ['darwin', 'linux'] as const) {
      expect(windowsToastShortcut({ getPath: () => '/x' }, shell, platform)).toBeUndefined()
    }
    expect(shell.readShortcutLink).not.toHaveBeenCalled()
  })
})
