import { describe, expect, it, vi } from 'vitest'

const showOpenDialog = vi.fn(async () => ({ canceled: false, filePaths: ['/choisi/a-la-main'] }))
const showSaveDialog = vi.fn(async () => ({ canceled: false, filePath: '' as string | undefined }))
const switches = new Set<string>()
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp', commandLine: { hasSwitch: (name: string) => switches.has(name) } },
  BrowserWindow: { getFocusedWindow: () => null },
  dialog: { showOpenDialog, showSaveDialog }
}))
const debug = vi.fn()
vi.mock('./log', () => ({ log: { debug } }))

const { chooseDirectory, saveFile, takePresetFolder } = await import('./dialogs')

describe('fenêtre de choix ouverte à un endroit donné (fiche 287)', () => {
  it('`defaultPath` passe à la fenêtre de macOS ; absent, rien n’est imposé', async () => {
    showOpenDialog.mockClear()
    await chooseDirectory({ title: 'T', buttonLabel: 'B', defaultPath: '/Users/moi/Dev' })
    expect(showOpenDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'T', buttonLabel: 'B', defaultPath: '/Users/moi/Dev' })
    )
    await chooseDirectory({ title: 'T', buttonLabel: 'B' })
    expect(showOpenDialog).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ defaultPath: expect.anything() })
    )
    showOpenDialog.mockClear()
  })
})

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

describe('« Enregistrer sous » de l’export (fiches 043, 247 D14)', () => {
  it('nom saisi avec son extension : la fenêtre de macOS la redouble, le main n’en garde qu’une', async () => {
    showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: '/d/export-mere.md.md' })
    expect(await saveFile('conversation.md', 'markdown')).toBe('/d/export-mere.md')
    showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: '/d/fil.json.json' })
    expect(await saveFile('conversation.json', 'json')).toBe('/d/fil.json')
    showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: '/d/sans-extension' })
    expect(await saveFile('conversation.json', 'json')).toBe('/d/sans-extension.json')
    // Filtre de la fenêtre selon le format, dans Documents.
    expect(showSaveDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        defaultPath: expect.stringMatching(/conversation\.json$/) as unknown,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
    )
  })

  it('annulé : rien', async () => {
    showSaveDialog.mockResolvedValueOnce({ canceled: true, filePath: undefined })
    expect(await saveFile('conversation.md', 'markdown')).toBeNull()
  })
})
