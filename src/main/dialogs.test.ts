import { describe, expect, it, vi } from 'vitest'

const showOpenDialog = vi.fn(async () => ({ canceled: false, filePaths: ['/choisi/a-la-main'] }))
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  BrowserWindow: { getFocusedWindow: () => null },
  dialog: { showOpenDialog }
}))

const { chooseDirectory, takePresetFolder } = await import('./dialogs')

describe('choix du dossier (pilote, fiche 206)', () => {
  it('BOBINE_PRESET_FOLDER : rendu une fois, sans la fenêtre de macOS ; ensuite la vraie', async () => {
    process.env['BOBINE_PRESET_FOLDER'] = '/projet/du/pilote'
    try {
      expect(await chooseDirectory()).toBe('/projet/du/pilote')
      expect(showOpenDialog).not.toHaveBeenCalled()
      expect(process.env['BOBINE_PRESET_FOLDER']).toBeUndefined()
      expect(await chooseDirectory()).toBe('/choisi/a-la-main')
      expect(showOpenDialog).toHaveBeenCalledTimes(1)
    } finally {
      delete process.env['BOBINE_PRESET_FOLDER']
    }
  })

  it('vide ou absent : rien de préréglé', () => {
    expect(takePresetFolder({})).toBeNull()
    expect(takePresetFolder({ BOBINE_PRESET_FOLDER: '  ' })).toBeNull()
  })
})
