import { describe, expect, it, vi } from 'vitest'
import type { AgentStatus } from '@shared/agent'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  addAdditionalDirectory,
  extraFolderStart,
  extraFolderStartOf,
  normalize,
  readableDirectory,
  removeAdditionalDirectory
} from './additional-directories'
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

describe('autres dossiers d’une conversation (fiche 179)', () => {
  it('ajout : mémorisé, sans doublon ni le dossier de travail ; agent prêt : session rouverte', async () => {
    const m = fakeManager('ready', [abs('/projets/lib')])
    await addAdditionalDirectory(m, 'c1', '/projets/serveur/')
    await addAdditionalDirectory(m, 'c1', abs('/projets/lib'))
    await addAdditionalDirectory(m, 'c1', abs('/projets/app'))
    expect(m.record.additionalDirectories).toEqual([abs('/projets/lib'), abs('/projets/serveur')])
    // Doublon et dossier de travail : rien de changé, la session n'est pas rouverte.
    expect(m.restart).toHaveBeenCalledTimes(1)
  })

  it('sans agent vivant : seulement mémorisé (envoyé au prochain démarrage)', async () => {
    const m = fakeManager(undefined)
    await addAdditionalDirectory(m, 'c1', abs('/projets/lib'))
    expect(m.record.additionalDirectories).toEqual([abs('/projets/lib')])
    expect(m.restart).not.toHaveBeenCalled()
  })

  it('retrait du dernier : le champ disparaît', async () => {
    const m = fakeManager('exited', [abs('/projets/lib')])
    await removeAdditionalDirectory(m, 'c1', abs('/projets/lib'))
    expect('additionalDirectories' in m.record).toBe(false)
  })

  it('pendant une réponse : refusé, rien ne change', async () => {
    const m = fakeManager('busy', [abs('/projets/lib')])
    await expect(addAdditionalDirectory(m, 'c1', abs('/projets/serveur'))).rejects.toThrow()
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
