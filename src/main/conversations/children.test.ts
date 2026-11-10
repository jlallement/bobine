import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { t } from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import { WAKE_TEXT, type ChildLaunchState } from '@shared/children'
import type { TranscriptItem } from '@shared/transcript'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentProfile } from '../agent/profiles'
import { Worktrees } from '../changes/worktrees'
import { gitCommand, queuedGit } from '../git/git-queue'
import { AppToolServer } from '../mcp/tool-server'
import { childrenToolsModule } from '../mcp/children-tools'
import { ChildConversations, childHandlers, type ChildOptions } from './children'
import { ConversationManager } from './manager'

function waitFor(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const check = () => {
      if (predicate()) return resolve()
      if (Date.now() - started > timeoutMs) return reject(new Error('waitFor : délai dépassé'))
      setTimeout(check, 10)
    }
    check()
  })
}

/**
 * Un dépôt git jetable, un gestionnaire sur l'agent factice, et le module des filles branché.
 * `toolServer` : les outils des filles sont aussi fournis aux agents (étape 2).
 */
function environment(toolServer?: AppToolServer, maxLive?: number, options: ChildOptions = {}) {
  const root = mkdtempSync(join(tmpdir(), 'filles-'))
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'filles-depot-')))
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
      cwd: repo,
      encoding: 'utf8'
    }).trim()
  // Ce que modifie le scénario `modifications`.
  writeFileSync(join(repo, 'README.md'), '# Carnet\n\nVersion 1\n\n## Utilisation\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  const mock = (id: string, scenario: string): AgentProfile => ({
    id,
    label: `Factice ${id}`,
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', scenario, '--delay', '0', '--store', join(root, 's')],
    env: {},
    // Modèle de fille suggéré puis confirmé, comme le profil de l'agent factice (fiche 160).
    childModelChoice: 'ask'
  })
  // Profil sans choix du modèle d'une fille, comme Bob (fiche 160).
  const { childModelChoice: _bobLike, ...withoutModel } = mock('sans-modele', 'filles-modele')
  let children: ChildConversations | undefined = undefined
  const manager = new ConversationManager({
    profiles: [
      mock('echo', 'echo'),
      mock('modifs', 'modifications'),
      mock('erreur', 'erreur'),
      mock('attente', 'permission'),
      // Mères tech lead (fiche 160) : leurs réveils jouent aussi le scénario.
      mock('lead', 'filles-tech-lead'),
      mock('bavarde', 'filles-bavarde'),
      // Modèle de fille suggéré : permis (comme OpenCode), ou non (comme Bob).
      mock('modele', 'filles-modele'),
      withoutModel,
      // Agent introuvable : il ne démarre pas.
      { ...mock('absent', 'echo'), command: join(root, 'pas-d-agent') }
    ],
    ...(toolServer ? { toolServer, toolModules: [childrenToolsModule(() => children)] } : {}),
    keepLive: (id) => children?.keepLive(id) ?? false,
    ...(maxLive ? { maxLive } : {}),
    settingsFile: join(root, 'settings.json'),
    conversationsDir: join(root, 'conversations'),
    defaultWorkspace: repo,
    neutralFolder: repo,
    pathEnv: () => process.env['PATH'],
    worktrees: new Worktrees(queuedGit(gitCommand)),
    agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
  })
  const module = new ChildConversations(manager, options)
  children = module
  manager.subscribe({
    event: (payload) => module.onEvent(payload),
    list: () => module.listChanged(),
    deleted: (id) => module.forget(id)
  })
  const items = (id: string) => manager.view(id).transcript.items
  const lastReply = (id: string) =>
    items(id).findLast((i): i is Extract<TranscriptItem, { kind: 'agent' }> => i.kind === 'agent')
      ?.text ?? ''
  /** Une mère dans l'historique : la conversation de départ, après un premier échange. */
  const mother = async () => {
    const id = manager.state().activeId
    await manager.startActive()
    await manager.prompt(id, 'Organise le carnet')
    return id
  }
  /** Réveils groupés reçus par une conversation. */
  const wakes = (id: string) =>
    items(id).filter((i) => i.kind === 'user' && i.from?.kind === 'wake').length
  return { repo, git, manager, children: module, items, lastReply, mother, wakes }
}

describe('conversations filles (fiche 097)', () => {
  it('préparation visible avant le worktree, plafond réservé, remplacement avant la vraie liste (149)', async () => {
    const states: ChildLaunchState[] = []
    const env = environment(undefined, undefined, {
      launchesChanged: (state) => states.push(state)
    })
    const mother = await env.mother()
    env.manager.settings.setPreferences({ maxChildren: 2 })
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const create = env.manager.createChild.bind(env.manager)
    vi.spyOn(env.manager, 'createChild').mockImplementation(async (...args) => {
      await gate
      return create(...args)
    })
    const first = env.children.start(mother, { text: 'Importer les données' })
    const second = env.children.start(mother, { text: 'Vérifier les données' })
    try {
      expect(env.children.launchState().entries.map((entry) => entry.title)).toEqual([
        'Importer les données',
        'Vérifier les données'
      ])
      expect(env.manager.state().conversations.filter((c) => c.startedFrom)).toEqual([])
      expect(env.children.capacity(mother).active).toBe(2)
      await expect(env.children.start(mother, { text: 'Une de trop' })).rejects.toThrow('plafond')
      env.manager.subscribe({
        list: (state) => {
          for (const child of state.conversations.filter((c) => c.startedFrom)) {
            expect(
              states.some((s) => s.entries.some((entry) => entry.conversationId === child.id))
            ).toBe(true)
          }
        }
      })
      release()
      const children = await Promise.all([first, second])
      expect(env.children.launchState().entries).toEqual([])
      expect(env.manager.state().activeId).toBe(mother)
      expect(new Set(children.map((c) => c.id)).size).toBe(2)
      expect(states.map((s) => s.revision)).toEqual([...states.keys()].map((i) => i + 1))
    } finally {
      release()
      await Promise.allSettled([first, second])
      env.manager.stopAll()
    }
  })

  it('une création en erreur retire la préparation, sans conversation fantôme (149)', async () => {
    const env = environment()
    const mother = await env.mother()
    vi.spyOn(env.manager, 'createChild').mockRejectedValue(new Error('worktree indisponible'))
    try {
      const pending = env.children.start(mother, { text: 'Essai' })
      expect(env.children.launchState().entries).toHaveLength(1)
      await expect(pending).rejects.toThrow('worktree indisponible')
      expect(env.children.launchState().entries).toEqual([])
      expect(env.manager.state().conversations.filter((c) => c.startedFrom)).toEqual([])
    } finally {
      env.manager.stopAll()
    }
  })
  it('publie la fille avant sa consigne et sa première réponse (diagnostic 149)', async () => {
    const env = environment()
    const mother = await env.mother()
    const published: string[] = []
    env.manager.subscribe({
      list: (state) => {
        for (const child of state.conversations) {
          if (child.startedFrom?.id === mother && !child.draft) published.push(child.id)
        }
      }
    })
    try {
      const child = await env.manager.createChild(mother, 'Préparer un import CSV')
      expect(published).toContain(child.id)
      expect(env.manager.state().activeId).toBe(mother)
      expect(
        env.items(child.id).some((item) => item.kind === 'user' || item.kind === 'agent')
      ).toBe(false)
    } finally {
      env.manager.stopAll()
    }
  })

  it('lancée depuis la mère : worktree, consigne, compte rendu, nouvelles transmises une fois', async () => {
    const env = environment()
    const { manager, children, items } = env
    const mother = await env.mother()

    const child = await children.start(mother, {
      text: 'Ajoute un import CSV',
      profileId: 'modifs'
    })
    expect(child.startedFrom).toEqual({ id: mother, title: 'Organise le carnet' })
    expect(child.branch).toMatch(/^bobine\//)
    expect(child.workspace.startsWith(join(env.repo, '.worktrees'))).toBe(true)
    expect(child.profileId).toBe('modifs')
    // La conversation affichée ne change pas.
    expect(manager.state().activeId).toBe(mother)
    expect(items(mother).at(-1)).toMatchObject({
      kind: 'child-started',
      childId: child.id,
      branch: child.branch,
      prompt: 'Ajoute un import CSV'
    })

    // Fin du tour de la fille : son compte rendu chez la mère.
    await waitFor(() => items(mother).some((i) => i.kind === 'child-report'))
    // D'abord l'avis de départ du worktree (fiche 110), puis la consigne.
    expect(items(child.id)[0]).toMatchObject({
      kind: 'worktree-start',
      branch: 'main',
      commit: expect.stringMatching(/^[0-9a-f]{40}$/)
    })
    expect(items(child.id)[1]).toMatchObject({ kind: 'user', text: 'Ajoute un import CSV' })
    const report = items(mother).find((i) => i.kind === 'child-report')
    expect(report).toMatchObject({
      childId: child.id,
      title: 'Ajoute un import CSV',
      outcome: 'done',
      branch: child.branch,
      fileCount: 2,
      excerpt: expect.stringContaining('deux fichiers modifiés'),
      // Sa consommation à la fin du tour (fiche 117) : un échange de l'agent factice.
      usage: { turns: 1, cost: { amount: 0.0125, currency: 'USD' } }
    })
    expect(report?.kind === 'child-report' && report.files.map((f) => f.path)).toEqual([
      'README.md',
      'src/app.js'
    ])
    // La fille travaille dans son worktree : le dépôt principal n'a pas bougé.
    expect(readFileSync(join(env.repo, 'README.md'), 'utf8')).toContain('Version 1')
    expect(env.git('status', '--porcelain')).toBe('')

    // Rien ne part tout seul : les nouvelles partent avec le prochain message, une seule fois.
    expect(env.lastReply(mother)).not.toContain('child_conversations')
    await manager.prompt(mother, 'Où en est-on ?')
    const told = env.lastReply(mother)
    expect(told).toContain('<child_conversations>')
    expect(told).toContain(
      `I started the child conversation "Ajoute un import CSV" on branch ${child.branch}`
    )
    expect(told).toContain('finished its turn. 2 file(s) changed so far')
    expect(told).toContain('README.md')
    // Le message de l'utilisateur part d'abord, les nouvelles après lui (fiche 125).
    expect(told.indexOf('« Où en est-on ? »')).toBeLessThan(told.indexOf('<child_conversations>'))
    await manager.prompt(mother, 'Et maintenant ?')
    expect(env.lastReply(mother)).not.toContain('child_conversations')
  })

  it('tour en erreur : compte rendu « erreur » avec le message', async () => {
    const env = environment()
    const mother = await env.mother()
    const child = await env.children.start(mother, { text: 'Échoue', profileId: 'erreur' })
    await waitFor(() => env.items(mother).some((i) => i.kind === 'child-report'))
    expect(env.items(mother).find((i) => i.kind === 'child-report')).toMatchObject({
      childId: child.id,
      outcome: 'error',
      fileCount: 0
    })
  })

  it('refusée : brouillon, fille, mère archivée, consigne vide, dossier hors dépôt', async () => {
    const env = environment()
    const { manager, children } = env
    const draft = manager.state().activeId
    await expect(children.start(draft, { text: 'x' })).rejects.toThrow(t('children.error.draft'))
    await manager.startActive()
    await manager.prompt(draft, 'Mère')
    await expect(children.start(draft, { text: '  ' })).rejects.toThrow(
      t('children.error.emptyPrompt')
    )
    const child = await children.start(draft, { text: 'Fille', profileId: 'echo' })
    await expect(children.start(child.id, { text: 'Petite-fille' })).rejects.toThrow(
      t('children.error.oneLevel')
    )
    // Profil sans choix du modèle d'une fille (fiche 160) : refusé par le main, quel que soit le
    // chemin (carte, dialogue, IPC) ; aucune fille créée.
    const count = manager.state().conversations.length
    await expect(
      children.start(draft, {
        text: 'x',
        profileId: 'sans-modele',
        model: { controlId: 'model', value: 'factice-precis' }
      })
    ).rejects.toThrow(t('children.error.modelNotAllowed'))
    expect(manager.state().conversations.length).toBe(count)
    manager.setArchived(draft, true)
    await expect(children.start(draft, { text: 'x' })).rejects.toThrow(t('children.error.archived'))

    const outside = mkdtempSync(join(tmpdir(), 'hors-depot-'))
    await manager.create({ workspace: outside })
    const loose = manager.state().activeId
    await manager.prompt(loose, 'Hors dépôt')
    const before = manager.state().conversations.length
    await expect(children.start(loose, { text: 'x' })).rejects.toThrow(t('worktrees.notRepo'))
    expect(manager.state().conversations.length).toBe(before)
  })

  it('mère archivée ou supprimée : la fille devient une conversation ordinaire', async () => {
    const env = environment()
    const { manager, children } = env
    const mother = await env.mother()
    const child = await children.start(mother, { text: 'Fille', profileId: 'echo' })
    const summary = () => manager.state().conversations.find((c) => c.id === child.id)

    manager.setArchived(mother, true)
    expect(summary()?.startedFrom).toBeUndefined()
    expect(summary()?.branch).toBe(child.branch)
    manager.setArchived(mother, false)
    expect(summary()?.startedFrom?.id).toBe(mother)

    manager.rename(mother, 'Carnet')
    expect(summary()?.startedFrom?.title).toBe('Carnet')
    await manager.delete(mother, { fromAgent: false })
    expect(summary()?.startedFrom).toBeUndefined()
    expect(summary()?.archived).toBeUndefined()
  })

  it('canal IPC : requête vérifiée, indisponible sans le module', async () => {
    const calls: unknown[] = []
    const handlers = childHandlers({
      launchState: () => ({ revision: 0, entries: [] }),
      start: (id, request) => {
        calls.push([id, request])
        return Promise.reject(new Error('non'))
      },
      capacity: (id) => ({ inRepo: id === 'm', active: 1, max: 5 })
    })
    expect(handlers['conversation:childCapacity']('m')).toEqual({ inRepo: true, active: 1, max: 5 })
    expect(() => handlers['conversation:childCapacity']('')).toThrow('id')
    await expect(
      handlers['conversation:startChild']('m', {
        text: 'Fais',
        model: { controlId: 'model', value: 'x' }
      })
    ).rejects.toThrow('non')
    expect(calls).toEqual([['m', { text: 'Fais', model: { controlId: 'model', value: 'x' } }]])
    expect(() =>
      handlers['conversation:startChild']('m', { text: 1 } as unknown as { text: string })
    ).toThrow('text')
    expect(() =>
      handlers['conversation:startChild']('m', {
        text: 'x',
        model: { controlId: 3 }
      } as unknown as { text: string })
    ).toThrow('model')
    expect(() => childHandlers(undefined)['conversation:startChild']('m', { text: 'x' })).toThrow(
      t('ipc.unavailable.children')
    )
  })
})

describe('conversations filles, étape 2 : l’agent lance et suit ses filles (fiche 097)', () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 150))

  it('plafond réglé (ADR-0020) : seules les filles en cours comptent', async () => {
    const env = environment()
    const { manager, children } = env
    const mother = await env.mother()
    manager.settings.setPreferences({ maxChildren: 1 })
    expect(children.capacity(mother)).toEqual({ inRepo: true, active: 0, max: 1 })
    const waiting = await children.start(mother, { text: 'Attends', profileId: 'attente' })
    expect(children.capacity(mother).active).toBe(1)
    await expect(children.start(mother, { text: 'Encore', profileId: 'echo' })).rejects.toThrow(
      t('children.limit', { count: 1 })
    )
    // Une fille qui a fini son tour ne compte plus.
    await waitFor(() => manager.view(waiting.id).summary.status === 'busy')
    await manager.cancel(waiting.id)
    await waitFor(() => children.capacity(mother).active === 0)
    await expect(
      children.start(mother, { text: 'Encore', profileId: 'echo' })
    ).resolves.toMatchObject({ startedFrom: { id: mother } })
  })

  it('réveil groupé : une fois, avec les comptes rendus ; jamais pour une fille lancée à la main', async () => {
    const env = environment()
    const { manager, children, items } = env
    const mother = await env.mother()
    const a = await children.start(
      mother,
      { text: 'Fais A', title: 'Import CSV', profileId: 'modifs' },
      'agent'
    )
    expect(a.title).toBe('Import CSV')
    expect(items(mother).find((i) => i.kind === 'child-started')).toMatchObject({
      childId: a.id,
      title: 'Import CSV',
      by: 'agent'
    })
    await children.start(mother, { text: 'Fais B', profileId: 'echo' }, 'agent')
    expect(children.holds(mother)).toBe(true)

    await waitFor(() => env.wakes(mother) === 1, 20_000)
    await waitFor(() => manager.view(mother).summary.status === 'ready')
    const told = env.lastReply(mother)
    expect(told).toContain('<child_conversations>')
    expect(told).toContain('You started (start_child) the child conversation "Import CSV"')
    expect(told.match(/finished its turn/g)).toHaveLength(2)
    expect(told).toContain(WAKE_TEXT)
    expect(children.holds(mother)).toBe(false)

    // Lancée à la main : son compte rendu attend le prochain message, sans réveil.
    const manual = await children.start(mother, { text: 'Fais C', profileId: 'echo' })
    await waitFor(() =>
      items(mother).some((i) => i.kind === 'child-report' && i.childId === manual.id)
    )
    await settle()
    expect(env.wakes(mother)).toBe(1)
  })

  it('messages : file d’attente de la conversation visée, avec leur provenance', async () => {
    const env = environment()
    const { manager, children, items } = env
    const mother = await env.mother()

    // Fille occupée (elle attend un accord) : le message attend dans sa file.
    const busy = await children.start(mother, { text: 'Attends', profileId: 'attente' }, 'agent')
    await waitFor(() => manager.view(busy.id).summary.status === 'busy')
    expect(children.messageChild(mother, children.summary(busy.id), 'Précision')).toBe('queued')
    expect(items(mother).filter((i) => i.kind === 'child-instruction')).toEqual([
      expect.objectContaining({ childId: busy.id, title: busy.title, prompt: 'Précision' })
    ])
    await waitFor(() => (manager.view(busy.id).snapshot?.queued.length ?? 0) > 0)
    expect(manager.view(busy.id).snapshot?.queued).toEqual([
      expect.objectContaining({
        text: 'Précision',
        from: { kind: 'parent', id: mother, title: 'Organise le carnet' }
      })
    ])

    // Fille qui démarre avec un modèle à régler (fiche 112) : le message attend derrière la
    // consigne, qui reste le premier message de la fille.
    const slow = await children.start(
      mother,
      {
        text: 'Attends',
        profileId: 'attente',
        model: { controlId: 'model', value: 'factice-precis' }
      },
      'agent'
    )
    expect(children.messageChild(mother, children.summary(slow.id), 'Après')).toBe('queued')
    await waitFor(() => (manager.view(slow.id).snapshot?.queued.length ?? 0) > 0)
    expect(items(slow.id).find((i) => i.kind === 'user')).toMatchObject({ text: 'Attends' })
    expect(manager.view(slow.id).snapshot?.queued).toEqual([
      expect.objectContaining({
        text: 'Après',
        from: { kind: 'parent', id: mother, title: 'Organise le carnet' }
      })
    ])

    // Fille au repos : le message part tout de suite, l'agent sait d'où il vient.
    const idle = await children.start(mother, { text: 'Bonjour', profileId: 'echo' })
    await waitFor(() =>
      items(mother).some((i) => i.kind === 'child-report' && i.childId === idle.id)
    )
    await waitFor(() => manager.view(idle.id).summary.status === 'ready')
    expect(children.messageChild(mother, children.summary(idle.id), 'Point-virgule')).toBe('sent')
    // La provenance part après le message (fiche 125) : la réponse la cite à la fin. L'écho
    // arrive en morceaux : attendre la citation entière, pas son début.
    await waitFor(() =>
      env.lastReply(idle.id).includes('comes from your parent conversation "Organise le carnet"')
    )
    expect(items(idle.id).findLast((i) => i.kind === 'user')).toMatchObject({
      from: { kind: 'parent', id: mother }
    })
    expect(env.lastReply(idle.id)).toContain(
      'comes from your parent conversation "Organise le carnet"'
    )
    const sent = items(mother).filter(
      (i) => i.kind === 'child-instruction' && i.childId === idle.id
    )
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ title: idle.title, prompt: 'Point-virgule' })
    expect(items(idle.id).findLast((i) => i.kind === 'user')).toMatchObject({
      text: 'Point-virgule'
    })

    // De la fille à la mère.
    children.messageParent(children.summary(idle.id), children.summary(mother), 'Virgule aussi ?')
    await waitFor(() => env.lastReply(mother).includes('comes from your child conversation'))
    expect(items(mother).findLast((i) => i.kind === 'user')).toMatchObject({
      text: 'Virgule aussi ?',
      from: { kind: 'child', id: idle.id, title: idle.title }
    })
    expect(env.lastReply(mother)).toContain(`comes from your child conversation "${idle.title}"`)
  })

  it('mère qui répond : le compte rendu attend la fin de sa réponse, sans la couper', async () => {
    const env = environment()
    const { manager, children, items } = env
    const mother = await env.mother()
    // La mère répond (elle attend un accord) pendant que sa fille finit son tour.
    const turn = manager.prompt(mother, '/scenario permission')
    await waitFor(() => items(mother).some((i) => i.kind === 'tool' && !!i.permission))
    const child = await children.start(mother, { text: 'Vite', profileId: 'echo' })
    await waitFor(
      () => manager.view(child.id).summary.status === 'ready' && env.lastReply(child.id) !== ''
    )
    await settle()
    expect(items(mother).some((i) => i.kind === 'child-report')).toBe(false)
    const request = items(mother).find((i) => i.kind === 'tool' && !!i.permission)
    if (request?.kind !== 'tool' || !request.permission) throw new Error('pas de demande')
    manager.respondPermission(mother, request.permission.requestId, 'allow')
    await turn
    await waitFor(() => items(mother).some((i) => i.kind === 'child-report'))
    // Posé après la réponse de la mère, qui reste d'un seul tenant.
    const kinds = items(mother).map((i) => i.kind)
    expect(kinds.slice(-2)).toEqual(['agent', 'child-report'])
    expect(kinds.filter((k) => k === 'child-report')).toHaveLength(1)
  })

  it('éviction (fiche 043) : une fille qui démarre ou travaille n’est jamais arrêtée pour faire de la place', async () => {
    // Deux agents vivants au plus : la mère qui attend sa fille, la fille, puis une autre
    // conversation ouverte par l'utilisateur dépassent déjà la limite.
    const env = environment(undefined, 2)
    const { manager, children, items } = env
    const mother = await env.mother()
    const waiting = await children.start(mother, { text: 'Attends', profileId: 'attente' }, 'agent')
    await waitFor(() => manager.view(waiting.id).summary.status === 'busy')
    await manager.create({ workspace: env.repo, profileId: 'echo' })
    const idle = manager.state().activeId
    await manager.prompt(idle, 'Une question')
    await manager.create({ workspace: env.repo, profileId: 'echo' })
    const other = manager.state().activeId
    await manager.prompt(other, 'Autre chose')
    // Une conversation ordinaire au repos, elle, laisse sa place.
    expect(manager.view(idle).summary.status).toBe('stopped')

    // Depuis cette autre conversation, une fille avec un modèle choisi (son agent est attendu).
    const child = await children.start(other, {
      text: 'Fais vite',
      profileId: 'echo',
      model: { controlId: 'model', value: 'factice-precis' }
    })
    await waitFor(() =>
      items(other).some((i) => i.kind === 'child-report' && i.childId === child.id)
    )
    expect(items(other).find((i) => i.kind === 'child-report')).toMatchObject({
      childId: child.id,
      outcome: 'done'
    })
    expect(env.lastReply(child.id)).toContain('Fais vite')
    // La mère attend toujours sa fille, et sa fille travaille : ni l'une ni l'autre n'est arrêtée.
    expect(manager.view(mother).summary.status).not.toBe('stopped')
    expect(manager.view(waiting.id).summary.status).toBe('busy')
  })

  it('agent de la fille qui ne démarre pas : le compte rendu dit pourquoi', async () => {
    const env = environment()
    const mother = await env.mother()
    const child = await env.children.start(mother, { text: 'Fais', profileId: 'absent' }, 'agent')
    await waitFor(() => env.items(mother).some((i) => i.kind === 'child-report'))
    const report = env.items(mother).find((i) => i.kind === 'child-report')
    expect(report).toMatchObject({ childId: child.id, outcome: 'error' })
    const excerpt = report?.kind === 'child-report' ? report.excerpt : ''
    expect(excerpt.startsWith(t('children.error.agentFailed', { detail: '' }))).toBe(true)
    expect(excerpt).not.toContain(t('conversations.error.noLiveAgent'))
    // La mère ne l'attend plus : réveillée avec ce compte rendu.
    await waitFor(() => env.wakes(mother) === 1)
  })

  it('bilan en double (essai réel) : la dernière fille écrit, puis finit pendant le tour de la mère', async () => {
    const env = environment()
    const { manager, children, items } = env
    const mother = await env.mother()
    const permission = (id: string) => {
      const tool = items(id).findLast((i) => i.kind === 'tool' && i.permission?.state === 'pending')
      return tool?.kind === 'tool' ? tool.permission?.requestId : undefined
    }
    // La dernière fille travaille (elle attend un accord).
    const last = await children.start(mother, { text: 'Attends', profileId: 'attente' }, 'agent')
    await waitFor(() => !!permission(last.id))
    // Elle écrit à sa mère, au repos : la mère traite ce message (son tour attend un accord).
    children.messageParent(
      children.summary(last.id),
      children.summary(mother),
      '/scenario permission'
    )
    await waitFor(() => !!permission(mother))
    // La fille finit pendant ce tour de la mère.
    manager.respondPermission(last.id, permission(last.id) ?? '', 'allow')
    await waitFor(() => manager.view(last.id).summary.status === 'ready')
    // Puis la mère finit son tour : le compte rendu de la fille est posé, sans réveil.
    manager.respondPermission(mother, permission(mother) ?? '', 'allow')
    await waitFor(() => items(mother).some((i) => i.kind === 'child-report'))
    await waitFor(() => manager.view(mother).summary.status === 'ready')
    await settle()
    expect(env.wakes(mother)).toBe(0)
    expect(children.holds(mother)).toBe(false)
  })

  it('état des filles (child_status) et rôles', async () => {
    const env = environment()
    const mother = await env.mother()
    const child = await env.children.start(mother, { text: 'Modifie', profileId: 'modifs' })
    await waitFor(() => env.items(mother).some((i) => i.kind === 'child-report'))
    await waitFor(() => env.manager.view(child.id).summary.status === 'ready')
    expect(env.children.status(mother)).toEqual([
      expect.objectContaining({
        id: child.id,
        title: 'Modifie',
        state: 'done',
        branch: child.branch,
        fileCount: 2,
        excerpt: expect.stringContaining('deux fichiers modifiés')
      })
    ])
    expect(env.children.role(mother)).toBe('mother')
    expect(env.children.role(child.id)).toBe('child')
    const outside = mkdtempSync(join(tmpdir(), 'hors-depot-'))
    await env.manager.create({ workspace: outside })
    expect(env.children.role(env.manager.state().activeId)).toBeUndefined()
  })

  describe('scénarios de l’agent factice, par le serveur MCP de l’app', () => {
    /** Mère sur l'agent factice, outils des filles fournis ; `answer` répond aux cartes d'accord. */
    async function withTools() {
      const toolServer = new AppToolServer()
      await toolServer.start()
      const env = environment(toolServer)
      const mother = await env.mother()
      const cards = () =>
        env
          .items(mother)
          .filter(
            (i): i is Extract<TranscriptItem, { kind: 'elicitation' }> =>
              i.kind === 'elicitation' && i.state === 'pending'
          )
      /** Carte de propositions (fiche 112) : la décision sur la première ligne en attente. */
      const answer = async (decision: 'start' | 'here' | 'refuse') => {
        await waitFor(() => cards().length > 0)
        const card = cards()[0]
        env.manager.respondElicitation(mother, card?.requestId ?? '', {
          action: 'accept',
          content: { decision }
        })
        await waitFor(() => !cards().some((c) => c.requestId === card?.requestId))
      }
      const children = () =>
        env.manager.state().conversations.filter((c) => c.startedFrom?.id === mother)
      const stop = () => {
        env.manager.stopAll()
        toolServer.stop()
      }
      return { ...env, mother, answer, children, stop }
    }

    it('`filles` : deux accords, deux filles, un seul réveil avec les comptes rendus', async () => {
      const env = await withTools()
      const turn = env.manager.prompt(env.mother, '/scenario filles')
      await env.answer('start')
      await env.answer('start')
      await turn
      expect(env.children().map((c) => c.title)).toEqual(
        expect.arrayContaining(['Import CSV', 'Page d’aide'])
      )
      // Un compte rendu arrivé pendant la réponse la coupe en deux éléments du fil.
      const replies = env
        .items(env.mother)
        .flatMap((i) => (i.kind === 'agent' ? [i.text] : []))
        .join('')
      expect(replies).toContain('J’ai lancé deux conversations filles')
      await waitFor(() => env.wakes(env.mother) === 1, 20_000)
      await waitFor(() => env.manager.view(env.mother).summary.status === 'ready')
      // La mère (scénario `echo` par défaut) a reçu les deux comptes rendus avec le réveil.
      const told = env.lastReply(env.mother)
      expect(told.match(/finished its turn/g)).toHaveLength(2)
      expect(told).toContain(WAKE_TEXT)
      await settle()
      expect(env.wakes(env.mother)).toBe(1)
      env.stop()
    })

    it('`filles-refus` : refus clair, aucune fille', async () => {
      const env = await withTools()
      const turn = env.manager.prompt(env.mother, '/scenario filles-refus')
      await env.answer('refuse')
      await turn
      expect(env.children()).toEqual([])
      expect(env.lastReply(env.mother)).toContain('Conversation fille refusée')
      expect(env.lastReply(env.mother)).toContain('The user refused to start')
      env.stop()
    })

    it('« Faire ici » (fiche 112) : la consigne revient à l’agent, aucune fille', async () => {
      const env = await withTools()
      const turn = env.manager.prompt(env.mother, '/scenario filles-refus')
      await env.answer('here')
      await turn
      expect(env.children()).toEqual([])
      expect(env.lastReply(env.mother)).toContain('Je fais la page d’aide ici')
      expect(env.lastReply(env.mother)).toContain(
        'do this task yourself, now, in this conversation'
      )
      expect(env.lastReply(env.mother)).toContain('/scenario streaming-texte')
      // La carte garde la décision.
      const card = env.items(env.mother).findLast((i) => i.kind === 'elicitation')
      expect(card && card.kind === 'elicitation' ? card.content : undefined).toEqual({
        decision: 'here'
      })
      env.stop()
    })

    it('`filles-plafond` : au-delà du plafond, une erreur qui cite le réglage', async () => {
      const env = await withTools()
      env.manager.settings.setPreferences({ maxChildren: 2 })
      const turn = env.manager.prompt(env.mother, '/scenario filles-plafond')
      await env.answer('start')
      await env.answer('start')
      await turn
      expect(env.children()).toHaveLength(2)
      const reply = env.lastReply(env.mother)
      expect(reply).toContain('3. Cannot start the child conversation "En-tête 3"')
      expect(reply).toContain('Settings › Conversation › Running child conversations')
      env.stop()
    })

    it('`fille-message` : de la mère à la fille, puis de la fille à la mère', async () => {
      const env = await withTools()
      const turn = env.manager.prompt(env.mother, '/scenario fille-message')
      await env.answer('start')
      await turn
      const [child] = env.children()
      if (!child) throw new Error('pas de fille')
      expect(
        env
          .items(env.mother)
          .flatMap((i) => (i.kind === 'agent' ? [i.text] : []))
          .join('')
      ).toContain('Fille lancée, puis consigne précisée')
      // La question de la fille arrive chez la mère, avec sa provenance.
      await waitFor(() =>
        env.items(env.mother).some((i) => i.kind === 'user' && i.from?.kind === 'child')
      )
      // La précision de la mère, mise en file pendant le premier tour de la fille, part ensuite.
      await waitFor(() =>
        env.items(child.id).some((i) => i.kind === 'user' && i.from?.kind === 'parent')
      )
      await waitFor(() => env.lastReply(child.id).includes('comes from your parent conversation'))
      expect(env.lastReply(child.id)).toContain('point-virgule')
      env.stop()
    })

    /** Mère tech lead (fiche 160) : une conversation sur `profileId`, outils des filles fournis. */
    async function withLead(profileId: string) {
      const toolServer = new AppToolServer()
      await toolServer.start()
      const env = environment(toolServer)
      const mother = (await env.manager.create({ profileId })).summary.id
      const pending = () =>
        env
          .items(mother)
          .filter(
            (i): i is Extract<TranscriptItem, { kind: 'elicitation' }> =>
              i.kind === 'elicitation' && i.state === 'pending'
          )
      const start = async (content: Record<string, string> = { decision: 'start' }) => {
        await waitFor(() => pending().length > 0)
        const card = pending()[0]
        env.manager.respondElicitation(mother, card?.requestId ?? '', { action: 'accept', content })
        return card
      }
      const replies = () =>
        env
          .items(mother)
          .flatMap((i) => (i.kind === 'agent' ? [i.text] : []))
          .join('')
      const stop = () => {
        env.manager.stopAll()
        toolServer.stop()
      }
      return { ...env, mother, start, replies, stop }
    }

    it('`filles-tech-lead` (fiche 160) : modèle proposé, correction, puis recommandation', async () => {
      const env = await withLead('lead')
      const turn = env.manager.prompt(env.mother, 'Ajoute l’import CSV')
      const card = await env.start()
      await turn
      // Agent inconnu : erreur claire, sans carte ; puis la carte porte le modèle et la raison.
      expect(env.replies()).toContain('Unknown agent "agent-inconnu". Available agents:')
      expect(card?.prompt.mode === 'form' && card.prompt.child).toEqual({
        title: 'Import CSV',
        prompt: 'Consigne de test.\n/scenario modifications',
        model: { controlId: 'model', value: 'factice-precis' },
        why: 'import délicat, modèle précis'
      })
      // Premier réveil : correction envoyée, « pas prête » ; second réveil : « prête ».
      await waitFor(() => env.wakes(env.mother) === 2, 30_000)
      await waitFor(
        () => env.items(env.mother).filter((i) => i.kind === 'child-recommendation').length === 2,
        20_000
      )
      const verdicts = env
        .items(env.mother)
        .flatMap((i) => (i.kind === 'child-recommendation' ? [[i.ready, i.note]] : []))
      expect(verdicts).toEqual([
        [false, 'Il manque un test du séparateur.'],
        [true, 'Branche relue : le test du séparateur est là, rien hors de src/.']
      ])
      // La correction est partie à la fille, qui a gardé sa conversation.
      const [child] = env.manager.state().conversations.filter((c) => c.startedFrom)
      expect(env.lastReply(child?.id ?? '')).toContain('Correction faite')
      await waitFor(() => env.replies().includes('à toi de la fusionner'), 20_000)
      // Rien n'est fusionné : la base n'a pas bougé.
      expect(env.git('rev-list', '--count', 'main')).toBe('1')
      env.stop()
    }, 60_000)

    it('`filles-modele` (fiche 160) : profil sans choix de modèle, modèle ignoré, carte sans modèle', async () => {
      const env = await withLead('sans-modele')
      const turn = env.manager.prompt(env.mother, 'Relis')
      // Comme le vrai Bob 2.0.6 : `model` passé quand même, ignoré au lieu d'un appel refusé.
      const card = await env.start({ decision: 'start' })
      await turn
      expect(card?.prompt.mode === 'form' && card.prompt.child?.model).toBeFalsy()
      expect(env.replies()).toContain('`model` was ignored')
      expect(env.manager.state().conversations.filter((c) => c.startedFrom)).toHaveLength(1)
      env.stop()
    }, 60_000)

    it.each([
      ['confirmé', 'factice-precis'],
      ['changé par l’utilisateur', 'factice-rapide']
    ])(
      '`filles-modele` (fiche 160) : modèle suggéré puis %s',
      async (_, chosen) => {
        const env = await withLead('modele')
        const turn = env.manager.prompt(env.mother, 'Relis')
        const card = await env.start({
          decision: 'start',
          modelControl: 'model',
          modelValue: chosen
        })
        await turn
        // La suggestion était sur la carte ; c'est le choix de l'utilisateur qui s'applique.
        expect(card?.prompt.mode === 'form' && card.prompt.child?.model?.value).toBe(
          'factice-precis'
        )
        const [child] = env.manager.state().conversations.filter((c) => c.startedFrom)
        await waitFor(
          () =>
            env.manager.view(child?.id ?? '').snapshot?.controls.find((c) => c.id === 'model')
              ?.currentValue === chosen,
          20_000
        )
        env.stop()
      },
      60_000
    )

    it('`filles-bavarde` (fiche 160) : la mère reçoit un compte rendu borné, sans la fin', async () => {
      const env = await withLead('bavarde')
      const turn = env.manager.prompt(env.mother, 'Fais le relevé')
      await env.start()
      await turn
      await waitFor(() => env.wakes(env.mother) === 1, 30_000)
      await waitFor(() => env.replies().includes('Compte rendu'), 20_000)
      expect(env.replies()).toContain('Compte rendu borné')
      const report = env.items(env.mother).find((i) => i.kind === 'child-report')
      expect(report?.kind === 'child-report' && report.fileCount).toBe(30)
      expect(report?.kind === 'child-report' && report.excerpt.length).toBeLessThanOrEqual(400)
      expect(report?.kind === 'child-report' && report.excerpt).toMatch(/^Récapitulatif/)
      env.stop()
    }, 60_000)

    it('contexte de session (fiche 118) : la mère le reçoit une fois, pas sa fille ; `chantiers` propose alors des filles', async () => {
      const toolServer = new AppToolServer()
      await toolServer.start()
      const env = { ...environment(toolServer), stop: () => toolServer.stop() }
      const mother = await env.mother()
      // Premier message de la mère (`mother()`) : le bloc est arrivé avec lui, et seulement lui.
      const first = env.items(mother).find((i) => i.kind === 'agent')
      expect(first?.kind === 'agent' && first.text).toContain('<bobine_capabilities>')
      const turn = env.manager.prompt(mother, '/scenario echo')
      await turn
      expect(env.lastReply(mother)).not.toContain('bobine_capabilities')
      // Une fille (pas de `start_child`) ne le reçoit pas ; `/split` y est refusé.
      const child = await env.children.start(mother, { text: 'Bonjour', profileId: 'echo' })
      await waitFor(() => env.manager.view(child.id).summary.status === 'ready')
      expect(env.lastReply(child.id)).not.toContain('bobine_capabilities')
      await expect(
        env.manager.prompt(child.id, 'Deux chantiers', [], { askChildren: true })
      ).rejects.toThrow(t('children.error.noStartChild'))
      env.manager.stopAll()
      env.stop()
    })

    it('`chantiers` (fiche 118) : « Jamais » : il fait le travail lui-même ; `/split` : il propose', async () => {
      const toolServer = new AppToolServer()
      await toolServer.start()
      const env = environment(toolServer)
      env.manager.settings.setPreferences({ childProposals: 'never' })
      const id = env.manager.state().activeId
      await env.manager.startActive()
      await env.manager.prompt(id, '/scenario chantiers')
      expect(env.lastReply(id)).toContain('Je fais les deux chantiers moi-même')
      expect(env.lastReply(id)).not.toContain('bobine_capabilities')
      // `/split` : la demande explicite suffit, même réglé sur « Jamais ».
      const turn = env.manager.prompt(id, '/scenario chantiers', [], { askChildren: true })
      const card = () =>
        env.items(id).find((i) => i.kind === 'elicitation' && i.state === 'pending')
      for (let n = 0; n < 2; n++) {
        await waitFor(() => !!card())
        const pending = card()
        env.manager.respondElicitation(
          id,
          pending?.kind === 'elicitation' ? pending.requestId : '',
          {
            action: 'accept',
            content: { decision: 'refuse' }
          }
        )
        await waitFor(() => card() !== pending)
      }
      await turn
      expect(env.lastReply(id)).toContain('(/split)')
      expect(
        env
          .items(id)
          .filter((i) => i.kind === 'user')
          .map((i) => i.text)
      ).toEqual(['/scenario chantiers', '/scenario chantiers'])
      env.manager.stopAll()
      toolServer.stop()
    })
  })
})
