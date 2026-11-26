import { describe, expect, it, vi } from 'vitest'
import type { AgentStatus } from '@shared/agent'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path, { join } from 'node:path'
import {
  addAdditionalDirectory,
  extraFolderStart,
  extraFolderStartOf,
  readableDirectory,
  removeAdditionalDirectory
} from './additional-directories'
import type { FolderSystem } from './extra-folder-check'
import type { ConversationRecord } from './store'
import { abs } from '../test-platform'

function fakeManager(
  status: AgentStatus | undefined,
  folders?: string[],
  workspace = '/projets/app'
) {
  const record = {
    id: 'c1',
    workspace: abs(workspace),
    ...(folders ? { additionalDirectories: folders } : {})
  } as ConversationRecord
  const manager = {
    record,
    status,
    /** Écritures réelles (`change` qui ne rend pas `false`). */
    writes: 0,
    restart: vi.fn(async () => {}),
    updateRecord: vi.fn(
      (_id: string, change: (r: ConversationRecord, s: AgentStatus | undefined) => unknown) => {
        if (change(record, manager.status) !== false) manager.writes++
        return manager.status
      }
    )
  }
  return manager
}

/**
 * Disque simulé : tout chemin absolu est un dossier lisible, sauf ceux de `absent` ; `links` :
 * chemin → dossier réel. `gate` : la lecture attend ce signal (course entre deux ajouts).
 */
function disk(
  links: Record<string, string> = {},
  absent: string[] = [],
  gate?: Promise<void>
): FolderSystem {
  return {
    path,
    home: abs('/Users/moi'),
    timeoutMs: 1000,
    realpath: async (p) => {
      await gate
      if (absent.includes(p)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      return links[p] ?? path.resolve(p)
    },
    isDirectory: async () => true,
    access: async () => 'ok'
  }
}

describe('autres dossiers d’une conversation (fiches 179, 290)', () => {
  it('ajout : mémorisé ; doublon, dossier de travail, sous-dossier refusés ; agent prêt : session rouverte', async () => {
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
    expect(await addAdditionalDirectory(m, 'c1', abs('/projets/app/src'), sys)).toEqual({
      ok: false,
      reason: 'insideWorkspace',
      folder: abs('/projets/app/src')
    })
    // Un parent du dossier de travail reste accepté.
    expect(await addAdditionalDirectory(m, 'c1', abs('/projets'), sys)).toMatchObject({ ok: true })
    expect(m.record.additionalDirectories).toEqual([
      abs('/projets/lib'),
      abs('/projets/serveur'),
      abs('/projets')
    ])
    expect(m.writes).toBe(2)
    expect(m.restart).toHaveBeenCalledTimes(2)
  })

  it('sans agent vivant : seulement mémorisé (envoyé au prochain démarrage)', async () => {
    const m = fakeManager(undefined)
    await addAdditionalDirectory(m, 'c1', abs('/projets/lib'), disk())
    expect(m.record.additionalDirectories).toEqual([abs('/projets/lib')])
    expect(m.restart).not.toHaveBeenCalled()
  })

  it('chemin refusé (relatif, absent) : rien d’écrit, aucune session rouverte', async () => {
    const m = fakeManager('ready', [abs('/projets/lib')])
    expect(await addAdditionalDirectory(m, 'c1', 'serveur', disk())).toEqual({
      ok: false,
      reason: 'notAbsolute'
    })
    const gone = abs('/projets/parti')
    expect(await addAdditionalDirectory(m, 'c1', gone, disk({}, [gone]))).toMatchObject({
      reason: 'notFound'
    })
    expect(m.writes).toBe(0)
    expect(m.restart).not.toHaveBeenCalled()
  })

  it('dossier de travail sous un lien, enregistré par son chemin non résolu : lui et ses sous-dossiers refusés', async () => {
    // La conversation a été ouverte sur `/liens/app`, lien vers `/projets/app`.
    const m = fakeManager('ready', [], '/liens/app')
    const sys = disk({ [abs('/liens/app')]: abs('/projets/app') })
    expect(await addAdditionalDirectory(m, 'c1', abs('/projets/app'), sys)).toMatchObject({
      reason: 'isWorkspace'
    })
    expect(await addAdditionalDirectory(m, 'c1', abs('/projets/app/src'), sys)).toMatchObject({
      reason: 'insideWorkspace'
    })
    expect(m.writes).toBe(0)
  })

  it('un lien vers un dossier déjà là (enregistré avant, non résolu) : refusé', async () => {
    const m = fakeManager('ready', [abs('/raccourcis/lib')])
    const sys = disk({ [abs('/raccourcis/lib')]: abs('/projets/lib') })
    expect(await addAdditionalDirectory(m, 'c1', abs('/projets/lib'), sys)).toMatchObject({
      reason: 'alreadyAdded'
    })
    expect(m.restart).not.toHaveBeenCalled()
  })

  it('`~/…` développé, le dossier réel retenu', async () => {
    const m = fakeManager(undefined)
    const sys = disk({ [abs('/Users/moi/Dev/lien')]: abs('/Volumes/donnees/lib') })
    expect(await addAdditionalDirectory(m, 'c1', '~/Dev/lien', sys)).toEqual({
      ok: true,
      folder: abs('/Volumes/donnees/lib')
    })
    expect(m.record.additionalDirectories).toEqual([abs('/Volumes/donnees/lib')])
  })

  it('deux ajouts concurrents du même dossier : un seul passe', async () => {
    const m = fakeManager('ready')
    let open: () => void = () => {}
    const gate = new Promise<void>((done) => (open = done))
    const sys = disk({}, [], gate)
    const first = addAdditionalDirectory(m, 'c1', abs('/projets/lib'), sys)
    const second = addAdditionalDirectory(m, 'c1', abs('/projets/lib/'), sys)
    open()
    const results = await Promise.all([first, second])
    expect(results.map((r) => (r.ok ? 'ok' : r.reason)).sort()).toEqual(['alreadyAdded', 'ok'])
    expect(m.record.additionalDirectories).toEqual([abs('/projets/lib')])
    expect(m.restart).toHaveBeenCalledTimes(1)
  })

  it('pendant une réponse : `busy`, sans lire le disque ni rien écrire', async () => {
    const m = fakeManager('busy', [abs('/projets/lib')])
    const sys = disk()
    const read = vi.spyOn(sys, 'realpath')
    expect(await addAdditionalDirectory(m, 'c1', abs('/projets/serveur'), sys)).toEqual({
      ok: false,
      reason: 'busy'
    })
    expect(read).not.toHaveBeenCalled()
    expect(m.record.additionalDirectories).toEqual([abs('/projets/lib')])
    expect(m.writes).toBe(0)
  })

  it('un tour commence pendant la vérification : `busy`, rien d’écrit', async () => {
    const m = fakeManager('ready')
    let open: () => void = () => {}
    const gate = new Promise<void>((done) => (open = done))
    const pending = addAdditionalDirectory(m, 'c1', abs('/projets/lib'), disk({}, [], gate))
    m.status = 'busy'
    open()
    expect(await pending).toEqual({ ok: false, reason: 'busy' })
    expect(m.record.additionalDirectories).toBeUndefined()
    expect(m.restart).not.toHaveBeenCalled()
  })

  it('retrait : même comparaison que l’ajout (lien, séparateur final) ; le dernier efface le champ', async () => {
    const m = fakeManager('ready', [abs('/projets/lib'), abs('/raccourcis/serveur')])
    const sys = disk({ [abs('/raccourcis/serveur')]: abs('/projets/serveur') })
    await removeAdditionalDirectory(m, 'c1', abs('/projets/serveur'), sys)
    expect(m.record.additionalDirectories).toEqual([abs('/projets/lib')])
    await removeAdditionalDirectory(m, 'c1', `${abs('/projets/lib')}/`, sys)
    expect('additionalDirectories' in m.record).toBe(false)
    expect(m.restart).toHaveBeenCalledTimes(2)
    // Rien à retirer : rien d'écrit, pas de session rouverte.
    await removeAdditionalDirectory(m, 'c1', abs('/projets/autre'), sys)
    expect(m.restart).toHaveBeenCalledTimes(2)
  })

  it('retrait pendant une réponse : refusé, rien ne change', async () => {
    const m = fakeManager('busy', [abs('/projets/lib')])
    await expect(removeAdditionalDirectory(m, 'c1', abs('/projets/lib'), disk())).rejects.toThrow()
    expect(m.record.additionalDirectories).toEqual([abs('/projets/lib')])
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
