import { describe, expect, it, vi } from 'vitest'

const showOpenDialog = vi.fn(async () => ({ canceled: false, filePaths: ['/choisi/a-la-main'] }))
const switches = new Set<string>()
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp', commandLine: { hasSwitch: (name: string) => switches.has(name) } },
  BrowserWindow: { getFocusedWindow: () => null },
  dialog: { showOpenDialog }
}))
const debug = vi.fn()
vi.mock('./log', () => ({ log: { debug } }))

const { chooseDirectory, takePresetFolder } = await import('./dialogs')

describe('choix du dossier : BOBINE_PRESET_FOLDER (pilote, fiche 206)', () => {
  it('profil temporaire : rendu une fois, sans la fenêtre de macOS ; ensuite la vraie', async () => {
    switches.add('profil-temporaire')
    process.env['BOBINE_PRESET_FOLDER'] = '/projet/du/pilote'
    try {
      expect(await chooseDirectory()).toBe('/projet/du/pilote')
      expect(showOpenDialog).not.toHaveBeenCalled()
      expect(process.env['BOBINE_PRESET_FOLDER']).toBeUndefined()
      expect(await chooseDirectory()).toBe('/choisi/a-la-main')
      expect(showOpenDialog).toHaveBeenCalledTimes(1)
      expect(debug).not.toHaveBeenCalled()
    } finally {
      switches.clear()
      delete process.env['BOBINE_PRESET_FOLDER']
      showOpenDialog.mockClear()
    }
  })

  it('profil de l’utilisateur (app installée) : ignorée, dite une fois au journal, vraie fenêtre', async () => {
    process.env['BOBINE_PRESET_FOLDER'] = '/projet/du/pilote'
    try {
      expect(await chooseDirectory()).toBe('/choisi/a-la-main')
      expect(await chooseDirectory()).toBe('/choisi/a-la-main')
      expect(showOpenDialog).toHaveBeenCalledTimes(2)
      expect(debug).toHaveBeenCalledTimes(1)
      expect(process.env['BOBINE_PRESET_FOLDER']).toBeUndefined()
    } finally {
      delete process.env['BOBINE_PRESET_FOLDER']
    }
  })

  it('vide ou absente : rien de préréglé, rien au journal', () => {
    debug.mockClear()
    expect(takePresetFolder({}, true)).toBeNull()
    expect(takePresetFolder({ BOBINE_PRESET_FOLDER: '  ' }, true)).toBeNull()
    expect(takePresetFolder({}, false)).toBeNull()
    expect(debug).not.toHaveBeenCalled()
  })
})
