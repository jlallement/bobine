import { describe, expect, it, vi } from 'vitest'
import type { AgentStatus } from '@shared/agent'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path, { join } from 'node:path'
import {
  addAdditionalDirectory,
  extraFolderStart,
  extraFolderStartOf,
  normalize,
  readableDirectory,
  removeAdditionalDirectory
} from './additional-directories'
import type { FolderSystem } from './extra-folder-check'
import type { ConversationRecord } from './store'
import { abs } from '../test-platform'

function fakeManager(status: AgentStatus | undefined, folders?: string[]) {
  const record = {
    id: 'c1',
    workspace: abs('/projets/app'),
    ...(folders ? { additionalDirectories: folders } : {})
  } as ConversationRecord
  const manager = {
    record,
    restart: vi.fn(async () => {}),
    updateRecord: vi.fn(
      (_id: string, change: (r: ConversationRecord, s: AgentStatus | undefined) => void) => {
        change(record, status)
        return status
      }
    )
  }
  return manager
}

/**
 * Disque simulé pour les ajouts : tout chemin absolu est un dossier lisible, sauf ceux de
 * `absent` ; `links` : chemin → dossier réel.
 */
function disk(links: Record<string, string> = {}, absent: string[] = []): FolderSystem {
  return {
    path,
    home: abs('/Users/moi'),
    realpath: (p) => {
      if (absent.includes(p)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      return links[p] ?? path.resolve(p)
    },
    isDirectory: () => true,
    readable: () => true
  }
}

describe('autres dossiers d’une conversation (fiche 179)', () => {
  it('ajout : mémorisé, sans doublon ni le dossier de travail ; agent prêt : session rouverte', async () => {
    const m = fakeManager('ready', [abs('/projets/lib')])
    const sys = disk()
    expect(await addAdditionalDirectory(m, 'c1', abs('/projets/serveur/'), sys)).toEqual({
      ok: true,
      folder: abs('/projets/serveur')
    })
    expect(await addAdditionalDirectory(m, 'c1', abs('/projets/lib'), sys)).toEqual({
      ok: false,
      reason: 'alreadyAdded',
      folder: abs('/projets/lib')
    })
    expect(await addAdditionalDirectory(m, 'c1', abs('/projets/app'), sys)).toEqual({
      ok: false,
      reason: 'isWorkspace',
      folder: abs('/projets/app')
    })
    expect(m.record.additionalDirectories).toEqual([abs('/projets/lib'), abs('/projets/serveur')])
    // Doublon et dossier de travail : rien de changé, la session n'est pas rouverte.
    expect(m.restart).toHaveBeenCalledTimes(1)
  })

  it('sans agent vivant : seulement mémorisé (envoyé au prochain démarrage)', async () => {
    const m = fakeManager(undefined)
    await addAdditionalDirectory(m, 'c1', abs('/projets/lib'), disk())
    expect(m.record.additionalDirectories).toEqual([abs('/projets/lib')])
    expect(m.restart).not.toHaveBeenCalled()
  })

  it('fiche 290 : chemin refusé (relatif, absent) : rien ne change, aucune session rouverte', async () => {
    const m = fakeManager('ready', [abs('/projets/lib')])
    expect(await addAdditionalDirectory(m, 'c1', 'serveur', disk())).toEqual({
      ok: false,
      reason: 'notAbsolute'
    })
    const gone = abs('/projets/parti')
    expect(await addAdditionalDirectory(m, 'c1', gone, disk({}, [gone]))).toMatchObject({
      ok: false,
      reason: 'notFound'
    })
    expect(m.updateRecord).not.toHaveBeenCalled()
    expect(m.restart).not.toHaveBeenCalled()
  })

  it('fiche 290 : un lien vers le dossier de travail ou vers un dossier déjà là : refusé', async () => {
    const m = fakeManager('ready', [abs('/projets/lib')])
    const sys = disk({
      [abs('/raccourcis/app')]: abs('/projets/app'),
      [abs('/raccourcis/lib')]: abs('/projets/lib')
    })
    expect(await addAdditionalDirectory(m, 'c1', abs('/raccourcis/app'), sys)).toMatchObject({
      reason: 'isWorkspace'
    })
    expect(await addAdditionalDirectory(m, 'c1', abs('/raccourcis/lib'), sys)).toMatchObject({
      reason: 'alreadyAdded'
    })
    expect(m.record.additionalDirectories).toEqual([abs('/projets/lib')])
    expect(m.restart).not.toHaveBeenCalled()
  })

  it('fiche 290 : `~/…` développé, le dossier réel retenu', async () => {
    const m = fakeManager(undefined)
    const sys = disk({ [abs('/Users/moi/Dev/lien')]: abs('/Volumes/donnees/lib') })
    expect(await addAdditionalDirectory(m, 'c1', '~/Dev/lien', sys)).toEqual({
      ok: true,
      folder: abs('/Volumes/donnees/lib')
    })
    expect(m.record.additionalDirectories).toEqual([abs('/Volumes/donnees/lib')])
  })

  it('retrait du dernier : le champ disparaît', async () => {
    const m = fakeManager('exited', [abs('/projets/lib')])
    await removeAdditionalDirectory(m, 'c1', abs('/projets/lib'))
    expect('additionalDirectories' in m.record).toBe(false)
  })

  it('pendant une réponse : refusé, rien ne change', async () => {
    const m = fakeManager('busy', [abs('/projets/lib')])
    await expect(addAdditionalDirectory(m, 'c1', abs('/projets/serveur'), disk())).rejects.toThrow()
    expect(m.record.additionalDirectories).toEqual([abs('/projets/lib')])
    expect(m.restart).not.toHaveBeenCalled()
  })

  it('normalize : chemins absolus seulement, normalisés, dans l’ordre', () => {
    expect(normalize(['relatif', '/a/b/../c', abs('/a/c'), abs('/d')])).toEqual([
      abs('/a/c'),
      abs('/d')
    ])
  })
})

describe('« Ajouter un dossier… » ouvert à côté du dossier (fiche 287)', () => {
  const all = () => true
  it('le parent du dossier de la conversation ; pour un worktree, celui de son dossier dans le dépôt', () => {
    expect(extraFolderStart({ workspace: abs('/Users/moi/Dev/bricole') }, all)).toBe(
      abs('/Users/moi/Dev')
    )
    expect(extraFolderStart({ workspace: abs('/Users/moi/Dev/bricole/app') }, all)).toBe(
      abs('/Users/moi/Dev/bricole')
    )
    expect(
      extraFolderStart(
        {
          workspace: abs('/donnees/worktrees/x/app'),
          worktree: { root: abs('/Users/moi/Dev/bricole'), path: abs('/donnees/worktrees/x') }
        },
        all
      )
    ).toBe(abs('/Users/moi/Dev/bricole'))
    // Worktree partagé (pas le sien seul) : la racine du dépôt fait foi.
    expect(
      extraFolderStart(
        {
          workspace: abs('/donnees/worktrees/x'),
          branch: 'bobine/x',
          project: abs('/Users/moi/Dev/bricole')
        },
        all
      )
    ).toBe(abs('/Users/moi/Dev'))
  })

  it('rien d’imposé : discussion, sans dossier, racine, parent absent ou illisible', () => {
    expect(extraFolderStart({ workspace: abs('/x/y'), space: 'discussion' }, all)).toBeUndefined()
    expect(extraFolderStart({ workspace: '' }, all)).toBeUndefined()
    expect(extraFolderStart({ workspace: abs('/') }, all)).toBeUndefined()
    expect(extraFolderStart({ workspace: abs('/x/y') }, () => false)).toBeUndefined()
  })

  it('lecture réelle : un dossier lisible oui, un dossier absent non', () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'bob-start-')))
    try {
      expect(readableDirectory(dir)).toBe(true)
      expect(readableDirectory(join(dir, 'absent'))).toBe(false)
      const manager = {
        state: () => ({ conversations: [{ id: 'c1', workspace: join(dir, 'projet') }] }),
        worktreeOf: () => null
      } as unknown as Parameters<typeof extraFolderStartOf>[0]
      expect(extraFolderStartOf(manager, 'c1')).toBe(dir)
      expect(extraFolderStartOf(manager, 'inconnue')).toBeUndefined()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
