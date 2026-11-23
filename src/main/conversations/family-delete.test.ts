/**
 * Supprimer ou archiver une mère (fiche 228), contre l'agent factice : ses filles suivent, ou
 * deviennent ordinaires ; aucun envoi vers une conversation partie ne lève.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { t } from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentProfile } from '../agent/profiles'
import { Worktrees } from '../changes/worktrees'
import { gitCommand, queuedGit } from '../git/git-queue'
import { ChildConversations } from './children'
import { deleteConversation, familyOf } from './family-delete'
import { ConversationManager } from './manager'
import { until } from './manager-until'
import type { ConversationRecord } from './store'

function environment(dirs?: { root: string; repo: string }) {
  const root = dirs?.root ?? mkdtempSync(join(tmpdir(), 'famille-'))
  const repo = dirs?.repo ?? realpathSync(mkdtempSync(join(tmpdir(), 'famille-depot-')))
  if (!dirs) {
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
        cwd: repo
      })
    writeFileSync(join(repo, 'README.md'), '# Carnet\n')
    git('init', '-q', '-b', 'main')
    git('add', '.')
    git('commit', '-q', '-m', 'init')
  }
  const mock = (id: string, scenario: string, delay = '0'): AgentProfile => ({
    id,
    label: `Factice ${id}`,
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', scenario, '--delay', delay, '--store', join(root, 's')],
    env: {}
  })
  const holder: { children?: ChildConversations } = {}
  const manager = new ConversationManager({
    profiles: [
      mock('echo', 'echo'),
      // Commence à répondre puis attend Stop : une fille « au travail ».
      mock('stop', 'attend-stop', '5'),
      { ...mock('absent', 'echo'), command: join(root, 'pas-d-agent') }
    ],
    keepLive: (id) => holder.children?.keepLive(id) ?? false,
    settingsFile: join(root, 'settings.json'),
    conversationsDir: join(root, 'conversations'),
    defaultWorkspace: repo,
    neutralFolder: repo,
    pathEnv: () => process.env['PATH'],
    worktrees: new Worktrees(queuedGit(gitCommand)),
    agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
  })
  const module = new ChildConversations(manager)
  holder.children = module
  manager.subscribe({
    event: (payload) => module.onEvent(payload),
    list: () => module.listChanged(),
    deleted: (id) => module.forget(id)
  })
  const waitFor = (predicate: () => boolean) =>
    until(manager, predicate, predicate.toString(), 10_000)
  const items = (id: string) => manager.view(id).transcript.items
  const listed = (id: string) => manager.state().conversations.find((c) => c.id === id)
  const mother = async () => {
    const id = manager.state().activeId
    await manager.startActive()
    await manager.prompt(id, 'Organise le carnet')
    return id
  }
  /** Une fille dont le premier tour est fini. */
  const child = async (motherId: string, text: string, profileId = 'echo') => {
    const created = await module.start(motherId, { text, profileId })
    if (profileId === 'echo') {
      await waitFor(() => items(created.id).some((i) => i.kind === 'agent'))
      await waitFor(() => listed(created.id)?.status === 'ready')
    } else {
      await waitFor(() => listed(created.id)?.status === 'busy')
    }
    return created.id
  }
  const index = () =>
    JSON.parse(
      readFileSync(join(root, 'conversations', 'index.json'), 'utf8')
    ) as ConversationRecord[]
  return { root, repo, manager, children: module, waitFor, items, listed, mother, child, index }
}

const notices = (items: TranscriptItem[]) =>
  items.filter((i): i is Extract<TranscriptItem, { kind: 'notice' }> => i.kind === 'notice')

describe('supprimer une mère (fiche 228)', () => {
  it('« Supprimer aussi ses filles » : descendance arrêtée proprement puis supprimée', async () => {
    const env = environment()
    const mother = await env.mother()
    const quiet = await env.child(mother, 'Importer les données')
    const busy = await env.child(mother, 'Travail long', 'stop')
    // Une petite-fille, sous la première fille.
    const grandchild = (await env.manager.createChild(quiet, 'Sous-tâche')).id
    expect(familyOf(env.manager, mother)).toEqual([
      expect.objectContaining({ id: grandchild, title: 'Sous-tâche', motherId: quiet }),
      expect.objectContaining({ id: quiet, title: 'Importer les données', motherId: mother }),
      expect.objectContaining({
        id: busy,
        motherId: mother,
        busy: true,
        profileLabel: 'Factice stop'
      })
    ])
    const cancel = vi.spyOn(env.manager, 'cancel')
    await deleteConversation(env.manager, mother, { children: 'delete', fromAgent: false })
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledWith(busy)
    const left = env.manager.state().conversations.map((c) => c.id)
    for (const id of [mother, quiet, busy, grandchild]) expect(left).not.toContain(id)
    await env.manager.settled()
    env.manager.stopAll()
  })

  it('filles gardées : lien coupé, note dans leur fil, petite-fille sous sa mère survivante', async () => {
    const env = environment()
    const mother = await env.mother()
    const motherTitle = env.listed(mother)?.title ?? ''
    const kept = await env.child(mother, 'Importer les données')
    const grandchild = (await env.manager.createChild(kept, 'Sous-tâche')).id
    await deleteConversation(env.manager, mother, { fromAgent: false })
    expect(env.listed(mother)).toBeUndefined()
    expect(env.listed(kept)?.startedFrom).toBeUndefined()
    expect(env.listed(grandchild)?.startedFrom?.id).toBe(kept)
    expect(notices(env.items(kept)).at(-1)?.message).toEqual({
      key: 'children.notice.motherDeleted',
      params: { title: motherTitle }
    })
    await env.manager.settled()
    // Le lien est coupé dans l'enregistrement, pas seulement masqué.
    expect(env.index().find((r) => r.id === kept)?.startedFrom).toBeUndefined()
    // Un tour de plus : son compte rendu reste dans son propre fil, rien ne lève.
    await env.manager.prompt(kept, 'Encore')
    expect(env.items(kept).filter((i) => i.kind === 'child-report')).toEqual([])
    env.manager.stopAll()
  })

  it('lien mort d’une version précédente : réparé au chargement', async () => {
    const env = environment()
    const mother = await env.mother()
    const orphan = await env.child(mother, 'Importer les données')
    // Ancienne suppression : la mère seule, le lien de la fille laissé tel quel.
    await env.manager.delete(mother, { fromAgent: false })
    await env.manager.settled()
    env.manager.stopAll()
    expect(env.index().find((r) => r.id === orphan)?.startedFrom?.id).toBe(mother)
    const next = environment({ root: env.root, repo: env.repo })
    await next.manager.settled()
    expect(next.index().find((r) => r.id === orphan)?.startedFrom).toBeUndefined()
    expect(next.listed(orphan)?.startedFrom).toBeUndefined()
    next.manager.stopAll()
  })

  it('envoi vers une conversation partie : écarté sans lever', async () => {
    const env = environment()
    expect(env.manager.post('partie', { type: 'notice', level: 'info', message: 'x' })).toBe(false)
    const mother = await env.mother()
    // Mère supprimée pendant la préparation de la fille : la fille continue seule.
    const create = env.manager.createChild.bind(env.manager)
    let release = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    vi.spyOn(env.manager, 'createChild').mockImplementationOnce(async (...args) => {
      const created = await create(...args)
      await gate
      return created
    })
    const started = env.children.start(mother, { text: 'Importer', profileId: 'echo' })
    await env.waitFor(() => env.manager.state().conversations.some((c) => c.startedFrom))
    await env.manager.delete(mother, { fromAgent: false })
    release()
    const child = await started
    expect(env.listed(child.id)?.startedFrom).toBeUndefined()
    expect(notices(env.items(child.id)).map((n) => n.message)).toContainEqual(
      expect.objectContaining({ key: 'children.notice.motherDeleted' })
    )
    await env.waitFor(() => env.listed(child.id)?.status === 'ready')
    await env.manager.settled()
    env.manager.stopAll()
  })

  it('consigne qui ne part pas, mère supprimée entre-temps : pas de compte rendu perdu en exception', async () => {
    const env = environment()
    const mother = await env.mother()
    const prompt = env.manager.prompt.bind(env.manager)
    let release = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    vi.spyOn(env.manager, 'prompt').mockImplementation(async (id, ...rest) => {
      if (id !== mother) await gate
      return prompt(id, ...rest)
    })
    const child = await env.children.start(mother, { text: 'Importer', profileId: 'absent' })
    await env.manager.delete(mother, { fromAgent: false })
    release()
    await env.waitFor(() =>
      notices(env.items(child.id)).some(
        (n) => typeof n.message === 'object' && n.message.key === 'children.notice.promptFailed'
      )
    )
    await env.manager.settled()
    env.manager.stopAll()
  })
})

describe('mère supprimée avec ses filles juste après « Tout lancer » (chasse rc.4)', () => {
  it('la consigne de la fille, partie avec elle, n’écrit rien dans un fil supprimé', async () => {
    const env = environment()
    const mother = await env.mother()
    const prompt = env.manager.prompt.bind(env.manager)
    let release = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    // Consigne de la fille : le tour que `launch` attend, suivi ici jusqu'à son échec.
    const turns: Promise<unknown>[] = []
    vi.spyOn(env.manager, 'prompt').mockImplementation((id, ...rest) => {
      if (id === mother) return prompt(id, ...rest)
      const turn = gate.then(() => prompt(id, ...rest))
      turns.push(turn)
      return turn
    })
    const post = vi.spyOn(env.manager, 'post')
    const child = await env.children.start(mother, { text: 'Importer', profileId: 'echo' })
    await deleteConversation(env.manager, mother, { children: 'delete', fromAgent: false })
    expect(env.listed(child.id)).toBeUndefined()
    release()
    // La consigne échoue (fille partie) ; `launch`, abonné avant, a fini son `catch` ensuite.
    await env.waitFor(() => turns.length > 0)
    await Promise.allSettled(turns)
    await env.manager.settled()
    // Avant : « children.notice.promptFailed » posé dans le fil de la fille supprimée, écarté au
    // journal (« Évènement « notice » écarté : conversation … inconnue »).
    const lost = post.mock.results.filter((r) => r.type === 'return' && r.value === false)
    expect(lost).toEqual([])
    env.manager.stopAll()
  })
})

describe('confirmation : qui est « en cours » (fiches 228, 250)', () => {
  it('comme la barre latérale : une fille qui démarre l’est aussi, pas celle qui attend ou a fini', () => {
    const statuses = {
      a: 'busy',
      b: 'starting',
      c: 'ready',
      d: 'needs-action',
      e: 'stopped'
    } as const
    const host = {
      family: () =>
        Object.keys(statuses).map((id) => ({ id, title: id.toUpperCase(), motherId: 'm' })),
      state: () => ({
        conversations: Object.entries(statuses).map(([id, status]) => ({ id, status }))
      })
    } as unknown as Parameters<typeof familyOf>[0]
    expect(
      familyOf(host, 'm')
        .filter((m) => m.busy)
        .map((m) => m.id)
    ).toEqual(['a', 'b'])
  })
})

describe('archiver une mère (fiche 228)', () => {
  it('ses filles suivent, et ressortent avec elle ; une fille déjà archivée reste aux archives', async () => {
    const env = environment()
    const mother = await env.mother()
    const first = await env.child(mother, 'Importer les données')
    const merged = await env.child(mother, 'Déjà fusionnée')
    env.manager.setArchived(merged, true)
    env.manager.setArchived(mother, true)
    expect(env.listed(mother)?.archived).toBe(true)
    expect(env.listed(first)?.archived).toBe(true)
    env.manager.setArchived(mother, false)
    expect(env.listed(mother)?.archived).toBeFalsy()
    expect(env.listed(first)?.archived).toBeFalsy()
    expect(env.listed(first)?.startedFrom?.id).toBe(mother)
    expect(env.listed(merged)?.archived).toBe(true)
    await env.manager.settled()
    expect(env.index().some((r) => r.archivedWith)).toBe(false)
    env.manager.stopAll()
  })

  it('refusé sans rien changer quand une fille travaille', async () => {
    const env = environment()
    const mother = await env.mother()
    const quiet = await env.child(mother, 'Importer les données')
    await env.child(mother, 'Travail long', 'stop')
    expect(() => env.manager.setArchived(mother, true)).toThrow(
      t('conversations.error.busyArchiveChild', { title: 'Travail long' })
    )
    expect(env.listed(mother)?.archived).toBeFalsy()
    expect(env.listed(quiet)?.archived).toBeFalsy()
    env.manager.stopAll()
  })
})

describe('« Supprimer aussi chez… » d’une famille (fiche 228)', () => {
  it('chaque conversation chez son propre agent, seulement s’il sait supprimer une session', async () => {
    const summary = (id: string, agentDeletes: boolean) => ({
      id,
      title: id,
      profileLabel: id,
      status: 'ready',
      ...(agentDeletes ? { agentDeletes } : {})
    })
    const deleted: [string, unknown][] = []
    const host = {
      state: () => ({
        activeId: 'm',
        conversations: [summary('m', false), summary('f1', true), summary('f2', false)]
      }),
      family: () => [
        { id: 'f1', title: 'f1', motherId: 'm' },
        { id: 'f2', title: 'f2', motherId: 'm' }
      ],
      delete: vi.fn(async (id: string, options: unknown) => {
        deleted.push([id, options])
        return host.state()
      }),
      cancel: vi.fn(async () => {}),
      post: vi.fn(() => true),
      updateRecord: vi.fn()
    }
    await deleteConversation(host as never, 'm', { children: 'delete', fromAgent: true })
    expect(deleted).toEqual([
      ['f1', { fromAgent: true, removeWorktree: false }],
      ['f2', { fromAgent: false, removeWorktree: false }],
      ['m', { fromAgent: false }]
    ])
  })
})
