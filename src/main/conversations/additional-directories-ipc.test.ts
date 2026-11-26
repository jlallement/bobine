import { mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AgentStatus } from '@shared/agent'
import { folderHandlers } from './additional-directories-ipc'
import { NATIVE_FOLDER_SYSTEM } from './extra-folder-check'
import type { ConversationRecord } from './store'
import { tempDir } from '../test-platform'

/**
 * Canal `conversation:addFolder` (fiches 179, 290) : fenêtre native, saisie et glisser passent par
 * la même vérification. Vrai disque (dossier jetable), gestionnaire simulé.
 */
describe('conversation:addFolder — un seul chemin de vérification (fiche 290)', () => {
  let root = ''
  let workspace = ''
  let library = ''
  beforeAll(async () => {
    root = tempDir('bob-add-folder-')
    mkdirSync(join(root, 'app'))
    mkdirSync(join(root, 'app', 'src'))
    mkdirSync(join(root, 'lib'))
    symlinkSync(join(root, 'app'), join(root, 'vers-app'), 'junction')
    workspace = await NATIVE_FOLDER_SYSTEM.realpath(join(root, 'app'))
    library = await NATIVE_FOLDER_SYSTEM.realpath(join(root, 'lib'))
  })
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  function setup(chosen: string | null, status: AgentStatus | undefined = 'ready') {
    const record = { id: 'c1', workspace } as ConversationRecord
    const manager = {
      record,
      restart: vi.fn(async () => {}),
      updateRecord: vi.fn(
        (_id: string, change: (r: ConversationRecord, s: AgentStatus | undefined) => unknown) => {
          change(record, status)
          return status
        }
      )
    }
    const dialog = vi.fn(async () => chosen)
    const handlers = folderHandlers(manager, dialog, () => join(root))
    const add = handlers['conversation:addFolder'] as (id: unknown, path?: unknown) => unknown
    return { manager, dialog, add }
  }

  it('chemin saisi : vérifié, retenu, aucune fenêtre ouverte', async () => {
    const { manager, dialog, add } = setup(null)
    expect(await add('c1', `  ${join(root, 'lib')}/ \n`)).toEqual({ ok: true, folder: library })
    expect(dialog).not.toHaveBeenCalled()
    expect(manager.record.additionalDirectories).toEqual([library])
    expect(manager.restart).toHaveBeenCalledTimes(1)
  })

  it('sans chemin : la fenêtre native, ouverte sur le parent ; annulée : `null`, rien ne change', async () => {
    const { manager, dialog, add } = setup(null)
    expect(await add('c1')).toBeNull()
    expect(dialog).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: join(root) }))
    expect(manager.record.additionalDirectories).toBeUndefined()
  })

  it('fenêtre native : mêmes refus que la saisie (le dossier de travail, par un lien)', async () => {
    const fromDialog = setup(join(root, 'vers-app'))
    const typed = setup(null)
    const expected = { ok: false, reason: 'isWorkspace', folder: workspace }
    expect(await fromDialog.add('c1')).toEqual(expected)
    expect(await typed.add('c1', join(root, 'vers-app'))).toEqual(expected)
    expect(fromDialog.manager.restart).not.toHaveBeenCalled()
    expect(typed.manager.restart).not.toHaveBeenCalled()
  })

  it('refus du texte : rien n’est lu ni écrit', async () => {
    const { manager, add } = setup(null)
    expect(await add('c1', 'lib')).toEqual({ ok: false, reason: 'notAbsolute' })
    expect(await add('c1', '')).toEqual({ ok: false, reason: 'empty' })
    expect(await add('c1', 'x'.repeat(100_000))).toEqual({ ok: false, reason: 'tooLong' })
    expect(manager.record.additionalDirectories).toBeUndefined()
    expect(manager.restart).not.toHaveBeenCalled()
  })

  it('arguments venus du renderer : identifiant et chemin vérifiés', async () => {
    const { dialog, add } = setup(library)
    await expect(add('', library)).rejects.toThrow(/id/)
    await expect(add('c1', 42)).rejects.toThrow(/path/)
    await expect(add('c1', null)).rejects.toThrow(/path/)
    expect(dialog).not.toHaveBeenCalled()
  })

  it('pendant une réponse : `busy`, aucune promesse rejetée, rien ne change', async () => {
    const { manager, add } = setup(null, 'busy')
    expect(await add('c1', library)).toEqual({ ok: false, reason: 'busy' })
    expect(manager.record.additionalDirectories).toBeUndefined()
  })

  it('trop large et sous-dossier du dossier de travail : refusés aussi par la fenêtre native', async () => {
    const broad = setup('~')
    expect(await broad.add('c1')).toMatchObject({ ok: false, reason: 'tooBroad' })
    const inside = setup(join(root, 'vers-app', 'src'))
    expect(await inside.add('c1')).toMatchObject({ ok: false, reason: 'insideWorkspace' })
    expect(inside.manager.restart).not.toHaveBeenCalled()
  })

  it('`file://` d’un dossier : accepté comme le chemin', async () => {
    const { add } = setup(null)
    expect(await add('c1', pathToFileURL(join(root, 'lib')).href)).toEqual({
      ok: true,
      folder: library
    })
  })
})
