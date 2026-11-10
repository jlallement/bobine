import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { AgentSessionView, ConversationEvent, ConversationsState } from '@shared/agent'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentProfile } from '../agent/profiles'
import { OPENCODE_SUBAGENT_FORMAT } from '../agent/opencode-subagents'
import { execFileSync } from 'node:child_process'
import { gitCommand, queuedGit } from '../git/git-queue'
import { Worktrees } from '../changes/worktrees'
import { WorktreePreparation } from '../changes/worktree-setup'
import { connectWorktreePreparation } from '../changes/worktree-setup-wiring'
import { AgentHost } from '../agent/agent-host'
import { ConversationTrash } from './trash'
import { setReadOnlyProfile } from '../storage'
import { guardPrompts } from '../read-only-guard'
import { ConversationManager } from './manager'
import { ConversationStore } from './store'
import { ApiKeyStore, type Cipher } from '../agent-config/api-keys'
import { noticeText, type TranscriptState } from '@shared/transcript'
import { BOB_RULES } from '../agent-config/bob-rules'

function waitFor(predicate: () => boolean, timeoutMs = 8000): Promise<void> {
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

/** Un environnement de test : dossiers jetables, profils factices partageant une mémoire de sessions. */
function environment(extraArgs: string[] = []) {
  const root = mkdtempSync(join(tmpdir(), 'conv-manager-'))
  const store = join(root, 'mock-store')
  const workspaceA = mkdtempSync(join(tmpdir(), 'ws-a-'))
  const workspaceB = mkdtempSync(join(tmpdir(), 'ws-b-'))
  const mock = (id: string, scenario: string, ...args: string[]): AgentProfile => ({
    id,
    label: `Factice ${id}`,
    command: process.execPath,
    args: [
      MOCK_AGENT_ENTRY,
      '--scenario',
      scenario,
      '--delay',
      '0',
      '--store',
      store,
      ...extraArgs,
      ...args
    ],
    env: {}
  })
  const profiles: AgentProfile[] = [
    // Règles lues comme Bob (fiche 056).
    { ...mock('texte', 'streaming-texte'), rules: BOB_RULES },
    mock('refus', 'refus'),
    // Sessions vides reconnues à leur titre, comme celles d'OpenCode (fiche 055).
    { ...mock('titres', 'echo', '--titres'), emptySessionTitle: /^Factice : vide/ },
    // Titre de session = début du texte envoyé, blocs de l'app compris, comme Bob (fiche 125).
    mock('titres-bob', 'echo', '--titres-invite'),
    // Comme OpenCode : la session d'un sous-agent se rejoue (fiche 053).
    {
      ...mock('sous-agent', 'sous-agent-opencode'),
      subagentFormat: OPENCODE_SUBAGENT_FORMAT,
      subagentReplay: true
    }
  ]

  /** Une « instance de l'app » : un gestionnaire sur ces dossiers. */
  function launch(
    options: {
      maxLive?: number
      maxIdleTranscripts?: number
      only?: string[]
      onReleased?: (id: string, reason: 'archived' | 'evicted') => void
      /** Conversations à ne pas évincer (filles en cours, mère qui attend, fiche 097). */
      keepLive?: (id: string) => boolean
      agentHome?: string
      /** Profils placés avant ceux de l'environnement. */
      before?: AgentProfile[]
      onSettingsChanged?: () => void
      apiKeys?: ApiKeyStore
      env?: NodeJS.ProcessEnv
      /** Dossier des conversations sans choix (essais) ; `null` : aucun, comme l'app (fiche 093). */
      defaultWorkspace?: string | null
    } = {}
  ) {
    const events: ConversationEvent[] = []
    const lists: ConversationsState[] = []
    const manager = new ConversationManager({
      profiles: [
        ...(options.before ?? []),
        ...(options.only ? profiles.filter((p) => options.only?.includes(p.id)) : profiles)
      ],
      settingsFile: join(root, 'settings.json'),
      conversationsDir: join(root, 'conversations'),
      ...(options.defaultWorkspace === null
        ? {}
        : { defaultWorkspace: options.defaultWorkspace ?? workspaceA }),
      neutralFolder: workspaceA,
      pathEnv: () => process.env['PATH'],
      emit: (e) => events.push(e),
      emitList: (s) => lists.push(s),
      maxLive: options.maxLive,
      ...(options.maxIdleTranscripts !== undefined
        ? { maxIdleTranscripts: options.maxIdleTranscripts }
        : {}),
      worktrees: new Worktrees(queuedGit(gitCommand)),
      ...(options.onReleased ? { onReleased: options.onReleased } : {}),
      ...(options.keepLive ? { keepLive: options.keepLive } : {}),
      ...(options.onSettingsChanged ? { onSettingsChanged: options.onSettingsChanged } : {}),
      ...(options.apiKeys ? { apiKeys: options.apiKeys } : {}),
      ...(options.env ? { env: options.env } : {}),
      // Jamais le vrai dossier personnel : ses règles fausseraient les essais (fiche 056).
      agentHome: options.agentHome ?? mkdtempSync(join(tmpdir(), 'maison-vide-'))
    })
    const status = (id: string) => manager.view(id).snapshot?.status
    const ready = (id: string) => waitFor(() => status(id) === 'ready')
    return { manager, events, lists, status, ready }
  }
  return { root, workspaceA, workspaceB, launch, mock }
}

const kinds = (view: { transcript: { items: { kind: string }[] } }) =>
  view.transcript.items.map((i) => i.kind)

describe('ConversationManager', () => {
  it('au lancement : une conversation vide active, hors historique', async () => {
    const { launch } = environment()
    const { manager } = launch()
    const { conversations, activeId } = manager.state()
    expect(conversations).toHaveLength(1)
    expect(conversations[0]).toMatchObject({ id: activeId, draft: true, profileId: 'texte' })
    await manager.startActive()
    manager.stopAll()
  })

  it('nouvelle conversation : l’ancienne reste dans l’historique, avec son fil', async () => {
    const { launch } = environment()
    const { manager, ready } = launch()
    const first = manager.state().activeId
    await manager.startActive()
    await manager.prompt(first, 'Explique le projet\nen détail')
    const second = (await manager.create()).summary.id

    const { conversations, activeId } = manager.state()
    expect(activeId).toBe(second)
    expect(conversations.map((c) => [c.id, c.draft])).toEqual(
      expect.arrayContaining([
        [first, false],
        [second, true]
      ])
    )
    expect(manager.view(first).summary.title).toBe('Explique le projet')
    expect(kinds(manager.view(first))).toEqual(['user', 'agent'])
    await ready(second)
    manager.stopAll()
  })

  it('revenir sur une conversation vivante : pas de redémarrage, l’échange continue', async () => {
    const { launch } = environment()
    const { manager, events } = launch()
    const first = manager.state().activeId
    await manager.startActive()
    await manager.prompt(first, 'Un')
    const draft = (await manager.create()).summary.id

    const before = events.filter(
      (e) => e.conversationId === first && e.event.type === 'reset'
    ).length
    manager.select(first)
    await manager.prompt(first, 'Deux')
    expect(kinds(manager.view(first))).toEqual(['user', 'agent', 'user', 'agent'])
    expect(
      events.filter((e) => e.conversationId === first && e.event.type === 'reset').length
    ).toBe(before)
    // Le brouillon vide quitté a disparu.
    expect(manager.state().conversations.some((c) => c.id === draft)).toBe(false)
    manager.stopAll()
  })

  it('nouvelle conversation quittée pendant son démarrage : pas d’erreur, la conversation choisie', async () => {
    const { launch } = environment()
    const { manager } = launch()
    const first = manager.state().activeId
    await manager.startActive()
    await manager.prompt(first, 'Un')
    const creating = manager.create()
    // Clic dans l'historique avant la fin du démarrage : le brouillon est jeté.
    manager.select(first)
    expect((await creating).summary.id).toBe(first)
    manager.stopAll()
  })

  it('après redémarrage de l’app : historique rechargé, conversation reprise par session/load', async () => {
    const env = environment()
    const app1 = env.launch()
    const id = app1.manager.state().activeId
    await app1.manager.startActive()
    await app1.manager.prompt(id, 'Avant redémarrage')
    app1.manager.stopAll()

    const app2 = env.launch()
    const listed = app2.manager.state().conversations.find((c) => c.id === id)
    expect(listed).toMatchObject({ title: 'Avant redémarrage', status: 'stopped', draft: false })
    // Le fil mémorisé est disponible avant même que l'agent ne démarre.
    expect(kinds(app2.manager.view(id))).toEqual(['user', 'agent'])

    app2.manager.select(id)
    await app2.ready(id)
    expect(kinds(app2.manager.view(id))).toEqual(['user', 'agent'])
    await app2.manager.prompt(id, 'Après redémarrage')
    expect(kinds(app2.manager.view(id))).toEqual(['user', 'agent', 'user', 'agent'])
    app2.manager.stopAll()

    // Et le fil complet est de nouveau sur disque.
    const app3 = env.launch()
    expect(kinds(app3.manager.view(id))).toHaveLength(4)
    app3.manager.stopAll()
  })

  it('index abîmé (fiche 041) : historique repris de la copie, mis de côté (avis : fiche 196)', async () => {
    const env = environment()
    const app1 = env.launch()
    const id = app1.manager.state().activeId
    await app1.manager.startActive()
    await app1.manager.prompt(id, 'À garder')
    await app1.manager.prompt(id, 'Encore')
    app1.manager.stopAll()
    writeFileSync(join(env.root, 'conversations', 'index.json'), '[{"tronqué')

    const app2 = env.launch()
    expect(app2.manager.state().conversations.some((c) => c.id === id)).toBe(true)
    // L'avis passe par l'état du profil (index.ts, `reportDamage`), plus par le fil de l'accueil.
    expect(
      readdirSync(join(env.root, 'conversations')).some((f) => f.startsWith('index.json.corrupt-'))
    ).toBe(true)
    const view = await app2.manager.startActive()
    expect(view.transcript.items.some((i) => i.kind === 'notice')).toBe(false)
    app2.manager.stopAll()
  })

  it('réponse longue : continue pendant qu’on travaille dans une autre conversation (fiche 036)', async () => {
    const env = environment()
    const app = env.launch()
    const first = app.manager.state().activeId
    await app.manager.startActive()
    // Le tour reste ouvert tant que le test n'a pas répondu à l'autorisation : pas de course
    // entre la durée d'un flux et le lancement du second agent (lent sur une machine de CI).
    const long = app.manager.prompt(first, '/scenario permission')
    await waitFor(() => app.events.some((e) => e.event.type === 'permission-request'))
    const request = app.events.find((e) => e.event.type === 'permission-request')?.event
    if (request?.type !== 'permission-request') throw new Error('pas de demande')
    const second = (await app.manager.create({ workspace: env.workspaceB })).summary.id
    await app.ready(second)
    await app.manager.prompt(second, 'Pendant ce temps')
    expect(app.status(first)).toBe('busy')
    // La suite de la réponse arrive alors que la conversation n'est plus active.
    app.manager.respondPermission(first, request.requestId, 'allow')
    await long
    await waitFor(() => app.status(first) === 'ready')
    const replies = app.manager
      .view(first)
      .transcript.items.flatMap((i) => (i.kind === 'agent' ? [i.text] : []))
    expect(replies.at(-1)).toContain('Configuration mise à jour.')
    expect(app.manager.state().activeId).toBe(second)
    app.manager.stopAll()
  })

  it('repartir d’un message (fiche 023) : branche avec contexte, fichiers remis, originale intacte', async () => {
    const env = environment()
    const app = env.launch()
    const id = app.manager.state().activeId
    const readme = join(env.workspaceA, 'README.md')
    writeFileSync(readme, '# Projet\nVersion 1\n## Utilisation\n')
    await app.manager.startActive()
    await app.manager.prompt(id, 'Bonjour, je m’appelle Léa')
    await app.manager.prompt(id, '/scenario modifications')
    expect(readFileSync(readme, 'utf8')).toContain('Version 2')
    const original = app.manager.view(id).transcript.items
    const second = original.filter((i) => i.kind === 'user')[1]
    if (!second) throw new Error('second message absent')

    const preview = await app.manager.branchPreview(id, second.id)
    expect(preview.files.map((f) => [f.path.split('/').at(-1), f.status, f.created])).toEqual([
      ['README.md', 'restore', false],
      ['app.js', 'restore', true]
    ])

    const view = await app.manager.branch(id, second.id, '/scenario echo', { restoreFiles: true })
    const branch = view.summary.id
    expect(branch).not.toBe(id)
    expect(view.summary).toMatchObject({
      branchedFrom: { id, title: 'Bonjour, je m’appelle Léa' },
      draft: false
    })
    expect(readFileSync(readme, 'utf8')).toBe('# Projet\nVersion 1\n## Utilisation\n')
    expect(existsSync(join(env.workspaceA, 'src', 'app.js'))).toBe(false)

    await waitFor(() => kinds(app.manager.view(branch)).at(-1) === 'agent')
    await app.ready(branch)
    const items = app.manager.view(branch).transcript.items
    expect(items.map((i) => i.kind)).toEqual(['user', 'agent', 'branch', 'user', 'agent'])
    expect(items[2]).toMatchObject({ kind: 'branch', fromId: id, restored: 2, skipped: 0 })
    expect(items[3]).toMatchObject({ kind: 'user', text: '/scenario echo' })
    const echo = items[4]?.kind === 'agent' ? items[4].text : ''
    expect(echo).toContain('2 bloc(s)')
    expect(echo).toContain('<earlier_conversation>')
    expect(echo).toContain('User: Bonjour, je m’appelle Léa')
    expect(echo).toContain('restored to their state at that time')
    expect(echo).not.toContain('modifications')
    // L'originale n'a pas bougé.
    expect(app.manager.view(id).transcript.items).toEqual(original)
    app.manager.stopAll()
  })

  it('« Toujours autoriser » retenu (fiche 042) : plus demandé dans les conversations suivantes', async () => {
    const env = environment()
    const app1 = env.launch()
    const requests = () =>
      app1.events.flatMap((e) =>
        e.event.type === 'permission-request' ? [{ id: e.conversationId, event: e.event }] : []
      )
    const first = app1.manager.state().activeId
    await app1.manager.startActive()
    const turn = app1.manager.prompt(first, '/scenario liste-taches')
    await waitFor(() => requests().length === 1)
    const request = requests()[0]
    const always = request?.event.options.find((o) => o.kind === 'allow_always')
    app1.manager.respondPermission(first, request?.event.requestId ?? '', always?.optionId ?? null)
    await turn
    expect(app1.manager.settingsView().rememberedTools).toEqual([
      { profileId: 'texte', profileLabel: 'Factice texte', tools: ['Updating todo list'] }
    ])

    // Nouvelle conversation : accordé d'office, la liste de tâches arrive.
    const second = (await app1.manager.create()).summary.id
    await app1.ready(second)
    await app1.manager.prompt(second, '/scenario liste-taches')
    expect(requests()).toHaveLength(1)
    expect(kinds(app1.manager.view(second))).toEqual(['user', 'tool', 'plan', 'agent'])
    app1.manager.stopAll()

    // Retenu après redémarrage ; révocable.
    const app2 = env.launch()
    expect(app2.manager.settingsView().rememberedTools[0]?.tools).toEqual(['Updating todo list'])
    app2.manager.settings.forgetTool('texte', 'Updating todo list')
    const view = app2.manager.settingsView()
    expect(view.rememberedTools).toEqual([])
    app2.manager.stopAll()
  })

  it('reprendre une session commencée ailleurs : liste filtrée, rejeu, pas de doublon (fiche 055)', async () => {
    const env = environment()
    const app = env.launch()
    // Une session de l'agent que l'historique ne connaît plus (« commencée ailleurs »).
    const first = app.manager.state().activeId
    await app.manager.startActive()
    await app.manager.prompt(first, 'Bonjour depuis le terminal')
    expect(
      (await app.manager.agentSessions('texte', env.workspaceA)).map((s) => s.sessionId)
    ).toEqual([])
    await app.manager.delete(first, { fromAgent: false })
    const listed = await app.manager.agentSessions('texte', env.workspaceA)
    expect(listed).toHaveLength(1)
    expect(listed[0]).toMatchObject({ cwd: env.workspaceA, updatedAt: expect.any(String) })

    // Reprise : conversation de l'historique, l'agent rejoue l'échange.
    const session = listed[0] as AgentSessionView
    const resumed = app.manager.resumeSession('texte', session)
    await app.ready(resumed.summary.id)
    await waitFor(() => kinds(app.manager.view(resumed.summary.id)).join() === 'user,agent')
    const items = app.manager.view(resumed.summary.id).transcript.items
    expect(items[0]).toMatchObject({ kind: 'user', text: 'Bonjour depuis le terminal' })
    expect(app.manager.state().activeId).toBe(resumed.summary.id)
    // Déjà reprise : ouverte, pas doublée ; et plus proposée.
    expect(app.manager.resumeSession('texte', session).summary.id).toBe(resumed.summary.id)
    expect(app.manager.state().conversations.filter((c) => !c.draft)).toHaveLength(1)
    expect(await app.manager.agentSessions('texte', env.workspaceA)).toEqual([])
    // On peut continuer la conversation reprise.
    await app.manager.prompt(resumed.summary.id, 'Et ensuite ?')
    expect(kinds(app.manager.view(resumed.summary.id)).slice(-2)).toEqual(['user', 'agent'])
    app.manager.stopAll()
  })

  it('règles actives : selon le mode, lisibles en aperçu même hors du dossier ; rien d’autre (fiche 056)', async () => {
    const env = environment()
    const home = mkdtempSync(join(tmpdir(), 'maison-'))
    writeFileSync(join(env.workspaceA, 'AGENTS.md'), '# Consignes du projet')
    mkdirSync(join(home, '.bob', 'rules-code'), { recursive: true })
    writeFileSync(join(home, '.bob', 'rules-code', 'style.md'), 'Réponds court.')
    mkdirSync(join(home, '.bob', 'rules-plan'), { recursive: true })
    writeFileSync(join(home, '.bob', 'rules-plan', 'plan.md'), 'Autre mode.')
    const app = env.launch({ agentHome: home })
    const id = app.manager.state().activeId
    await app.manager.startActive()
    const rules = await app.manager.rules(id)
    expect(rules.map((r) => `${r.scope}${r.mode ? `:${r.mode}` : ''} ${r.label}`)).toEqual([
      'project AGENTS.md',
      'personal:code ~/.bob/rules-code/style.md'
    ])
    const personal = await app.manager.readDocument(
      id,
      join(home, '.bob', 'rules-code', 'style.md')
    )
    expect(personal).toMatchObject({
      text: 'Réponds court.',
      relative: '~/.bob/rules-code/style.md'
    })
    await expect(
      app.manager.readDocument(id, join(home, '.bob', 'rules-plan', 'plan.md'))
    ).rejects.toThrow()
    expect((await app.manager.readDocument(id, 'AGENTS.md')).text).toBe('# Consignes du projet')
    // Un agent sans format de règles déclaré : rien.
    const other = (await app.manager.create({ profileId: 'refus' })).summary.id
    expect(await app.manager.rules(other)).toEqual([])
    app.manager.stopAll()
  })

  it('sessions proposées : sans les vides que le profil reconnaît ni les dossiers disparus (fiche 055)', async () => {
    const env = environment()
    const app = env.launch()
    const vide = (await app.manager.create({ profileId: 'titres' })).summary.id
    await app.ready(vide)
    await app.manager.prompt(vide, 'vide')
    const plein = (await app.manager.create({ profileId: 'titres', workspace: env.workspaceB }))
      .summary.id
    await app.ready(plein)
    await app.manager.prompt(plein, 'plein')
    await app.manager.delete(vide, { fromAgent: false })
    await app.manager.delete(plein, { fromAgent: false })
    const all = await app.manager.agentSessions('titres')
    expect(all.map((s) => s.title)).toEqual(['Factice : plein'])
    rmSync(env.workspaceB, { recursive: true, force: true })
    expect(await app.manager.agentSessions('titres')).toEqual([])
    await expect(app.manager.agentSessions('inconnu')).rejects.toThrow('Agent inconnu')
    app.manager.stopAll()
  })

  it('premier lancement : le premier agent installé, pas un agent introuvable (fiche 058)', () => {
    const env = environment()
    const absent: AgentProfile = {
      id: 'absent',
      label: 'Agent absent',
      command: '/nulle/part/agent',
      args: [],
      env: {}
    }
    const app = env.launch({ before: [absent] })
    expect(app.manager.state().conversations[0]?.profileId).toBe('texte')
    app.manager.stopAll()
  })

  it('ce que l’agent annonce au démarrage est retenu d’un lancement à l’autre (fiche 054)', async () => {
    const env = environment()
    const app1 = env.launch()
    const before = app1.manager.settingsView().profiles.find((p) => p.id === 'texte')
    expect(before?.capabilities.announced).toBeUndefined()
    expect(before?.capabilities.specific.map((i) => i.id)).toEqual(['rules-files'])
    await app1.manager.startActive()
    const seen = app1.manager.settingsView().profiles.find((p) => p.id === 'texte')
    expect(seen?.capabilities.announced).toMatchObject({ name: 'Agent factice', version: '0.1.0' })
    expect(seen?.capabilities.announced?.items.find((i) => i.id === 'reopen')?.supported).toBe(true)
    app1.manager.stopAll()

    const app2 = env.launch()
    const again = app2.manager.settingsView().profiles.find((p) => p.id === 'texte')
    expect(again?.capabilities.announced?.version).toBe('0.1.0')
    expect(
      app2.manager.settingsView().profiles.find((p) => p.id === 'refus')?.capabilities.announced
    ).toBeUndefined()
    app2.manager.stopAll()
  })

  it('sous-agent : durée suivie, travail rejoué à part sans toucher la conversation (fiche 053)', async () => {
    const env = environment()
    const app = env.launch()
    const id = (await app.manager.create({ profileId: 'sous-agent' })).summary.id
    await app.ready(id)
    await app.manager.prompt(id, 'Résume notes.txt avec un sous-agent')
    const card = app.manager.view(id).transcript.items.find((i) => i.kind === 'tool' && i.subagent)
    expect(card?.kind === 'tool' && card.subagentRun).toMatchObject({
      startedAt: expect.any(Number),
      endedAt: expect.any(Number),
      sessionId: 'ses_mock_enfant'
    })
    const before = app.manager.view(id).transcript
    const work = await app.manager.subagentWork(id, 'call_task')
    expect(work.map((i) => i.kind)).toEqual(['tool', 'agent'])
    expect(work[0]).toMatchObject({ kind: 'tool', toolKind: 'read', status: 'completed' })
    expect(work[1]?.kind === 'agent' && work[1].text).toContain('Gribouille')
    // Rejoué une fois, puis gardé ; la conversation n'a pas bougé.
    expect(await app.manager.subagentWork(id, 'call_task')).toBe(work)
    expect(app.manager.view(id).transcript).toEqual(before)
    await expect(app.manager.subagentWork(id, 'inconnu')).rejects.toThrow('ne peut pas être rejoué')
    // Un agent sans rejeu déclaré ne rejoue rien, même si la réponse nomme une session.
    const other = (await app.manager.create({ profileId: 'texte' })).summary.id
    await expect(app.manager.subagentWork(other, 'call_task')).rejects.toThrow()
    app.manager.stopAll()
  })

  it('« Toujours autoriser » sur une modification de fichier : jamais retenu (fiche 042)', async () => {
    const env = environment()
    const app = env.launch()
    const id = app.manager.state().activeId
    await app.manager.startActive()
    const turn = app.manager.prompt(id, '/scenario permission')
    await waitFor(() => app.events.some((e) => e.event.type === 'permission-request'))
    const event = app.events.find((e) => e.event.type === 'permission-request')?.event
    if (event?.type !== 'permission-request') throw new Error('pas de demande')
    const always = event.options.find((o) => o.kind === 'allow_always')
    expect(always).toBeDefined()
    app.manager.respondPermission(id, event.requestId, always?.optionId ?? null)
    await turn
    expect(app.manager.settingsView().rememberedTools).toEqual([])
    app.manager.stopAll()
  })

  it('réglages d’une nouvelle conversation : agent, dossier et mode imposés', async () => {
    const env = environment()
    const app = env.launch()
    await app.manager.startActive()
    const mode = (id: string) =>
      app.manager.view(id).snapshot?.controls.find((c) => c.category === 'mode')?.currentValue
    app.manager.settings.setNewConversation({
      profileId: 'refus',
      workspace: env.workspaceB,
      mode: 'plan'
    })
    const first = (await app.manager.create()).summary
    expect(first).toMatchObject({ profileId: 'refus', workspace: env.workspaceB })
    await app.ready(first.id)
    expect(mode(first.id)).toBe('plan')
    await app.manager.prompt(first.id, 'Bonjour')

    // Changer d'agent sur une conversation commencée garde son dossier (pas les réglages).
    const other = (await app.manager.configure(first.id, { profileId: 'texte' })).summary
    expect(other).toMatchObject({ profileId: 'texte', workspace: env.workspaceB })
    await app.ready(other.id)
    await app.manager.prompt(other.id, 'Suite')

    app.manager.settings.setNewConversation({ mode: 'execute' })
    expect(app.manager.settingsView().newConversation).toEqual({ mode: 'execute' })
    const second = (await app.manager.create()).summary
    await app.ready(second.id)
    expect(mode(second.id)).toBe('code')
    expect(() => app.manager.settings.setNewConversation({ workspace: '/nexiste/pas' })).toThrow(
      'introuvable'
    )
    app.manager.stopAll()
  })

  it('archiver : hors de la liste principale, agent arrêté ; un message la ressort', async () => {
    const env = environment()
    const app = env.launch()
    const id = app.manager.state().activeId
    await app.manager.startActive()
    await app.manager.prompt(id, 'À ranger')
    app.manager.setPinned(id, true)
    const state = app.manager.setArchived(id, true)
    expect(state.activeId).not.toBe(id)
    expect(state.conversations.find((c) => c.id === id)).toMatchObject({
      archived: true,
      status: 'stopped'
    })
    expect(state.conversations.find((c) => c.id === id)?.pinned).toBeUndefined()
    app.manager.select(id)
    await app.ready(id)
    await app.manager.prompt(id, 'Je reprends')
    expect(app.manager.state().conversations.find((c) => c.id === id)?.archived).toBeUndefined()
    app.manager.stopAll()
  })

  it('« Relancer » après un plantage (fiche 041) : fil gardé, la conversation continue', async () => {
    const env = environment()
    const app = env.launch()
    const id = app.manager.state().activeId
    await app.manager.startActive()
    await app.manager.prompt(id, '/scenario plantage')
    await waitFor(() => app.status(id) === 'exited')
    const before = kinds(app.manager.view(id))
    expect(before).toEqual(['user', 'agent', 'tool', 'notice'])
    await app.manager.restart(id)
    await app.ready(id)
    expect(kinds(app.manager.view(id))).toEqual(before)
    await app.manager.prompt(id, 'Et maintenant ?')
    expect(kinds(app.manager.view(id))).toEqual([...before, 'user', 'agent'])
    app.manager.stopAll()
  })

  it('message envoyé à un agent arrêté (fiche 041) : relancé d’abord, puis le message part', async () => {
    const env = environment()
    const app = env.launch()
    const id = app.manager.state().activeId
    await app.manager.startActive()
    await app.manager.prompt(id, '/scenario plantage')
    await waitFor(() => app.status(id) === 'exited')
    await app.manager.prompt(id, 'On reprend')
    expect(kinds(app.manager.view(id))).toEqual([
      'user',
      'agent',
      'tool',
      'notice',
      'user',
      'agent'
    ])
    app.manager.stopAll()
  })

  it('écriture impossible (fiche 041) : un seul avis, aucune exception', async () => {
    const env = environment()
    const app = env.launch()
    const id = app.manager.state().activeId
    await app.manager.startActive()
    await app.manager.prompt(id, 'Premier')
    // Le dossier de l'historique devient un fichier : toute écriture échoue.
    const dir = join(env.root, 'conversations')
    execFileSync('rm', ['-rf', dir])
    writeFileSync(dir, '')
    await app.manager.prompt(id, 'Deuxième')
    await app.manager.prompt(id, 'Troisième')
    await app.manager.settled()
    const notices = app.manager
      .view(id)
      .transcript.items.filter((i) => i.kind === 'notice' && i.level === 'error')
    // Un avis par type d'écriture (index, fil), pas un par écriture.
    expect(notices.map((n) => n.kind === 'notice' && noticeText(n).split('\u00a0:')[0])).toEqual([
      'Impossible d’enregistrer l’historique',
      'Impossible d’enregistrer la conversation'
    ])
    expect(() => app.manager.stopAll()).not.toThrow()
  })

  it('agent sans historique : après redémarrage, session neuve qui reçoit l’échange (ADR-0030)', async () => {
    const env = environment(['--sans-historique'])
    const app1 = env.launch()
    const id = app1.manager.state().activeId
    await app1.manager.startActive()
    await app1.manager.prompt(id, 'Question')
    app1.manager.stopAll()

    // Deux redémarrages sans écrire : un seul repère.
    for (let i = 0; i < 2; i++) {
      const app = env.launch()
      app.manager.select(id)
      await waitFor(() => app.status(id) === 'ready')
      expect(kinds(app.manager.view(id))).toEqual(['user', 'agent', 'handover'])
      app.manager.stopAll()
      await app.manager.settled()
    }

    const app3 = env.launch()
    app3.manager.select(id)
    await waitFor(() => app3.status(id) === 'ready')
    await app3.manager.prompt(id, '/scenario contexte-recu')
    const last = app3.manager.view(id).transcript.items.at(-1)
    expect(last?.kind === 'agent' && last.text).toContain('Contexte reçu : 1 message(s)')
    expect(kinds(app3.manager.view(id))).toEqual(['user', 'agent', 'handover', 'user', 'agent'])
    app3.manager.stopAll()
  })

  it('agent retiré de l’app : sa conversation reste lisible, sans être rouverte par un autre agent', async () => {
    const env = environment()
    const app1 = env.launch()
    const draft = app1.manager.state().activeId
    await app1.manager.startActive()
    const { summary } = await app1.manager.configure(draft, { profileId: 'refus' })
    await app1.manager.prompt(summary.id, 'Question')
    app1.manager.stopAll()

    const app2 = env.launch({ only: ['texte'] })
    const view = app2.manager.select(summary.id)
    expect(view.snapshot?.status).toBe('read-only')
    expect(view.snapshot?.detail).toContain('«\u00a0refus\u00a0» n’est plus proposé')
    expect(kinds(view)).toEqual(['user', 'agent', 'notice'])
    await expect(app2.manager.prompt(summary.id, 'Encore')).rejects.toThrow('n’est plus proposé')
    expect(app2.manager.state().conversations.find((c) => c.id === summary.id)?.status).toBe(
      'stopped'
    )
    app2.manager.stopAll()
  })

  it('changer d’agent : conversation commencée → nouvelle ; conversation vide → reconfigurée', async () => {
    const { launch } = environment()
    const { manager, ready } = launch()
    const first = manager.state().activeId
    await manager.startActive()

    const reconfigured = await manager.configure(first, { profileId: 'refus' })
    expect(manager.state().conversations).toHaveLength(1)
    expect(reconfigured.summary.profileId).toBe('refus')

    const id = reconfigured.summary.id
    await manager.prompt(id, 'Bonjour')
    const other = await manager.configure(id, { profileId: 'texte' })
    expect(other.summary.id).not.toBe(id)
    expect(manager.view(id).summary.profileId).toBe('refus')
    expect(manager.state().conversations).toHaveLength(2)
    await ready(other.summary.id)
    manager.stopAll()
  })

  it('titre proposé par l’agent ; renommage prioritaire ; suppression', async () => {
    const env = environment()
    const { manager } = env.launch()
    const id = (await manager.configure(manager.state().activeId, { profileId: 'titres' })).summary
      .id
    await manager.prompt(id, 'Renommer les fichiers')
    expect(manager.view(id).summary.title).toBe('Factice : Renommer les fichiers')

    manager.rename(id, 'Mon titre')
    expect(manager.view(id).summary.title).toBe('Mon titre')
    await manager.prompt(id, 'Encore')
    expect(manager.view(id).summary.title).toBe('Mon titre')

    const state = await manager.delete(id)
    expect(state.conversations.some((c) => c.id === id)).toBe(false)
    expect(state.conversations[0]?.draft).toBe(true)
    const index = JSON.parse(readFileSync(join(env.root, 'conversations', 'index.json'), 'utf8'))
    expect(index).toEqual([])
    manager.stopAll()
  })

  it('supprimer : à la corbeille avec son fil à jour, restaurée telle quelle (fiche 196)', async () => {
    const env = environment()
    const app = env.launch()
    const id = app.manager.state().activeId
    await app.manager.startActive()
    await app.manager.prompt(id, 'À ne pas perdre')
    const dir = join(env.root, 'conversations')
    await app.manager.delete(id, { fromAgent: false })
    expect(existsSync(join(dir, `${id}.json`))).toBe(false)
    const trashed = JSON.parse(readFileSync(join(dir, '.trash', `${id}.json`), 'utf8'))
    expect(trashed.items[0]).toMatchObject({ kind: 'user', text: 'À ne pas perdre' })
    expect(trashed.record).toMatchObject({ id })
    const trash = new ConversationTrash(dir)
    expect(trash.list()).toEqual([
      expect.objectContaining({ id, title: expect.any(String), erasedAt: expect.any(String) })
    ])
    // Aucune écriture tardive ne fait revenir le fil supprimé.
    await app.manager.settled()
    expect(existsSync(join(dir, `${id}.json`))).toBe(false)

    const state = app.manager.restoreFromTrash(id)
    expect(state.conversations.some((c) => c.id === id)).toBe(true)
    expect(trash.list()).toEqual([])
    expect(kinds(app.manager.view(id))).toEqual(['user', 'agent'])
    // Session gardée chez l'agent : rien à dire dans le fil.
    expect(app.manager.view(id).transcript.items.some((i) => i.kind === 'notice')).toBe(false)
    app.manager.stopAll()
    // Après un redémarrage, elle est toujours là.
    const app2 = env.launch()
    expect(app2.manager.state().conversations.some((c) => c.id === id)).toBe(true)
    app2.manager.stopAll()
  })

  it('supprimée aussi chez l’agent : restaurée, elle continuera dans une session neuve et le dit', async () => {
    const env = environment()
    const app = env.launch()
    const id = app.manager.state().activeId
    await app.manager.startActive()
    await app.manager.prompt(id, 'Bonjour')
    await app.manager.delete(id, { fromAgent: true })
    app.manager.restoreFromTrash(id)
    const view = app.manager.view(id)
    const notice = view.transcript.items.at(-1)
    expect(notice?.kind === 'notice' && noticeText(notice)).toContain('session neuve')
    // Effacée pour de bon : plus rien sur le disque.
    await app.manager.delete(id, { fromAgent: false })
    new ConversationTrash(join(env.root, 'conversations')).erase(id)
    expect(readdirSync(join(env.root, 'conversations', '.trash'))).toEqual([])
    app.manager.stopAll()
  })

  it('profil en lecture seule (relecture) : supprimer est refusé, le fil reste intact', async () => {
    const env = environment()
    const app = env.launch()
    const id = app.manager.state().activeId
    await app.manager.startActive()
    await app.manager.prompt(id, 'À garder')
    app.manager.stopAll()
    const file = join(env.root, 'conversations', `${id}.json`)
    const before = readFileSync(file, 'utf8')
    setReadOnlyProfile(env.root)
    try {
      const ro = env.launch()
      await expect(ro.manager.delete(id, { fromAgent: true })).rejects.toThrow(
        /Lecture seule|Read-only/
      )
      expect(ro.manager.state().conversations.some((c) => c.id === id)).toBe(true)
      expect(readFileSync(file, 'utf8')).toBe(before)
      expect(existsSync(join(env.root, 'conversations', '.trash'))).toBe(false)
      expect(() => ro.manager.restoreFromTrash('x')).toThrow()
      // Défense en profondeur : un envoi direct au gestionnaire est refusé aussi.
      guardPrompts(ro.manager, () => true)
      await expect(ro.manager.prompt(id, 'Perdu ?')).rejects.toThrow(/Lecture seule|Read-only/)
      ro.manager.stopAll()
    } finally {
      setReadOnlyProfile(undefined)
    }
  })

  it('index et copie perdus (fiche 197) : la liste est refaite à partir des fils', async () => {
    const env = environment()
    const app = env.launch()
    const id = app.manager.state().activeId
    await app.manager.startActive()
    await app.manager.prompt(id, 'Conversation à retrouver')
    app.manager.rename(id, 'Titre choisi')
    await app.manager.prompt(id, 'Encore')
    app.manager.stopAll()
    const dir = join(env.root, 'conversations')
    rmSync(join(dir, 'index.json'))
    rmSync(join(dir, 'index.json.bak'))
    const app2 = env.launch()
    const found = app2.manager.state().conversations.find((c) => c.id === id)
    expect(found).toMatchObject({ title: 'Titre choisi', workspace: env.workspaceA })
    expect(kinds(app2.manager.view(id))).toEqual(['user', 'agent', 'user', 'agent'])
    app2.manager.stopAll()
  })

  it('titre de l’agent sans ce que l’app joint ; branche : le titre de l’app reste (fiche 125)', async () => {
    const env = environment()
    const { manager } = env.launch()
    const id = (await manager.configure(manager.state().activeId, { profileId: 'titres-bob' }))
      .summary.id
    await manager.prompt(id, 'Renommer les fichiers')
    await waitFor(() => manager.view(id).summary.title === 'Renommer les fichiers')
    const first = manager.view(id).transcript.items.find((i) => i.kind === 'user')
    if (!first) throw new Error('message absent')

    // La branche reçoit l'échange repris après son message : l'agent la titre « /scenario echo
    // This conversation continues… » ; le titre de l'app (original · branche) reste.
    const view = await manager.branch(id, first.id, '/scenario echo')
    const branch = view.summary.id
    await waitFor(() =>
      manager
        .view(branch)
        .transcript.items.some((i) => i.kind === 'agent' && i.text.includes('earlier_conversation'))
    )
    expect(manager.view(branch).summary.title).toBe('Renommer les fichiers · branche')
    expect(manager.view(branch).transcript.items.find((i) => i.kind === 'branch')).toMatchObject({
      fromTitle: 'Renommer les fichiers'
    })
    manager.stopAll()
  })

  it('consommation résumée dans l’index (fiche 109) : liste sans relire le fil, ancien fil rattrapé', async () => {
    const env = environment()
    const app1 = env.launch()
    const id = app1.manager.state().activeId
    await app1.manager.startActive()
    await app1.manager.prompt(id, 'Un')
    await app1.manager.prompt(id, 'Deux')
    const usage = app1.manager.state().conversations.find((c) => c.id === id)?.usage
    // L'agent factice : 0,0125 $US par tour, des jetons à chaque réponse.
    expect(usage).toMatchObject({ turns: 2, cost: { amount: 0.025, currency: 'USD' } })
    expect(usage?.total).toBeGreaterThan(0)
    expect(app1.manager.view(id).transcript.usage?.turns).toHaveLength(2)
    app1.manager.stopAll()
    await app1.manager.settled()

    const file = join(env.root, 'conversations', 'index.json')
    const index = JSON.parse(readFileSync(file, 'utf8')) as { id: string; usage?: unknown }[]
    expect(index.find((r) => r.id === id)?.usage).toEqual(usage)
    const app2 = env.launch()
    expect(app2.manager.state().conversations.find((c) => c.id === id)?.usage).toEqual(usage)
    app2.manager.stopAll()

    // Conversation d'avant la fiche : pas de résumé dans l'index, calculé à la lecture du fil.
    writeFileSync(file, JSON.stringify(index.map(({ usage: _u, ...record }) => record)))
    const app3 = env.launch()
    expect(app3.manager.state().conversations.find((c) => c.id === id)?.usage).toBeUndefined()
    app3.manager.view(id)
    expect(app3.lists.at(-1)?.conversations.find((c) => c.id === id)?.usage).toEqual(usage)
    app3.manager.stopAll()
  })

  it('recherche dans le contenu, épinglage mémorisé après redémarrage', async () => {
    const env = environment()
    const app1 = env.launch()
    const id = app1.manager.state().activeId
    await app1.manager.startActive()
    await app1.manager.prompt(id, 'La migration vers Postgres échoue')
    const [hit] = await app1.manager.search('POSTGRES echoue')
    expect(hit?.id).toBe(id)
    expect(hit?.snippet).toContain('Postgres')
    expect(await app1.manager.search('absent du fil')).toEqual([])
    app1.manager.setPinned(id, true)
    expect(app1.manager.view(id).summary.pinned).toBe(true)
    app1.manager.stopAll()

    const app2 = env.launch()
    expect(app2.manager.state().conversations.find((c) => c.id === id)?.pinned).toBe(true)
    app2.manager.setPinned(id, false)
    expect(app2.manager.view(id).summary.pinned).toBeUndefined()
    app2.manager.stopAll()
  })

  it('recherche sans charger les fils (fiche 046) : rien gardé, boucle d’évènements libre, cache ensuite', async () => {
    const env = environment()
    const dir = join(env.root, 'conversations')
    const store = new ConversationStore(dir)
    // Dix conversations de 0,7 Mo de texte chacune (le cache en garde 16 M caractères, texte plié
    // compris), enregistrées par une session précédente.
    const ids = Array.from({ length: 10 }, (_, i) => `ancienne-${i}`)
    const filler = 'Réponse détaillée. '.repeat(190)
    ids.forEach((id, i) => {
      const fil: TranscriptState = {
        items: [
          { kind: 'user', id: 1, text: i === 3 ? 'Où est l’aiguille dans la botte ?' : 'Bonjour' },
          ...Array.from({ length: 200 }, (_, j) => ({
            kind: 'agent' as const,
            id: j + 2,
            text: filler
          }))
        ],
        nextId: 202
      }
      store.saveTranscript(id, fil)
    })
    expect(JSON.stringify(store.loadTranscript('ancienne-0')).length).toBeGreaterThan(700_000)
    store.saveIndex(
      ids.map((id, i) => ({
        id,
        title: `Ancienne ${i}`,
        titleSource: 'message' as const,
        profileId: 'texte',
        workspace: env.workspaceA,
        createdAt: `2026-10-0${i % 9}T10:00:00.000Z`,
        updatedAt: `2026-10-0${i % 9}T10:00:00.000Z`
      }))
    )

    const { manager } = env.launch()
    let maxGap = 0
    let last = Date.now()
    const probe = setInterval(() => {
      const now = Date.now()
      maxGap = Math.max(maxGap, now - last)
      last = now
    }, 5)
    const hits = await manager.search('aiguille botte')
    clearInterval(probe)
    expect(hits.map((h) => h.id)).toEqual(['ancienne-3'])
    // Aucun fil gardé en mémoire, et la boucle d'évènements a tourné entre deux fichiers.
    expect(manager.loadedTranscripts()).toEqual([])
    expect(maxGap).toBeLessThan(100)

    // Deuxième recherche : plus aucune lecture de fil.
    const read = vi.spyOn(ConversationStore.prototype, 'readTranscriptAsync')
    expect((await manager.search('aiguille')).map((h) => h.id)).toEqual(['ancienne-3'])
    expect(read).not.toHaveBeenCalled()
    read.mockRestore()
    manager.stopAll()
  })

  it('fils libérés quand plus rien ne les montre (fiche 046), relus identiques ; jamais avant d’être écrits', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const env = environment()
    const dir = join(env.root, 'conversations')
    const { manager, ready } = env.launch({ maxLive: 1, maxIdleTranscripts: 0 })
    const first = manager.state().activeId
    await manager.startActive()
    await manager.prompt(first, 'Premier sujet')
    const before = manager.view(first).transcript.items

    // Une autre conversation : l'agent de la première est arrêté (une seule place), son fil libéré
    // une fois écrit.
    const second = (await manager.create()).summary.id
    await ready(second)
    // Les derniers évènements d'état sont écrits dans la seconde (fiche 041) : libéré ensuite.
    await waitFor(() => !manager.loadedTranscripts().includes(first))
    expect(manager.view(first).transcript.items).toEqual(before)

    // Écriture impossible : le fil, plus frais que le disque, reste en mémoire.
    manager.select(first)
    await ready(first)
    chmodSync(dir, 0o500)
    try {
      await manager.prompt(first, 'Deuxième sujet')
      const third = (await manager.create({ profileId: 'titres' })).summary.id
      await ready(third)
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await manager.settled()
      expect(manager.loadedTranscripts()).toContain(first)
    } finally {
      chmodSync(dir, 0o700)
    }
    // À la fermeture, il est écrit : rien n'est perdu.
    manager.stopAll()
    expect(readFileSync(join(dir, `${first}.json`), 'utf8')).toContain('Deuxième sujet')
    vi.restoreAllMocks()
  })

  it('suppression d’une conversation arrêtée : session supprimée chez l’agent, ou gardée à la demande', async () => {
    const env = environment()
    const app1 = env.launch()
    const first = app1.manager.state().activeId
    await app1.manager.startActive()
    await app1.manager.prompt(first, 'Première')
    const second = (await app1.manager.create()).summary.id
    await app1.ready(second)
    await app1.manager.prompt(second, 'Seconde')
    const sessionOf = (id: string) => {
      const index = JSON.parse(readFileSync(join(env.root, 'conversations', 'index.json'), 'utf8'))
      return (index as { id: string; sessionId: string }[]).find((r) => r.id === id)?.sessionId
    }
    const stored = (sessionId?: string) =>
      existsSync(join(env.root, 'mock-store', `${sessionId}.json`))
    const firstSession = sessionOf(first)
    const secondSession = sessionOf(second)
    expect(stored(firstSession) && stored(secondSession)).toBe(true)
    app1.manager.stopAll()

    // Nouvelle instance : aucun agent ne tourne pour ces conversations.
    const app2 = env.launch()
    await app2.manager.delete(first)
    expect(stored(firstSession)).toBe(false)
    await app2.manager.delete(second, { fromAgent: false })
    expect(stored(secondSession)).toBe(true)
    expect(app2.manager.state().conversations.filter((c) => !c.draft)).toEqual([])
    app2.manager.stopAll()
  })

  it('conversation dans un worktree : branche à part, suppression avec le worktree', async () => {
    const env = environment()
    const repo = realpathSync(env.workspaceA)
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
        cwd: repo,
        encoding: 'utf8'
      }).trim()
    writeFileSync(join(repo, 'README.md'), 'un\n')
    git('init', '-q', '-b', 'main')
    git('add', '.')
    git('commit', '-q', '-m', 'init')

    const app = env.launch()
    expect(app.manager.settingsView().inGitRepo).toBe(true)
    const view = await app.manager.createInWorktree(app.manager.state().activeId)
    const id = view.summary.id
    expect(view.summary.branch).toMatch(/^bobine\//)
    expect(view.summary.workspace.startsWith(join(repo, '.worktrees'))).toBe(true)
    // Départ explicite (fiche 117) : un seul élément en tête du fil, plus d'avis.
    expect(view.transcript.items).toEqual([
      {
        kind: 'worktree-start',
        id: 1,
        branch: 'main',
        commit: git('rev-parse', 'HEAD'),
        date: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
        subject: 'init'
      }
    ])
    // Le dossier du worktree ne remplace pas le dossier par défaut des nouvelles conversations.
    expect(app.manager.settingsView().recentWorkspaces).not.toContain(view.summary.workspace)
    await app.ready(id)
    await app.manager.prompt(id, 'Dans le worktree')
    writeFileSync(join(view.summary.workspace, 'nouveau.txt'), 'x\n')
    expect(await app.manager.worktreeStatus(id)).toMatchObject({ dirty: 1, ahead: 0 })

    const after = await app.manager.delete(id, { removeWorktree: true })
    expect(existsSync(view.summary.workspace)).toBe(false)
    expect(git('branch', '--list', 'bobine/*')).toBe('')
    // La conversation qui la remplace repart dans le dépôt principal.
    expect(app.manager.view(after.activeId).summary.workspace).toBe(repo)

    // Conversation en worktree jamais commencée : le worktree part avec l'app.
    const unused = await app.manager.createInWorktree(app.manager.state().activeId)
    expect(existsSync(unused.summary.workspace)).toBe(true)
    app.manager.stopAll()
    expect(existsSync(unused.summary.workspace)).toBe(false)
    expect(git('branch', '--list', 'bobine/*')).toBe('')
  })

  it('nettoyage d’un worktree (0.9.1, D21) : la conversation suivante part du dépôt, jamais d’un dossier disparu', async () => {
    const env = environment()
    const repo = realpathSync(env.workspaceA)
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
        cwd: repo,
        encoding: 'utf8'
      }).trim()
    writeFileSync(join(repo, 'README.md'), 'un\n')
    git('init', '-q', '-b', 'main')
    git('add', '.')
    git('commit', '-q', '-m', 'init')
    const app = env.launch()
    const view = await app.manager.createInWorktree(app.manager.state().activeId)
    const id = view.summary.id
    await app.ready(id)
    await app.manager.prompt(id, 'Dans le worktree')
    // « Nettoyer » : la conversation ressort du worktree (archivée), puis il est supprimé.
    const worktree = app.manager.leaveWorktree(id)
    await new Worktrees(gitCommand).remove(worktree, { force: true })
    expect(existsSync(view.summary.workspace)).toBe(false)
    // La conversation affichée à sa place part du dépôt principal, pas du worktree supprimé.
    const shown = app.manager.state().activeId
    expect(shown).not.toBe(id)
    expect(app.manager.view(shown).summary.workspace).toBe(repo)
    // « Nouvelle conversation » ensuite : dans le dépôt aussi.
    const next = await app.manager.create()
    expect(next.summary.workspace).toBe(repo)
    app.manager.stopAll()
  })

  it('dossier hérité disparu : la nouvelle conversation repart d’un dossier qui existe, et le dit (0.9.1, D21)', async () => {
    const env = environment()
    const app = env.launch()
    const gone = realpathSync(mkdtempSync(join(tmpdir(), 'ws-gone-')))
    await app.manager.create({ workspace: gone })
    rmSync(gone, { recursive: true, force: true })
    const next = await app.manager.create()
    expect(next.summary.workspace).not.toBe(gone)
    expect(existsSync(next.summary.workspace)).toBe(true)
    const notice = next.transcript.items.find((i) => i.kind === 'notice')
    expect(notice && noticeText(notice)).toContain(gone)
    // Sans dossier par défaut : jamais un dossier récent (un autre projet), l'app demande le dossier.
    const strict = env.launch({ defaultWorkspace: null })
    await strict.manager.create({ workspace: env.workspaceB })
    const vanishing = realpathSync(mkdtempSync(join(tmpdir(), 'ws-gone-')))
    await strict.manager.create({ workspace: vanishing })
    rmSync(vanishing, { recursive: true, force: true })
    expect(strict.manager.settingsView().recentWorkspaces).toContain(env.workspaceB)
    expect((await strict.manager.create()).summary.workspace).toBe('')
    strict.manager.stopAll()
    // Demandé explicitement, un dossier introuvable reste refusé.
    await expect(app.manager.create({ workspace: gone })).rejects.toThrow(gone)
    // « Nouveau worktree » depuis un dossier disparu : refusé tout de suite, avec le dossier.
    const started = Date.now()
    await expect(new Worktrees(gitCommand).create(gone)).rejects.toThrow(gone)
    expect(Date.now() - started).toBeLessThan(1000)
    app.manager.stopAll()
  })

  it('worktree préparé (fiche 175) : fichier ignoré copié, premier message après la commande, échec dit à l’agent', async () => {
    const env = environment()
    const repo = realpathSync(env.workspaceA)
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
        cwd: repo,
        encoding: 'utf8'
      }).trim()
    writeFileSync(join(repo, '.gitignore'), '.env\n')
    writeFileSync(join(repo, '.worktreeinclude'), '.env\n')
    mkdirSync(join(repo, '.bobine'))
    writeFileSync(
      join(repo, '.bobine', 'worktree.json'),
      JSON.stringify({ setup: 'sleep 1; echo préparé > prepared.txt; exit 4' })
    )
    git('init', '-q', '-b', 'main')
    git('add', '.')
    git('commit', '-q', '-m', 'init')
    writeFileSync(join(repo, '.env'), 'SECRET=1\n')

    const approvals = { approved: vi.fn(() => true), approve: vi.fn() }
    const preparation = new WorktreePreparation({
      run: queuedGit(gitCommand),
      approvals,
      env: () => process.env,
      log: { info: () => {}, warn: () => {} }
    })
    const app = env.launch({ only: ['titres'] })
    connectWorktreePreparation(app.manager, preparation)
    const view = await app.manager.createInWorktree(app.manager.state().activeId)
    const id = view.summary.id
    // Retenu pendant la préparation (dit sur la carte, ou par un avis avant elle), envoyé à sa fin.
    await app.manager.prompt(id, 'Dans le worktree préparé')
    const hasReply = () => app.manager.view(id).transcript.items.some((i) => i.kind === 'agent')
    await waitFor(() => app.manager.view(id).transcript.items.some((i) => i.kind === 'user'))
    await waitFor(() => app.status(id) === 'ready' && hasReply())
    const worktree = view.summary.workspace
    expect(readFileSync(join(worktree, '.env'), 'utf8')).toBe('SECRET=1\n')
    expect(readFileSync(join(worktree, 'prepared.txt'), 'utf8').trim()).toBe('préparé')
    const items = app.manager.view(id).transcript.items
    expect(items.filter((i) => i.kind === 'worktree-setup')).toEqual([
      expect.objectContaining({
        kind: 'worktree-setup',
        state: 'failed',
        exitCode: 4,
        command: 'sleep 1; echo préparé > prepared.txt; exit 4',
        copy: { count: 1, files: ['.env'], skipped: 0, truncated: 0 }
      })
    ])
    // La carte vient avant le message ; l'agent reçoit la ligne de contexte de l'échec.
    const kinds = items.map((i) => i.kind)
    expect(kinds.indexOf('worktree-setup')).toBeLessThan(kinds.indexOf('user'))
    expect(JSON.stringify(items)).toContain('failed with exit code 4')
    app.manager.stopAll()
  })

  it('conversation ouverte à côté : vivante sans être active, jamais arrêtée pour faire de la place', async () => {
    const env = environment()
    const { manager, ready } = env.launch({ maxLive: 1 })
    const first = manager.state().activeId
    await manager.startActive()
    await manager.prompt(first, 'Première')
    const second = (await manager.create()).summary.id
    await ready(second)
    await manager.prompt(second, 'Seconde')

    manager.open(first)
    await ready(first)
    expect(manager.state().activeId).toBe(second)
    expect(manager.shownIds()).toEqual([second, first])
    await manager.prompt(first, 'À côté')
    expect(manager.view(first).summary.status).toBe('ready')
    expect(manager.view(second).summary.status).toBe('ready')

    manager.release(first)
    expect(manager.shownIds()).toEqual([second])
    manager.stopAll()
  })

  it('au plus maxLive agents vivants : les plus anciens s’arrêtent et se rouvrent à la demande', async () => {
    const { launch } = environment()
    const { manager, ready } = launch({ maxLive: 2 })
    const ids: string[] = []
    let id = manager.state().activeId
    await manager.startActive()
    for (const text of ['Un', 'Deux', 'Trois']) {
      await manager.prompt(id, text)
      ids.push(id)
      id = (await manager.create()).summary.id
    }
    await ready(id)
    const statuses = Object.fromEntries(manager.state().conversations.map((c) => [c.id, c.status]))
    expect(statuses[ids[0] ?? '']).toBe('stopped')
    expect(statuses[ids[1] ?? '']).toBe('stopped')

    manager.select(ids[0] ?? '')
    await ready(ids[0] ?? '')
    expect(kinds(manager.view(ids[0] ?? ''))).toEqual(['user', 'agent'])
    manager.stopAll()
  })

  it('arrêter une réponse le dit au fil, pour les outils qui échouent ensuite (fiche 126)', async () => {
    const env = environment(['--delay', '2'])
    const app = env.launch()
    const id = app.manager.state().activeId
    await app.manager.startActive()
    await app.manager.cancel(id)
    const long = app.manager.prompt(id, '/scenario lent')
    await waitFor(() => app.status(id) === 'busy')
    await app.manager.cancel(id)
    await long.catch(() => {})
    const cancels = app.events.filter(
      (e) => e.conversationId === id && e.event.type === 'cancel-requested'
    )
    // Au repos, rien à interrompre : seul l'arrêt pendant la réponse compte.
    expect(cancels).toHaveLength(1)
    app.manager.stopAll()
  })

  it('mise en veille puis réveil (fiche 103) : le fil de l’app est gardé, réponse interrompue comprise', async () => {
    const env = environment(['--delay', '2'])
    const app = env.launch({ maxLive: 1 })
    const id = app.manager.state().activeId
    await app.manager.startActive()
    const long = app.manager.prompt(id, '/scenario lent')
    await waitFor(() => app.status(id) === 'busy')
    await app.manager.cancel(id)
    await long.catch(() => {})
    await waitFor(() => app.status(id) === 'ready')
    const before = app.manager.view(id).transcript.items
    // L'avis « Réponse interrompue » n'existe que dans le fil de l'app : l'agent ne le rejoue pas.
    expect(before.map((i) => i.kind)).toEqual(['user', 'agent', 'notice'])

    // Une autre conversation prend la place du seul agent gardé vivant.
    const second = (await app.manager.create({ workspace: env.workspaceB })).summary.id
    await app.ready(second)
    await app.manager.prompt(second, 'Autre sujet')
    const listed = () => app.manager.state().conversations.find((c) => c.id === id)?.status
    await waitFor(() => listed() === 'stopped')

    app.manager.select(id)
    await app.ready(id)
    await app.manager.settled()
    expect(app.manager.view(id).transcript.items).toEqual(before)
    await app.manager.prompt(id, 'On continue')
    expect(kinds(app.manager.view(id))).toEqual(['user', 'agent', 'notice', 'user', 'agent'])
    app.manager.stopAll()
  })

  /** Une conversation au repos par message, puis une nouvelle (active) : autant d'agents plus un. */
  async function liveConversations(
    app: ReturnType<ReturnType<typeof environment>['launch']>,
    texts = ['Un', 'Deux', 'Trois']
  ) {
    const ids: string[] = []
    let id = app.manager.state().activeId
    await app.manager.startActive()
    for (const text of texts) {
      await app.manager.prompt(id, text)
      ids.push(id)
      id = (await app.manager.create()).summary.id
    }
    await app.ready(id)
    const status = (conversation: string) =>
      app.manager.state().conversations.find((c) => c.id === conversation)?.status
    return { ids, active: id, statuses: () => ids.map(status) }
  }

  it('réglage « Conversations gardées actives » (fiche 102) : en baissant, les agents en trop sont mis en veille aussitôt ; en montant, rien ne s’arrête', async () => {
    const released: string[] = []
    const app = environment().launch({
      onReleased: (id, reason) => released.push(`${reason}:${id}`)
    })
    expect(app.manager.settings.preferences().maxLive).toBe(6)
    app.manager.settings.setPreferences({ maxLive: 4 })
    const { ids, statuses } = await liveConversations(app)
    expect(statuses()).toEqual(['ready', 'ready', 'ready'])

    // Baisse à 2 : les deux plus anciennes au repos, tout de suite, et la liste le dit.
    const lists = app.lists.length
    app.manager.settings.setPreferences({ maxLive: 2 })
    expect(released).toEqual([`evicted:${ids[0]}`, `evicted:${ids[1]}`])
    expect(statuses()).toEqual(['stopped', 'stopped', 'ready'])
    const last = app.lists.at(-1)?.conversations.find((c) => c.id === ids[0])
    expect(app.lists.length).toBeGreaterThan(lists)
    expect(last?.status).toBe('stopped')

    // Hausse : aucun agent ne redémarre de lui-même, aucun ne s'arrête.
    app.manager.settings.setPreferences({ maxLive: 4 })
    expect(statuses()).toEqual(['stopped', 'stopped', 'ready'])
    // Rouverte, la plus ancienne reprend son agent sans en mettre une autre en veille.
    app.manager.select(ids[0] ?? '')
    await app.ready(ids[0] ?? '')
    expect(released).toEqual([`evicted:${ids[0]}`, `evicted:${ids[1]}`])
    expect(statuses()).toEqual(['ready', 'stopped', 'ready'])
    // Un autre réglage changé (même plafond) : rien ne bouge.
    app.manager.settings.setPreferences({ maxChildren: 3 })
    expect(released).toHaveLength(2)
    app.manager.stopAll()
  })

  it('baisse du réglage (fiche 102) : affichée, à côté, occupée et gardée restent vivantes, quitte à dépasser', async () => {
    const kept = new Set<string>()
    const app = environment().launch({ keepLive: (id) => kept.has(id) })
    const { ids, active, statuses } = await liveConversations(app, [
      'Un',
      'Deux',
      'Trois',
      'Quatre'
    ])
    const [busy, keptId, beside] = ids as [string, string, string, string]
    // Occupée : un tour qui attend une autorisation.
    const turn = app.manager.prompt(busy, '/scenario permission')
    await waitFor(() => app.status(busy) === 'busy')
    // Gardée : une fille en cours ou une mère qui attend ses filles (option `keepLive`).
    kept.add(keptId)
    // À côté : ouverte dans la vue côte à côte.
    app.manager.open(beside)
    expect(statuses()).toEqual(['busy', 'ready', 'ready', 'ready'])

    // Cinq agents, plafond à 2 : seule la quatrième, au repos, laisse sa place.
    app.manager.settings.setPreferences({ maxLive: 2 })
    expect(statuses()).toEqual(['busy', 'ready', 'ready', 'stopped'])
    expect(app.status(active)).toBe('ready')

    // La demande d'autorisation arrive après « occupée » : on l'attend plutôt que de la supposer là.
    await waitFor(() => app.events.some((e) => e.event.type === 'permission-request'))
    const request = app.events.find((e) => e.event.type === 'permission-request')?.event
    if (request?.type !== 'permission-request') throw new Error('pas de demande')
    app.manager.respondPermission(busy, request.requestId, null)
    await turn
    app.manager.stopAll()
  })

  it('BOBINE_MAX_LIVE (option `maxLive`) l’emporte sur le réglage (fiche 102)', async () => {
    const app = environment().launch({ maxLive: 3 })
    app.manager.settings.setPreferences({ maxLive: 12 })
    const { statuses } = await liveConversations(app)
    // Plafond imposé à 3 malgré le réglage à 12 : la plus ancienne est en veille.
    expect(statuses()).toEqual(['stopped', 'ready', 'ready'])
    // Le réglage baissé ne change rien non plus.
    app.manager.settings.setPreferences({ maxLive: 2 })
    expect(statuses()).toEqual(['stopped', 'ready', 'ready'])
    app.manager.stopAll()
  })

  it('réglage choisi : mémorisé pour le profil et appliqué aux nouvelles conversations', async () => {
    const env = environment()
    const { manager, ready } = env.launch()
    const first = manager.state().activeId
    await manager.startActive()
    await manager.setControl(first, 'mode', 'ask')
    await manager.prompt(first, 'Bonjour')
    const next = (await manager.create()).summary.id
    await ready(next)
    const mode = manager.view(next).snapshot?.controls.find((c) => c.id === 'mode')
    expect(mode?.currentValue).toBe('ask')
    manager.stopAll()
  })

  it('fils lus à la demande (fiche 043) : seul l’index au démarrage ; un fil abîmé est dit dans sa conversation', async () => {
    const env = environment()
    const app1 = env.launch()
    const id = app1.manager.state().activeId
    await app1.manager.startActive()
    await app1.manager.prompt(id, 'Bonjour')
    app1.manager.stopAll()
    const file = join(env.root, 'conversations', `${id}.json`)
    writeFileSync(file, '{"items": [')

    const app2 = env.launch()
    // Pas encore demandé : le fichier abîmé est toujours en place, rien n'a été mis de côté.
    expect(app2.manager.state().conversations.find((c) => c.id === id)?.title).toBe('Bonjour')
    expect(existsSync(file)).toBe(true)
    const view = app2.manager.view(id)
    const files = readdirSync(join(env.root, 'conversations'))
    expect(files.some((f) => f.startsWith(`${id}.json.corrupt-`))).toBe(true)
    expect(view.transcript.items).toEqual([
      expect.objectContaining({ kind: 'notice', level: 'warning' })
    ])
    const [notice] = view.transcript.items
    expect(notice?.kind === 'notice' && noticeText(notice)).toContain('illisible')
    app2.manager.stopAll()
  })

  it('archivage et éviction (fiche 043) : ce qui est attaché à la conversation est libéré', async () => {
    const env = environment()
    const released: string[] = []
    const { manager, ready } = env.launch({
      maxLive: 1,
      onReleased: (id, reason) => released.push(`${reason}:${id}`)
    })
    const first = manager.state().activeId
    await manager.startActive()
    await manager.prompt(first, 'Un')
    const second = (await manager.create()).summary.id
    await ready(second)
    expect(released).toEqual([`evicted:${first}`])
    await manager.prompt(second, 'Deux')
    manager.setArchived(second, true)
    expect(released).toEqual([`evicted:${first}`, `archived:${second}`])
    manager.stopAll()
  })

  it('« Relancer » garde la file d’attente (fiche 020, levée par la 043)', async () => {
    const env = environment(['--delay', '2'])
    const app = env.launch()
    const id = app.manager.state().activeId
    await app.manager.startActive()
    const long = app.manager.prompt(id, '/scenario lent')
    await waitFor(() => app.status(id) === 'busy')
    await app.manager.prompt(id, 'En attente')
    expect(app.manager.view(id).snapshot?.queued.map((m) => m.text)).toEqual(['En attente'])
    await app.manager.restart(id)
    await app.ready(id)
    const queued = app.manager.view(id).snapshot?.queued ?? []
    expect(queued.map((m) => m.text)).toEqual(['En attente'])
    await long.catch(() => {})
    // Elle part à la demande, pas toute seule.
    await app.manager.sendNow(id, queued[0]?.id ?? '')
    await waitFor(() => app.status(id) === 'ready')
    expect(kinds(app.manager.view(id)).filter((k) => k === 'user')).toHaveLength(2)
    app.manager.stopAll()
  })

  it('annuler une modification (fiche 021, levée par la 043) : fichier remis, créé supprimé, conflit laissé', async () => {
    const env = environment()
    const app = env.launch()
    const id = app.manager.state().activeId
    const readme = join(env.workspaceA, 'README.md')
    const created = join(env.workspaceA, 'src', 'app.js')
    writeFileSync(readme, '# Projet\nVersion 1\n## Utilisation\n')
    await app.manager.startActive()
    await app.manager.prompt(id, '/scenario modifications')
    expect(readFileSync(readme, 'utf8')).toContain('Version 2')
    await expect(app.manager.revertFile(id, join(env.workspaceA, 'inconnu.txt'))).rejects.toThrow(
      'Aucune modification'
    )
    expect(await app.manager.revertFile(id, readme)).toBe('restored')
    expect(readFileSync(readme, 'utf8')).toBe('# Projet\nVersion 1\n## Utilisation\n')
    expect(await app.manager.revertFile(id, created)).toBe('restored')
    expect(existsSync(created)).toBe(false)
    // Déjà dans son état d'avant ; puis modifié par quelqu'un d'autre : pas touché.
    expect(await app.manager.revertFile(id, readme)).toBe('unchanged')
    writeFileSync(readme, 'autre chose\n')
    expect(await app.manager.revertFile(id, readme)).toBe('conflict')
    expect(readFileSync(readme, 'utf8')).toBe('autre chose\n')
    const notices = app.manager
      .view(id)
      .transcript.items.filter((i) => i.kind === 'notice')
      .map((i) => (i.kind === 'notice' ? noticeText(i) : ''))
    expect(notices).toEqual([
      'Modification annulée\u00a0: README.md est revenu à son état d’avant la conversation.',
      'Modification annulée\u00a0: src/app.js, créé par l’agent, a été supprimé.',
      'README.md n’a pas été touché\u00a0: il est déjà dans son état d’avant la conversation.',
      'README.md n’a pas été touché\u00a0: il a été modifié depuis (ou supprimé).'
    ])
    app.manager.stopAll()
  })
})

describe('ConversationManager.checkAgent (diagnostic, fiche 061)', () => {
  it('essaie l’agent hors conversation et supprime sa session d’essai', async () => {
    const env = environment()
    const { manager } = env.launch({ only: ['texte'] })
    const check = await manager.checkAgent('texte')
    expect(check.executable).toBe(process.execPath)
    expect(check.announcement?.name).toBe('Agent factice')
    expect(check.snapshot?.status).toBe('ready')
    expect(check.session).toBe('deleted')
    expect(check.workspace).toBe(env.workspaceA)
    // Rien dans l'historique de l'app, rien de neuf chez l'agent.
    expect(manager.state().conversations.filter((c) => !c.draft)).toEqual([])
    expect(await manager.agentSessions('texte')).toEqual([])
  })

  it('n’ouvre pas de session chez un agent qui ne saurait pas la supprimer, sauf sur demande', async () => {
    const env = environment(['--sans-historique'])
    const { manager } = env.launch({ only: ['texte'] })
    expect((await manager.checkAgent('texte')).session).toBe('skipped')
    const tried = await manager.checkAgent('texte', { trySession: true })
    expect(tried.snapshot?.status).toBe('ready')
    expect(tried.session).toBe('kept')
  })

  it('commande introuvable : rien n’est lancé', async () => {
    const env = environment()
    const absent: AgentProfile = {
      id: 'absent',
      label: 'Absent',
      command: 'agent-introuvable-061',
      args: [],
      env: {}
    }
    const { manager } = env.launch({ only: [], before: [absent] })
    expect(await manager.checkAgent('absent')).toEqual({ workspace: env.workspaceA })
    await expect(manager.checkAgent('inconnu')).rejects.toThrow('Agent inconnu')
  })
})

describe('ConversationManager — session des conversations vides', () => {
  it('conversation vide quittée : sa session est supprimée chez l’agent', async () => {
    const env = environment()
    const { manager, ready } = env.launch({ only: ['texte'] })
    const deletes = vi.spyOn(AgentHost.prototype, 'deleteSession')
    try {
      await manager.startActive()
      await ready(manager.state().activeId)
      // Changement de dossier avant le premier message : l'ancienne conversation vide est jetée.
      await manager.create({ workspace: env.workspaceB })
      expect(manager.state().conversations).toHaveLength(1)
      // On quitte aussitôt : la suppression en cours est attendue, celle de la nouvelle aussi.
      expect(manager.hasDraftSessions()).toBe(true)
      await manager.dropDraftSessions(2000)
      expect(deletes).toHaveBeenCalledTimes(2)
      await Promise.all(deletes.mock.results.map((r) => r.value))
      expect(manager.hasDraftSessions()).toBe(false)
    } finally {
      deletes.mockRestore()
      manager.stopAll()
    }
  })

  it('rouverte avant le premier message (autre dossier, fiche 179 D14) : l’ancienne session supprimée', async () => {
    const env = environment()
    const { manager, ready } = env.launch({ only: ['texte'] })
    const deletes = vi.spyOn(AgentHost.prototype, 'deleteSession')
    try {
      const id = manager.state().activeId
      await manager.startActive()
      await ready(id)
      await manager.restart(id)
      await manager.dropDraftSessions(2000)
      // Celle d'avant la réouverture, puis la nouvelle en quittant.
      expect(deletes).toHaveBeenCalledTimes(2)
    } finally {
      deletes.mockRestore()
      manager.stopAll()
    }
  })

  it('en quittant : session supprimée, sauf chez un agent qui ne le permet pas', async () => {
    const env = environment()
    const { manager } = env.launch({ only: ['texte'] })
    const deletes = vi.spyOn(AgentHost.prototype, 'deleteSession')
    try {
      await manager.startActive()
      expect(manager.hasDraftSessions()).toBe(true)
      await manager.dropDraftSessions(2000)
      expect(deletes).toHaveBeenCalledTimes(1)
      expect(manager.hasDraftSessions()).toBe(false)
    } finally {
      deletes.mockRestore()
      manager.stopAll()
    }

    const without = environment(['--sans-historique']).launch({ only: ['texte'] }).manager
    const none = vi.spyOn(AgentHost.prototype, 'deleteSession')
    try {
      await without.startActive()
      await without.dropDraftSessions(2000)
      expect(none).not.toHaveBeenCalled()
    } finally {
      none.mockRestore()
      without.stopAll()
    }
  })

  it('en quittant : un agent bloqué au démarrage ne retient pas l’app', async () => {
    const { manager } = environment(['--demarrage-bloque']).launch({ only: ['texte'] })
    void manager.startActive()
    await waitFor(() => manager.hasDraftSessions())
    const started = Date.now()
    await manager.dropDraftSessions(300)
    expect(Date.now() - started).toBeLessThan(2000)
    expect(manager.hasDraftSessions()).toBe(false)
    manager.stopAll()
  })
})

/** Faux chiffrement réversible des clés d'API (inversion des octets). */
const fakeCipher: Cipher = {
  available: () => Promise.resolve(true),
  encrypt: (text) => Promise.resolve(Buffer.from(`enc:${text}`).reverse()),
  decrypt: (data) =>
    Promise.resolve({ text: Buffer.from(data).reverse().toString().slice(4), reencrypt: false })
}

/**
 * Réglages tenus par le gestionnaire (fiche 089) : comportement figé avant de les sortir dans leur
 * propre module. `onSettingsChanged` est suivi de près : `index.ts` y accroche thème, langue,
 * raccourci de la fenêtre rapide, cookies du navigateur et veille.
 */
describe('ConversationManager — abonnés (fiche 089)', () => {
  it('évènements, liste et suppressions suivis après coup ; plus rien après désabonnement', async () => {
    const env = environment()
    const { manager } = env.launch({ only: ['texte'] })
    const seen = { events: 0, lists: 0, deleted: [] as string[] }
    const unsubscribe = manager.subscribe({
      event: () => seen.events++,
      list: () => seen.lists++,
      deleted: (id) => seen.deleted.push(id)
    })
    const id = manager.state().activeId
    await manager.startActive()
    await manager.prompt(id, 'Bonjour')
    expect(seen.events).toBeGreaterThan(0)
    expect(seen.lists).toBeGreaterThan(0)
    await manager.delete(id, { fromAgent: false })
    expect(seen.deleted).toEqual([id])
    unsubscribe()
    const events = seen.events
    await manager.create()
    expect(seen.events).toBe(events)
    manager.stopAll()
  })
})

describe('ConversationManager — sans dossier choisi (fiche 093)', () => {
  const settingsOf = (root: string) =>
    existsSync(join(root, 'settings.json'))
      ? (JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8')) as Record<string, unknown>)
      : {}

  it('premier lancement : aucun agent ne démarre, la carte « dossier à choisir » à la place', async () => {
    const env = environment()
    const app = env.launch({ defaultWorkspace: null, only: ['texte'] })
    const { activeId } = app.manager.state()
    const view = await app.manager.startActive()
    expect(view.snapshot).toMatchObject({
      status: 'needs-action',
      blocker: { kind: 'workspace' },
      info: { profileId: 'texte', workspace: '' }
    })
    // Pas d'hôte : aucun processus d'agent.
    expect(app.manager.state().conversations[0]).toMatchObject({ draft: true, status: 'stopped' })
    expect(app.manager.settingsView()).toMatchObject({ workspace: '', inGitRepo: false })
    await expect(app.manager.prompt(activeId, 'Bonjour')).rejects.toThrow(
      'Choisissez d’abord un dossier'
    )
    expect(() => app.manager.workspaceOf(activeId)).toThrow('Choisissez d’abord un dossier')
    const read = vi.fn(async () => ['lu'])
    expect(await app.manager.readFolder(activeId, read, [])).toEqual([])
    expect(read).not.toHaveBeenCalled()
    expect(await app.manager.rules(activeId)).toEqual([])
    expect(app.manager.state().conversations[0]?.status).toBe('stopped')
    app.manager.stopAll()
  })

  it('agent changé avant le choix : toujours rien de démarré, rien dans les récents', async () => {
    const env = environment()
    const app = env.launch({ defaultWorkspace: null, only: ['texte', 'refus'] })
    const view = await app.manager.configure(app.manager.state().activeId, { profileId: 'refus' })
    expect(view.snapshot).toMatchObject({
      status: 'needs-action',
      blocker: { kind: 'workspace' },
      info: { profileId: 'refus' }
    })
    expect(app.manager.state().conversations).toHaveLength(1)
    expect(app.manager.settingsView().recentWorkspaces).toEqual([])
    expect(settingsOf(env.root)['workspace']).toBeUndefined()
    // « Nouvelle conversation » : pareil, toujours sans dossier.
    expect((await app.manager.create()).snapshot?.blocker).toEqual({ kind: 'workspace' })
    app.manager.stopAll()
  })

  // Fiche 214, point 5 : reproduction du défaut vu au banc de la fiche 213. Avec un dossier connu
  // au lancement, l'agent par défaut démarre (`startActive`) AVANT que l'utilisateur puisse en
  // choisir un autre ; l'agent choisi ensuite remplace le brouillon, dont l'agent est arrêté. Voulu
  // par la fiche 093 (dossier choisi : l'agent démarre aussitôt, pour avoir modèles et modes) ;
  // seul le premier lancement SANS dossier ne démarre rien (essai ci-dessus). Pas corrigé : voir la
  // fiche 214 (reste à faire).
  it('dossier connu au lancement : l’agent par défaut démarre avant le choix d’un autre agent', async () => {
    const env = environment()
    const app = env.launch({ only: ['texte', 'refus'] })
    const first = app.manager.state().activeId
    await app.manager.startActive()
    await app.ready(first)
    expect(app.manager.state().conversations[0]).toMatchObject({ profileId: 'texte' })
    expect(app.status(first)).toBe('ready') // Le défaut tourne déjà : un processus et une session.
    const chosen = (await app.manager.configure(first, { profileId: 'refus' })).summary
    expect(chosen.profileId).toBe('refus')
    // Le brouillon du défaut est jeté (son agent arrêté) : un seul agent reste, celui du choix.
    expect(app.manager.state().conversations.map((c) => c.profileId)).toEqual(['refus'])
    app.manager.stopAll()
  })

  it('dossier choisi : l’agent y démarre, le dossier entre dans les récents', async () => {
    const env = environment()
    const app = env.launch({ defaultWorkspace: null, only: ['texte'] })
    await app.manager.startActive()
    const view = await app.manager.configure(app.manager.state().activeId, {
      workspace: env.workspaceB
    })
    await app.ready(view.summary.id)
    expect(app.manager.view(view.summary.id).snapshot?.info.workspace).toBe(env.workspaceB)
    expect(app.manager.settingsView().recentWorkspaces).toEqual([env.workspaceB])
    expect(settingsOf(env.root)).toMatchObject({ workspace: env.workspaceB })
    app.manager.stopAll()
  })

  it('dossier mémorisé disparu : un avis, et le dossier à choisir (plus de repli silencieux)', async () => {
    const env = environment()
    const gone = join(env.root, 'disparu')
    writeFileSync(
      join(env.root, 'settings.json'),
      JSON.stringify({ workspace: gone, recentWorkspaces: [gone] })
    )
    const app = env.launch({ defaultWorkspace: null, only: ['texte'] })
    const view = await app.manager.startActive()
    expect(view.snapshot?.blocker).toEqual({ kind: 'workspace' })
    expect(kinds(view)).toEqual(['notice'])
    app.manager.stopAll()
  })

  it('essais : sans choix, le dossier par défaut, comme avant', async () => {
    const env = environment()
    const app = env.launch({ only: ['texte'] })
    const view = await app.manager.startActive()
    await app.ready(view.summary.id)
    expect(app.manager.view(view.summary.id).snapshot?.info.workspace).toBe(env.workspaceA)
    app.manager.stopAll()
  })
})

describe('ConversationManager — réglages', () => {
  const settingsOf = (root: string) =>
    JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8')) as Record<string, unknown>

  it('préférences : valeurs par défaut, champs invalides ignorés, enregistrées, changement signalé', () => {
    const env = environment()
    const changed = vi.fn()
    const app = env.launch({ onSettingsChanged: changed })
    expect(app.manager.settings.preferences()).toMatchObject({
      theme: 'system',
      conversationFontSize: 15,
      keepAwake: true,
      browserKeepCookies: true
    })
    expect(app.manager.settings.preferences().terminalFontFamily).toBeUndefined()

    app.manager.settings.setPreferences({
      theme: 'dark',
      terminalFontFamily: 'Menlo',
      conversationFontSize: 'grand',
      inconnu: 1
    })
    const view = app.manager.settingsView()
    expect(changed).toHaveBeenCalledTimes(1)
    expect(view.preferences).toMatchObject({ theme: 'dark', terminalFontFamily: 'Menlo' })
    expect(view.preferences.conversationFontSize).toBe(15)
    expect(settingsOf(env.root)).toMatchObject({ theme: 'dark', terminalFontFamily: 'Menlo' })
    expect(settingsOf(env.root)).not.toHaveProperty('inconnu')

    // Police du terminal vidée : le champ disparaît (valeur par défaut).
    app.manager.settings.setPreferences({ terminalFontFamily: '' })
    expect(app.manager.settings.preferences().terminalFontFamily).toBeUndefined()
    expect(settingsOf(env.root)).not.toHaveProperty('terminalFontFamily')
    expect(changed).toHaveBeenCalledTimes(2)
    app.manager.stopAll()

    expect(env.launch().manager.settings.preferences().theme).toBe('dark')
  })

  it('notifications et commandes « / » personnelles : enregistrées, changement signalé', () => {
    const env = environment()
    const changed = vi.fn()
    const app = env.launch({ onSettingsChanged: changed })
    expect(app.manager.settings.notificationsEnabled()).toBe(true)
    app.manager.settings.setNotifications(false)
    expect(app.manager.settingsView().notifications).toBe(false)
    expect(app.manager.settings.notificationsEnabled()).toBe(false)
    expect(settingsOf(env.root)).toMatchObject({ notifications: false })
    expect(changed).toHaveBeenCalledTimes(1)

    const command = { name: 'revue', description: 'Relire', prompt: 'Relis le code.' }
    app.manager.settings.setCommands([command, { name: '' }])
    const view = app.manager.settingsView()
    const saved = { ...command, scope: 'global' }
    expect(view.commands).toEqual([saved])
    expect(settingsOf(env.root)['commands']).toEqual([saved])
    expect(changed).toHaveBeenCalledTimes(2)
    // Liste vide : le champ disparaît du fichier.
    app.manager.settings.setCommands([])
    expect(app.manager.settingsView().commands).toEqual([])
    expect(settingsOf(env.root)).not.toHaveProperty('commands')
    expect(changed).toHaveBeenCalledTimes(3)
    app.manager.stopAll()

    const again = env.launch().manager
    expect(again.settings.notificationsEnabled()).toBe(false)
    expect(again.settingsView().commands).toEqual([])
  })

  it('dossiers récents et nouvelle conversation : enregistrés sans signaler de changement', async () => {
    const env = environment()
    const changed = vi.fn()
    const app = env.launch({ onSettingsChanged: changed, only: ['texte'] })
    expect(app.manager.newConversationTarget()).toEqual({
      profileId: 'texte',
      profileLabel: 'Factice texte',
      workspace: env.workspaceA
    })
    await app.manager.create({ workspace: env.workspaceB })
    // Le seul changement signalé : l'annonce de l'agent, lancé pour la nouvelle conversation.
    expect(changed).toHaveBeenCalledTimes(1)
    changed.mockClear()
    expect(app.manager.settingsView().recentWorkspaces).toEqual([env.workspaceB])
    expect(settingsOf(env.root)).toMatchObject({ profileId: 'texte', workspace: env.workspaceB })

    app.manager.settings.forgetWorkspace(env.workspaceB)
    expect(app.manager.settingsView().recentWorkspaces).toEqual([])
    expect(settingsOf(env.root)['recentWorkspaces']).toEqual([])

    app.manager.settings.setNewConversation({ workspace: env.workspaceA, mode: 'plan' })
    expect(app.manager.newConversationTarget().workspace).toBe(env.workspaceA)
    expect(settingsOf(env.root)['newConversation']).toEqual({
      workspace: env.workspaceA,
      mode: 'plan'
    })
    expect(changed).not.toHaveBeenCalled()
    app.manager.stopAll()
  })

  it('outil toujours autorisé oublié : retiré du fichier, changement signalé', () => {
    const env = environment()
    writeFileSync(
      join(env.root, 'settings.json'),
      JSON.stringify({
        recentWorkspaces: [],
        rememberedTools: { texte: ['Lire', 'Chercher'], refus: ['Lire'] }
      })
    )
    const changed = vi.fn()
    const app = env.launch({ onSettingsChanged: changed })
    app.manager.settings.forgetTool('refus', 'Lire')
    expect(app.manager.settingsView().rememberedTools).toEqual([
      { profileId: 'texte', profileLabel: 'Factice texte', tools: ['Lire', 'Chercher'] }
    ])
    expect(settingsOf(env.root)['rememberedTools']).toEqual({ texte: ['Lire', 'Chercher'] })
    expect(changed).toHaveBeenCalledTimes(1)
    app.manager.stopAll()
  })

  it('clés d’API : enregistrées et retirées sans être renvoyées, refusées pour un agent qui n’en a pas', async () => {
    const env = environment()
    const changed = vi.fn()
    const apiKeys = new ApiKeyStore(join(env.root, 'api-keys.json'), fakeCipher)
    const keyed: AgentProfile = {
      ...env.mock('cle', 'streaming-texte'),
      apiKeys: [{ env: 'FACTICE_API_KEY', label: 'Clé du factice' }]
    }
    const app = env.launch({
      before: [keyed],
      onSettingsChanged: changed,
      apiKeys,
      env: { FACTICE_API_KEY: 'de-l-environnement' }
    })
    const keys = () => app.manager.settingsView().apiKeys
    expect(keys()).toEqual([
      {
        profileId: 'cle',
        profileLabel: 'Factice cle',
        keys: [
          { env: 'FACTICE_API_KEY', label: 'Clé du factice', stored: false, fromEnvironment: true }
        ]
      }
    ])
    await app.manager.settings.setApiKey('cle', 'FACTICE_API_KEY', 'secret-1')
    const view = app.manager.settingsView()
    expect(view.apiKeys[0]?.keys[0]?.stored).toBe(true)
    expect(JSON.stringify(view)).not.toContain('secret-1')
    expect(await apiKeys.credentials('cle', keyed.apiKeys ?? [])).toEqual({
      FACTICE_API_KEY: 'secret-1'
    })
    app.manager.settings.removeApiKey('cle', 'FACTICE_API_KEY')
    expect(keys()[0]?.keys[0]?.stored).toBe(false)
    expect(() => app.manager.settings.setApiKey('texte', 'FACTICE_API_KEY', 'x')).toThrow(
      'FACTICE_API_KEY'
    )
    expect(() => app.manager.settings.setApiKey('cle', 'AUTRE', 'x')).toThrow('AUTRE')

    // Saisie dans « Connexion requise » : enregistrée, l'agent de la conversation relancé avec.
    const id = app.manager.state().activeId
    await app.manager.startActive()
    await app.ready(id)
    const restarts = vi.spyOn(AgentHost.prototype, 'restart')
    try {
      await app.manager.useApiKey(id, 'FACTICE_API_KEY', 'secret-2')
      expect(restarts).toHaveBeenCalledTimes(1)
      expect(await apiKeys.credentials('cle', keyed.apiKeys ?? [])).toEqual({
        FACTICE_API_KEY: 'secret-2'
      })
    } finally {
      restarts.mockRestore()
      app.manager.stopAll()
    }
    // Le seul changement signalé : l'annonce de l'agent à son premier démarrage.
    expect(changed).toHaveBeenCalledTimes(1)

    // Sans coffre à clés : enregistrement impossible.
    const bare = env.launch({ before: [keyed] })
    expect(() => bare.manager.settings.setApiKey('cle', 'FACTICE_API_KEY', 'x')).toThrow()
    bare.manager.stopAll()
  })

  it('trousseau à la demande (fiche 100) : jamais sans clé, une seule fois avec, au lancement de l’agent', async () => {
    const env = environment()
    const keyed: AgentProfile = {
      ...env.mock('cle', 'streaming-texte'),
      apiKeys: [{ env: 'FACTICE_API_KEY', label: 'Clé du factice' }]
    }
    const counted = (): { cipher: Cipher; calls: () => number; decrypts: () => number } => {
      let calls = 0
      let decrypts = 0
      return {
        cipher: {
          available: () => (calls++, fakeCipher.available()),
          encrypt: (text) => (calls++, fakeCipher.encrypt(text)),
          decrypt: (data) => (calls++, decrypts++, fakeCipher.decrypt(data))
        },
        calls: () => calls,
        decrypts: () => decrypts
      }
    }
    const file = join(env.root, 'api-keys.json')

    // Sans clé : démarrage (vue des réglages), conversation, redémarrage de l'agent : rien.
    const empty = counted()
    const first = env.launch({ before: [keyed], apiKeys: new ApiKeyStore(file, empty.cipher) })
    const firstId = first.manager.state().activeId
    first.manager.settingsView()
    await first.manager.startActive()
    await first.ready(firstId)
    await first.manager.prompt(firstId, 'Bonjour')
    await first.manager.restart(firstId)
    await first.ready(firstId)
    first.manager.settingsView()
    expect(empty.calls()).toBe(0)
    first.manager.stopAll()

    // Une clé enregistrée (lancement précédent), puis un nouveau lancement de l'app.
    await new ApiKeyStore(file, fakeCipher).set('cle', 'FACTICE_API_KEY', 'secret')
    const keychain = counted()
    const second = env.launch({ before: [keyed], apiKeys: new ApiKeyStore(file, keychain.cipher) })
    const id = second.manager.state().activeId
    expect(second.manager.settingsView().apiKeys[0]?.keys[0]?.stored).toBe(true)
    expect(keychain.calls()).toBe(0)
    await second.manager.startActive()
    await second.ready(id)
    expect(keychain.decrypts()).toBe(1)
    await second.manager.restart(id)
    await second.ready(id)
    second.manager.settingsView()
    expect(keychain.calls()).toBe(1)
    second.manager.stopAll()
  })

  it('annonce d’un agent : changement signalé la première fois, pas quand elle est la même', async () => {
    const env = environment()
    const changed = vi.fn()
    const app1 = env.launch({ onSettingsChanged: changed, only: ['texte'] })
    await app1.manager.startActive()
    expect(changed).toHaveBeenCalledTimes(1)
    expect(settingsOf(env.root)['agentsSeen']).toHaveProperty('texte')
    app1.manager.stopAll()

    const again = vi.fn()
    const app2 = env.launch({ onSettingsChanged: again, only: ['texte'] })
    await app2.manager.startActive()
    expect(again).not.toHaveBeenCalled()
    app2.manager.stopAll()
  })

  it('réglage de session choisi : enregistré pour le profil, sans signaler de changement', async () => {
    const env = environment()
    const changed = vi.fn()
    const { manager } = env.launch({ onSettingsChanged: changed, only: ['texte'] })
    const id = manager.state().activeId
    await manager.startActive()
    changed.mockClear()
    await manager.setControl(id, 'mode', 'ask')
    expect(settingsOf(env.root)['controls']).toEqual({ texte: { mode: 'ask' } })
    expect(changed).not.toHaveBeenCalled()
    manager.stopAll()
  })
})
