import { describe, expect, it, vi } from 'vitest'
import type { AgentStatus } from '@shared/agent'
import {
  addAdditionalDirectory,
  normalize,
  removeAdditionalDirectory
} from './additional-directories'
import type { ConversationRecord } from './store'

function fakeManager(status: AgentStatus | undefined, folders?: string[]) {
  const record = {
    id: 'c1',
    workspace: '/projets/app',
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
    const m = fakeManager('ready', ['/projets/lib'])
    await addAdditionalDirectory(m, 'c1', '/projets/serveur/')
    await addAdditionalDirectory(m, 'c1', '/projets/lib')
    await addAdditionalDirectory(m, 'c1', '/projets/app')
    expect(m.record.additionalDirectories).toEqual(['/projets/lib', '/projets/serveur'])
    // Doublon et dossier de travail : rien de changé, la session n'est pas rouverte.
    expect(m.restart).toHaveBeenCalledTimes(1)
  })

  it('sans agent vivant : seulement mémorisé (envoyé au prochain démarrage)', async () => {
    const m = fakeManager(undefined)
    await addAdditionalDirectory(m, 'c1', '/projets/lib')
    expect(m.record.additionalDirectories).toEqual(['/projets/lib'])
    expect(m.restart).not.toHaveBeenCalled()
  })

  it('retrait du dernier : le champ disparaît', async () => {
    const m = fakeManager('exited', ['/projets/lib'])
    await removeAdditionalDirectory(m, 'c1', '/projets/lib')
    expect('additionalDirectories' in m.record).toBe(false)
  })

  it('pendant une réponse : refusé, rien ne change', async () => {
    const m = fakeManager('busy', ['/projets/lib'])
    await expect(addAdditionalDirectory(m, 'c1', '/projets/serveur')).rejects.toThrow()
    expect(m.record.additionalDirectories).toEqual(['/projets/lib'])
    expect(m.restart).not.toHaveBeenCalled()
  })

  it('normalize : chemins absolus seulement, normalisés, dans l’ordre', () => {
    expect(normalize(['relatif', '/a/b/../c', '/a/c', '/d'])).toEqual(['/a/c', '/d'])
  })
})
