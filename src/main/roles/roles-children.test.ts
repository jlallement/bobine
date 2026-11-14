/**
 * Rôles contre l'agent factice (fiche 223) : délégation par `start_child`, rôle inconnu, lecture
 * seule (écriture demandée puis refusée, écriture faite sans demander), mode natif présent ou
 * absent, rappel des rôles quand le message en nomme un. Aucun vrai modèle.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentProfile } from '../agent/profiles'
import { Worktrees } from '../changes/worktrees'
import type { ChildConversations } from '../conversations/children'
import { setupChildren } from '../conversations/children-setup'
import { ConversationManager } from '../conversations/manager'
import { gitCommand, queuedGit } from '../git/git-queue'
import { until } from '../conversations/manager-until'
import { childrenToolsModule } from '../mcp/children-tools'
import { AppToolServer } from '../mcp/tool-server'
import { builtinRoles } from './builtin'
import { startRoleChildren } from './invoke'
import { RoleLibrary } from './library'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

async function environment() {
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
  const children = setupChildren(manager, { roles: library })
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
    expect(reply).toContain('application security expert')
    expect(reply).toContain('Bobine refuses your write requests.')
    expect(reply).toContain('Audite le module de connexion.')
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
      roles: ['security-expert', 'ux-ui-expert', 'astronaute'],
      text: 'Relis le carnet.'
    })
    expect(result.started.map((s) => s.role)).toEqual(['security-expert', 'ux-ui-expert'])
    expect(result.failed).toEqual([
      { role: 'astronaute', error: expect.stringMatching(/astronaute/) }
    ])
    await env.waitFor(() => env.childrenOf().length === 2, 'deux filles')
    const byRole = Object.fromEntries(env.childrenOf().map((c) => [c.role?.name, c]))
    // Lecture seule : le dossier de la mère ; l'autre : son worktree.
    expect(byRole['security-expert']?.workspace).toBe(env.repo)
    expect(byRole['ux-ui-expert']?.branch).toBeTruthy()
    for (const child of env.childrenOf()) {
      await env.settled(child.id)
      const first = env.firstMessage(child.id)
      expect(first?.kind === 'user' && first.text).toMatch(/<bobine_role name="[a-z-]+">/)
      expect(env.lastReply(child.id)).toContain('Relis le carnet.')
    }
    const started = env.items(env.mother).filter((i) => i.kind === 'child-started')
    expect(started.map((i) => i.kind === 'child-started' && i.role?.name)).toEqual([
      'security-expert',
      'ux-ui-expert'
    ])
  })
})
