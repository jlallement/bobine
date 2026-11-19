/**
 * Rôles contre l'agent factice (fiche 223) : délégation par `start_child`, rôle inconnu, lecture
 * seule (écriture demandée puis refusée, écriture faite sans demander), mode natif présent ou
 * absent, rappel des rôles quand le message en nomme un. Aucun vrai modèle.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { childState, type ChildState } from '@shared/children'
import type { TranscriptItem } from '@shared/transcript'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentProfile } from '../agent/profiles'
import { Worktrees } from '../changes/worktrees'
import type { ChildConversations, ChildOptions } from '../conversations/children'
import { setupChildren } from '../conversations/children-setup'
import { ConversationManager } from '../conversations/manager'
import { gitCommand, queuedGit } from '../git/git-queue'
import { until } from '../conversations/manager-until'
import { childrenToolsModule } from '../mcp/children-tools'
import { AppToolServer } from '../mcp/tool-server'
import { builtinRoles } from './builtin'
import { startRoleChildren } from './invoke'
import { RoleLibrary } from './library'
import { ReadOnlyWatch } from './read-only-watch'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

async function environment(extra: Pick<ChildOptions, 'nativeRoleMode'> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'roles-filles-'))
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'roles-depot-')))
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
      cwd: repo,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(repo, 'README.md'), '# Carnet\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  // Rôles du projet **non commités** : lus dans le dossier de la mère, pas dans un worktree.
  mkdirSync(join(repo, '.bobine', 'roles'), { recursive: true })
  writeFileSync(join(repo, '.git', 'info', 'exclude'), '.bobine/\n')
  const projectRole = (name: string, header: string) =>
    writeFileSync(
      join(repo, '.bobine', 'roles', `${name}.md`),
      `---\ndescription: Rôle ${name}\n${header}---\nCONSIGNE-${name.toUpperCase()}\n`
    )
  projectRole('questions', 'mode: ask\n')
  projectRole('sans-mode', 'mode: inexistant\n')
  // Rôle du projet qui remplace un rôle fourni du même nom.
  projectRole('tech-lead', 'read-only: true\n')
  const mock = (id: string, extra: Partial<AgentProfile> = {}): AgentProfile => ({
    id,
    label: `Factice ${id}`,
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', 'echo', '--delay', '0', '--store', join(root, 's')],
    env: {},
    childModelChoice: 'ask',
    ...extra
  })
  const toolServer = new AppToolServer()
  await toolServer.start()
  // Les outils et le gestionnaire lisent le module des filles, créé après le gestionnaire.
  const late: { children?: ChildConversations } = {}
  const library = new RoleLibrary({
    userDir: join(root, 'roles'),
    builtin: builtinRoles,
    off: () => new Set(),
    setEnabled: () => {}
  })
  const manager = new ConversationManager({
    profiles: [mock('mock'), mock('sans-demande', { writesWithoutAsking: true })],
    toolServer,
    toolModules: [childrenToolsModule(() => late.children)],
    roles: library,
    keepLive: (id) => late.children?.keepLive(id) ?? false,
    settingsFile: join(root, 'settings.json'),
    conversationsDir: join(root, 'conversations'),
    defaultWorkspace: repo,
    neutralFolder: repo,
    pathEnv: () => process.env['PATH'],
    worktrees: new Worktrees(queuedGit(gitCommand)),
    agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
  })
  const children = setupChildren(manager, { roles: library, ...extra })
  late.children = children
  cleanups.push(() => {
    manager.stopAll()
    toolServer.stop()
  })
  const mother = manager.state().activeId
  await manager.startActive()
  await manager.prompt(mother, 'Organise le carnet')
  // Attente sur évènement du gestionnaire (pas de sondage serré : essai stable sous charge).
  const waitFor = (predicate: () => boolean, what: string) => until(manager, predicate, what)
  const items = (id: string) => manager.view(id).transcript.items
  const lastReply = (id: string) =>
    items(id).findLast((i): i is Extract<TranscriptItem, { kind: 'agent' }> => i.kind === 'agent')
      ?.text ?? ''
  const notices = (id: string) =>
    items(id).flatMap((i) =>
      i.kind === 'notice' && typeof i.message === 'object' ? [i.message.key] : []
    )
  const firstMessage = (id: string) => items(id).find((i) => i.kind === 'user')
  const settled = async (id: string) => {
    await waitFor(
      () => lastReply(id) !== '' && manager.view(id).summary.status === 'ready',
      `réponse finie de ${id}`
    )
  }
  const cards = () =>
    items(mother).filter(
      (i): i is Extract<TranscriptItem, { kind: 'elicitation' }> =>
        i.kind === 'elicitation' && i.state === 'pending'
    )
  const accept = async () => {
    await waitFor(() => cards().length > 0, 'carte de proposition de la mère')
    const card = cards()[0]
    manager.respondElicitation(mother, card?.requestId ?? '', {
      action: 'accept',
      content: { decision: 'start' }
    })
  }
  const childrenOf = () => manager.state().conversations.filter((c) => c.startedFrom?.id === mother)
  return {
    repo,
    manager,
    children,
    mother,
    items,
    lastReply,
    notices,
    firstMessage,
    settled,
    accept,
    childrenOf,
    waitFor
  }
}

describe('rôles contre l’agent factice (fiche 223)', () => {
  it('`roles-delegue` : la fille du rôle en lecture seule, dans le dossier de la mère, avec sa consigne', async () => {
    const env = await environment()
    const turn = env.manager.prompt(env.mother, '/scenario roles-delegue')
    await env.accept()
    await turn
    await env.waitFor(() => env.childrenOf().length === 1, 'une fille')
    const child = env.childrenOf()[0]
    if (!child) throw new Error('pas de fille')
    expect(child.role).toEqual({
      name: 'security-expert',
      label: expect.any(String),
      icon: 'shield-check',
      color: 'orange',
      readOnly: true
    })
    // Lecture seule : ni worktree ni branche, le dossier de la mère.
    expect(child.branch).toBeUndefined()
    expect(child.workspace).toBe(env.repo)
    const started = env.items(env.mother).find((i) => i.kind === 'child-started')
    expect(started).toMatchObject({ role: { name: 'security-expert', readOnly: true } })
    await env.settled(child.id)
    const first = env.firstMessage(child.id)
    // La demande en tête (titre de Bob, fiche 125), la consigne du rôle après.
    expect(first?.kind === 'user' && first.text).toMatch(/\n\n<bobine_role name="security-expert">/)
    expect(first?.kind === 'user' && first.text.startsWith('<bobine_role')).toBe(false)
    const reply = env.lastReply(child.id)
    // Consigne du rôle fourni dans la langue de l'interface (ADR-0046), enveloppe en anglais.
    expect(reply).toContain('expert en sécurité applicative')
    expect(reply).toContain('Bobine refuses your write requests.')
    expect(reply).toContain('Audite le module de connexion.')
  })

  it('fille lancée : « au travail » sans interruption jusqu’à son premier tour, même avec une empreinte lente', async () => {
    const env = await environment()
    // Empreinte du dossier lente (gros dépôt, machine chargée) : la fille est prête bien avant que
    // sa consigne ne parte. Elle ne doit jamais passer par « a fini » entre-temps.
    const prepare = ReadOnlyWatch.prototype.prepare
    const slow = vi.spyOn(ReadOnlyWatch.prototype, 'prepare').mockImplementation(async function (
      this: ReadOnlyWatch,
      id: string
    ) {
      // La lenteur est le scénario essayé (empreinte lente), pas une attente de l'essai.
      // eslint-disable-next-line no-restricted-syntax -- lenteur simulée, voir au-dessus
      await new Promise((resolve) => setTimeout(resolve, 400))
      return prepare.call(this, id)
    })
    cleanups.push(() => slow.mockRestore())
    const seen: { state: ChildState; status: string; sent: boolean }[] = []
    env.manager.subscribe({
      list: (state) => {
        for (const c of state.conversations.filter((c) => c.startedFrom?.id === env.mother)) {
          seen.push({
            state: childState(c),
            status: c.status,
            sent: env.items(c.id).some((i) => i.kind === 'user')
          })
        }
      }
    })
    const child = await env.children.start(env.mother, {
      text: 'Relis le carnet.',
      role: 'code-reviewer'
    })
    await env.settled(child.id)
    expect(slow).toHaveBeenCalled()
    const beforePrompt = seen.filter((s) => !s.sent)
    // L'agent a bien été prêt avant l'envoi (la course a eu lieu), sans que la liste le montre.
    expect(beforePrompt.length).toBeGreaterThan(0)
    expect(beforePrompt.filter((s) => s.state !== 'running')).toEqual([])
    expect(seen.at(-1)?.state).toBe('done')
  })

  it('`roles-inconnu` : refusé avec la liste des rôles connus, aucune fille', async () => {
    const env = await environment()
    await env.manager.prompt(env.mother, '/scenario roles-inconnu')
    const reply = env.lastReply(env.mother)
    expect(reply).toContain('Unknown role "astronaute"')
    expect(reply).toContain('security-expert')
    expect(reply).toContain('questions')
    expect(env.childrenOf()).toEqual([])
  })

  it('lecture seule : l’écriture demandée est refusée par Bobine et dite, rien n’est écrit', async () => {
    const env = await environment()
    const child = await env.children.start(env.mother, {
      text: 'Relis.\n/scenario role-ecrit-avec-demande',
      role: 'code-reviewer'
    })
    await env.settled(child.id)
    expect(env.lastReply(child.id)).toContain('Écriture refusée : je reste en lecture seule.')
    expect(env.notices(child.id)).toContain('roles.notice.writeRefused')
    expect(existsSync(join(env.repo, 'notes.md'))).toBe(false)
    // Aucune carte d'autorisation laissée en attente.
    expect(
      env.items(child.id).some((i) => i.kind === 'tool' && i.permission?.state === 'pending')
    ).toBe(false)
  })

  it('lecture seule : demande sans `kind` après un outil annoncé `edit` → refusée (genre retenu)', async () => {
    const env = await environment()
    const child = await env.children.start(env.mother, {
      text: 'Relis.\n/scenario role-ecrit-sans-genre',
      role: 'code-reviewer'
    })
    await env.settled(child.id)
    expect(env.lastReply(child.id)).toContain('Écriture refusée')
    expect(env.notices(child.id)).toContain('roles.notice.writeRefused')
    expect(existsSync(join(env.repo, 'notes.md'))).toBe(false)
  })

  it('agent qui écrit sans demander : lecture seule seulement demandée, et l’écriture signalée', async () => {
    const env = await environment()
    const child = await env.children.start(env.mother, {
      text: 'Relis.\n/scenario role-ecrit-sans-demander',
      role: 'code-reviewer',
      profileId: 'sans-demande'
    })
    await env.settled(child.id)
    expect(env.notices(child.id)).toContain('roles.notice.readOnlyRequested')
    const first = env.firstMessage(child.id)
    expect(first?.kind === 'user' && first.text).toContain('Bobine checks the folder')
    await env.waitFor(
      () => env.notices(child.id).includes('roles.notice.folderChanged'),
      'écart signalé chez la fille'
    )
    await env.waitFor(
      () => env.notices(env.mother).includes('roles.notice.childFolderChanged'),
      'écart signalé chez la mère'
    )
  })

  it('mode natif présent : la fille y est mise, consigne du rôle quand même ; rien de retenu pour le profil', async () => {
    const env = await environment()
    // Rôle du projet non commité : la fille travaille dans un worktree où il n'est pas.
    const child = await env.children.start(env.mother, {
      text: 'Question ?',
      role: 'questions',
      model: { controlId: 'model', value: 'factice-precis' }
    })
    expect(child.branch).toBeDefined()
    await env.settled(child.id)
    const controls = env.manager.view(child.id).snapshot?.controls ?? []
    expect(controls.find((c) => c.category === 'mode')).toMatchObject({ currentValue: 'ask' })
    expect(controls.find((c) => c.id === 'model')).toMatchObject({
      currentValue: 'factice-precis'
    })
    const first = env.firstMessage(child.id)
    expect(first?.kind === 'user' && first.text).toContain('CONSIGNE-QUESTIONS')
    expect(first?.kind === 'user' && first.text).toContain('Question ?')
    expect(env.notices(child.id)).not.toContain('roles.notice.modeMissing')
    // Le mode et le modèle d'une fille ne deviennent pas ceux du profil (relecture, fiche 160).
    expect(env.manager.settings.current.controls?.['mock'] ?? {}).toEqual({})
  })

  it('mode natif absent : la consigne du rôle part en tête du premier message, et c’est dit', async () => {
    const env = await environment()
    const child = await env.children.start(env.mother, {
      text: 'Tâche',
      role: 'sans-mode',
      // Agent du rôle indisponible (`startRoleChildren`) : une ligne dans le fil de la fille.
      notices: [{ key: 'roles.notice.agentMissing', params: { agent: 'absent' } }]
    })
    await env.settled(child.id)
    const first = env.firstMessage(child.id)
    expect(first?.kind === 'user' && first.text).toContain('CONSIGNE-SANS-MODE')
    expect(env.notices(child.id)).toContain('roles.notice.modeMissing')
    expect(env.notices(child.id)).toContain('roles.notice.agentMissing')
  })

  it('rôle du projet qui remplace un rôle fourni : signalé dans la liste et dans le fil', async () => {
    const env = await environment()
    const child = await env.children.start(env.mother, { text: 'Plan', role: 'tech-lead' })
    await env.settled(child.id)
    expect(env.notices(child.id)).toContain('roles.notice.projectOverrides')
    const first = env.firstMessage(child.id)
    expect(first?.kind === 'user' && first.text).toContain('CONSIGNE-TECH-LEAD')
  })

  it('rôle inconnu par l’IPC : refusé avec la liste, aucune fille', async () => {
    const env = await environment()
    await expect(env.children.start(env.mother, { text: 'x', role: 'astronaute' })).rejects.toThrow(
      /astronaute/
    )
    expect(env.childrenOf()).toEqual([])
  })

  it('contexte de session : la liste des rôles ; un message qui nomme `@rôle` reçoit le rappel', async () => {
    const env = await environment()
    const first = env.lastReply(env.mother)
    expect(first).toContain('Roles: specialists the user defined')
    expect(first).toContain('- questions: Rôle questions')
    await env.manager.prompt(env.mother, 'Demande à @tech-lead un plan')
    const reply = env.lastReply(env.mother)
    expect(reply).toContain('Roles (start_child `role`)')
    expect(reply).toContain('- tech-lead:')
    expect(reply).not.toContain('- questions:')
    await env.manager.prompt(env.mother, 'Rien de spécial')
    expect(env.lastReply(env.mother)).not.toContain('Roles (start_child')
  })

  it('`@rôle` de la saisie (phase 3B) : une fille par rôle, même texte, rôle inconnu rendu à part', async () => {
    const env = await environment()
    const result = await startRoleChildren(env.children, env.mother, {
      roles: ['security-expert', 'front-architect', 'astronaute'],
      text: 'Relis le carnet.'
    })
    expect(result.started.map((s) => s.role)).toEqual(['security-expert', 'front-architect'])
    expect(result.failed).toEqual([
      { role: 'astronaute', error: expect.stringMatching(/astronaute/) }
    ])
    await env.waitFor(() => env.childrenOf().length === 2, 'deux filles')
    const byRole = Object.fromEntries(env.childrenOf().map((c) => [c.role?.name, c]))
    // Lecture seule : le dossier de la mère ; l'autre : son worktree.
    expect(byRole['security-expert']?.workspace).toBe(env.repo)
    expect(byRole['front-architect']?.branch).toBeTruthy()
    for (const child of env.childrenOf()) {
      await env.settled(child.id)
      const first = env.firstMessage(child.id)
      expect(first?.kind === 'user' && first.text).toMatch(/<bobine_role name="[a-z-]+">/)
      expect(env.lastReply(child.id)).toContain('Relis le carnet.')
    }
    const started = env.items(env.mother).filter((i) => i.kind === 'child-started')
    expect(started.map((i) => i.kind === 'child-started' && i.role?.name)).toEqual([
      'security-expert',
      'front-architect'
    ])
  })

  it('fiche 263 : une bulle pour le message, avant les lancements ; rôle refusé absent ; réponse entière gardée', async () => {
    const env = await environment()
    const result = await startRoleChildren(env.children, env.mother, {
      roles: ['security-expert', 'astronaute', 'code-reviewer'],
      text: 'Propose une direction.\n/scenario avis-long'
    })
    expect(result.failed.map((f) => f.role)).toEqual(['astronaute'])
    const fresh = env.items(env.mother).filter((i) => i.kind !== 'user' && i.kind !== 'agent')
    const bubbles = fresh.filter((i) => i.kind === 'role-request')
    // Une seule bulle (remplacée à chaque travail parti), posée avant le premier lancement.
    expect(bubbles).toHaveLength(1)
    const bubble = bubbles[0]
    if (bubble?.kind !== 'role-request') throw new Error('pas de bulle')
    expect(bubble.text).toBe('Propose une direction.\n/scenario avis-long')
    expect(bubble.followUp).toBeUndefined()
    expect(bubble.works.map((w) => w.role.name)).toEqual(['security-expert', 'code-reviewer'])
    expect(bubble.works.map((w) => w.childId)).toEqual(result.started.map((s) => s.childId))
    const kinds = fresh.map((i) => i.kind)
    expect(kinds.indexOf('role-request')).toBeLessThan(kinds.indexOf('child-started'))
    for (const item of fresh) {
      if (item.kind === 'child-started') expect(item.request).toBe(bubble.requestId)
    }
    // La bulle n'est pas un message : aucun tour de la mère, rien à son agent.
    expect(env.items(env.mother).filter((i) => i.kind === 'user')).toHaveLength(1)
    for (const { childId } of result.started) await env.settled(childId)
    await env.waitFor(
      () => env.items(env.mother).filter((i) => i.kind === 'child-report').length === 2,
      'deux réponses'
    )
    for (const report of env.items(env.mother)) {
      if (report.kind !== 'child-report') continue
      // La réponse entière (plus de 400 caractères) pour la carte ; l'extrait pour l'agent.
      expect(report.reply).toBe(env.lastReply(report.childId).trim())
      expect(report.reply).toContain('FIN-DE-L-AVIS')
      expect(report.excerpt.length).toBeLessThan(report.reply?.length ?? 0)
      expect(report.replyCut).toBeUndefined()
    }
  })

  it('fiche 263 : un travail lancé sans bulle (outil de l’agent, dialogue) ne garde pas sa réponse entière', async () => {
    const env = await environment()
    const child = await env.children.start(env.mother, {
      text: 'Relis.\n/scenario avis-long',
      role: 'code-reviewer'
    })
    await env.settled(child.id)
    await env.waitFor(
      () => env.items(env.mother).some((i) => i.kind === 'child-report'),
      'compte rendu'
    )
    const report = env.items(env.mother).find((i) => i.kind === 'child-report')
    expect(report?.kind === 'child-report' && report.reply).toBe(undefined)
    expect(env.items(env.mother).some((i) => i.kind === 'role-request')).toBe(false)
  })

  it('fiche 263 : « Répondre à <rôle> » — bulle de suite, message à la même conversation, nouvelle réponse', async () => {
    const env = await environment()
    const result = await startRoleChildren(env.children, env.mother, {
      roles: ['security-expert'],
      text: 'Relis le carnet.'
    })
    const childId = result.started[0]?.childId ?? ''
    await env.settled(childId)
    await env.waitFor(
      () => env.items(env.mother).some((i) => i.kind === 'child-report'),
      'première réponse'
    )
    const before = env.childrenOf().length
    expect(env.children.reply(env.mother, childId, '  Et les contrastes ?  ')).toBe('sent')
    const follow = env.items(env.mother).findLast((i) => i.kind === 'role-request')
    expect(follow).toMatchObject({
      followUp: true,
      text: 'Et les contrastes ?',
      works: [{ childId, role: { name: 'security-expert' } }]
    })
    // La même conversation, sans nouveau travail ; le message arrive tel quel, sans provenance.
    await env.waitFor(
      () => env.items(env.mother).filter((i) => i.kind === 'child-report').length === 2,
      'deuxième réponse'
    )
    expect(env.childrenOf()).toHaveLength(before)
    const asked = env.items(childId).findLast((i) => i.kind === 'user')
    expect(asked?.kind === 'user' && asked.text).toBe('Et les contrastes ?')
    expect(asked?.kind === 'user' && asked.from).toBeUndefined()
    const last = env.items(env.mother).findLast((i) => i.kind === 'child-report')
    expect(last?.kind === 'child-report' && last.reply).toContain('Et les contrastes ?')
    // Rien à l'agent de la mère : toujours son seul message.
    expect(env.items(env.mother).filter((i) => i.kind === 'user')).toHaveLength(1)
  })

  it('fiche 263 : « Répondre » refusé pour un travail inconnu, d’une autre conversation, ou sans rôle', async () => {
    const env = await environment()
    expect(() => env.children.reply(env.mother, 'inconnu', 'Bonjour')).toThrow()
    const plain = await env.children.start(env.mother, { text: 'Sans rôle.' })
    expect(() => env.children.reply(env.mother, plain.id, 'Bonjour')).toThrow()
    const result = await startRoleChildren(env.children, env.mother, {
      roles: ['security-expert'],
      text: 'Relis.'
    })
    const childId = result.started[0]?.childId ?? ''
    expect(() => env.children.reply('autre-mere', childId, 'Bonjour')).toThrow()
    expect(() => env.children.reply(env.mother, childId, '   ')).toThrow()
    // Un travail lancé sans bulle (outil de l'agent, dialogue), même avec un rôle : refusé.
    const byAgent = await env.children.start(env.mother, { text: 'Relis.', role: 'code-reviewer' })
    expect(() => env.children.reply(env.mother, byAgent.id, 'Bonjour')).toThrow()
    expect(env.items(env.mother).filter((i) => i.kind === 'role-request')).toHaveLength(1)
  })

  it('fiche 263, revue QA : « Relancer » après un démarrage raté repart avec la consigne du rôle', async () => {
    const env = await environment()
    // Le premier message du travail ne part pas (agent à connecter, par exemple).
    const prompt = env.manager.prompt.bind(env.manager)
    const failing = vi.spyOn(env.manager, 'prompt').mockImplementation(async (id, ...rest) => {
      if (id !== env.mother) throw new Error('agent à connecter')
      return prompt(id, ...rest)
    })
    const result = await startRoleChildren(env.children, env.mother, {
      roles: ['security-expert'],
      text: 'Relis le carnet.'
    })
    const childId = result.started[0]?.childId ?? ''
    await env.waitFor(
      () => env.items(env.mother).some((i) => i.kind === 'child-report' && i.outcome === 'error'),
      'démarrage raté dit à la mère'
    )
    expect(env.items(childId).some((i) => i.kind === 'user')).toBe(false)
    failing.mockRestore()
    expect(env.children.reply(env.mother, childId, 'Relis le carnet.')).toBe('sent')
    await env.settled(childId)
    const first = env.firstMessage(childId)
    // Comme au lancement : la demande, puis la consigne du rôle et sa lecture seule.
    expect(first?.kind === 'user' && first.text).toMatch(/^Relis le carnet\./)
    expect(first?.kind === 'user' && first.text).toContain('<bobine_role name="security-expert">')
    expect(first?.kind === 'user' && first.text).toContain('You are read-only')
  })

  it('fiche 263, revue QA : « Répondre » refusé pour une mère archivée ; un échec d’envoi est dit à la mère', async () => {
    const env = await environment()
    const result = await startRoleChildren(env.children, env.mother, {
      roles: ['security-expert'],
      text: 'Relis.'
    })
    const childId = result.started[0]?.childId ?? ''
    await env.settled(childId)
    const prompt = env.manager.prompt.bind(env.manager)
    const failing = vi.spyOn(env.manager, 'prompt').mockImplementation(async (id, ...rest) => {
      if (id === childId) throw new Error('panne')
      return prompt(id, ...rest)
    })
    env.children.reply(env.mother, childId, 'Et ensuite ?')
    await env.waitFor(
      () => env.notices(env.mother).includes('workCard.notice.replyFailed'),
      'échec dit à la mère'
    )
    failing.mockRestore()
    env.manager.setArchived(env.mother, true)
    expect(() => env.children.reply(env.mother, childId, 'Encore ?')).toThrow()
  })

  it('`@rôle` en premier message d’une conversation neuve : elle entre dans l’historique, la fille s’y rattache', async () => {
    const env = await environment()
    const fresh = (await env.manager.create({ workspace: env.repo })).summary.id
    expect(env.manager.view(fresh).summary.draft).toBe(true)
    const text = 'Relis calc.js et dis-moi ce qui cloche.'
    const result = await startRoleChildren(
      env.children,
      fresh,
      { roles: ['security-expert'], text },
      () => env.manager.keepDraft(fresh, text)
    )
    expect(result.started.map((s) => s.role)).toEqual(['security-expert'])
    const mother = env.manager.state().conversations.find((c) => c.id === fresh)
    expect(mother?.draft).toBe(false)
    expect(mother?.title).toBe(text)
    // Aucun message à l'agent de la mère : la bulle de la demande et le lancement (fiche 263).
    expect(env.items(fresh).map((i) => i.kind)).toEqual(['role-request', 'child-started'])
    const child = env.manager.state().conversations.find((c) => c.startedFrom?.id === fresh)
    expect(child?.role?.name).toBe('security-expert')
    await env.settled(child?.id ?? '')
    const first = env.firstMessage(child?.id ?? '')
    expect(first?.kind === 'user' && first.text).toContain(
      "Reply in French, the language of the user's request."
    )
  })

  it('fiche 262 : mode installé qui ne correspond plus au rôle, jamais posé et dit dans le fil', async () => {
    const asked: string[] = []
    const env = await environment({
      nativeRoleMode: (_profile, role) => {
        asked.push(`${role.name}:${role.readOnly}`)
        return { id: role.name, readOnly: false, stale: 'readOnly' }
      }
    })
    const result = await startRoleChildren(env.children, env.mother, {
      roles: ['security-expert'],
      text: 'Relis le carnet.'
    })
    expect(result.failed).toEqual([])
    const child = env.childrenOf()[0]
    await env.settled(child?.id ?? '')
    expect(asked).toEqual(['security-expert:true'])
    expect(env.notices(child?.id ?? '')).toContain('roles.notice.installedStale.readOnly')
    // Mode non posé : la consigne du rôle et sa lecture seule partent dans le message.
    const first = env.firstMessage(child?.id ?? '')
    expect(first?.kind === 'user' && first.text).toContain('You are read-only')
  })
})
