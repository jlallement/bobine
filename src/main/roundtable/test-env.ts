/**
 * Essais du tour de table (fiche 285) : un dépôt git jetable, le vrai gestionnaire des
 * conversations, les filles et l'orchestrateur, sur l'agent factice (jamais un vrai agent).
 *
 * - `lead` : la conversation qui arbitre (scénario au choix, `echo` pour lire ce qu'elle reçoit) ;
 * - `panel` : les participants (`avis-participant`, modèles `factice-rapide` et `factice-precis`) ;
 * - d'autres profils au besoin (`profiles`).
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgentEvent } from '@shared/agent'
import { lastRoundtable, type RoundtableChoice, type RoundtableItem } from '@shared/roundtable'
import type { TranscriptItem } from '@shared/transcript'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentProfile } from '../agent/profiles'
import { Worktrees } from '../changes/worktrees'
import type { ChildConversations } from '../conversations/children'
import { setupChildren } from '../conversations/children-setup'
import { ConversationManager } from '../conversations/manager'
import { until } from '../conversations/manager-until'
import { gitCommand, queuedGit } from '../git/git-queue'
import { childrenToolsModule } from '../mcp/children-tools'
import { AppToolServer } from '../mcp/tool-server'
import type { Roundtables } from './roundtables'
import { setupRoundtables } from './setup'

export interface EnvOptions {
  /** Scénario de la conversation qui arbitre (défaut : `synthese-tour-de-table`). */
  lead?: string
  /** Options de plus pour la conversation qui arbitre. */
  leadArgs?: string[]
  /** Options de plus pour les participants `panel`. */
  panel?: string[]
  /** Autres profils (participants d'un autre agent). */
  profiles?: (mock: MockProfile) => AgentProfile[]
  /** Dossier de travail hors git (défaut : un dépôt git). */
  noGit?: boolean
  /** Réutilise ce dossier de données (redémarrage de l'app). */
  root?: string
  repo?: string
}

export type MockProfile = (
  id: string,
  scenario: string,
  extra?: string[],
  profile?: Partial<AgentProfile>
) => AgentProfile

export const FAST: RoundtableChoice = {
  profileId: 'panel',
  model: { controlId: 'model', value: 'factice-rapide', name: 'Factice rapide' }
}
export const PRECISE: RoundtableChoice = {
  profileId: 'panel',
  model: { controlId: 'model', value: 'factice-precis', name: 'Factice précis' }
}

export const choice = (profileId: string, value?: string): RoundtableChoice =>
  value ? { profileId, model: { controlId: 'model', value, name: value } } : { profileId }

function folder(noGit: boolean): string {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'tour-depot-')))
  writeFileSync(join(repo, 'calc.js'), 'export const mean = (xs) => xs.length\n')
  if (noGit) return repo
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
      cwd: repo,
      encoding: 'utf8'
    })
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  return repo
}

export async function roundtableEnv(options: EnvOptions = {}) {
  const root = options.root ?? mkdtempSync(join(tmpdir(), 'tour-'))
  const repo = options.repo ?? folder(options.noGit === true)
  const mock: MockProfile = (id, scenario, extra = [], profile = {}) => ({
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
      join(root, 's'),
      ...extra
    ],
    env: {},
    childModelChoice: 'ask',
    ...profile
  })
  const late: { children?: ChildConversations; roundtables?: Roundtables } = {}
  // Serveur MCP de l'app : la mère reçoit ses outils, un participant aucun.
  const toolServer = new AppToolServer()
  await toolServer.start()
  const manager = new ConversationManager({
    profiles: [
      mock('lead', options.lead ?? 'synthese-tour-de-table', options.leadArgs ?? []),
      mock('panel', 'avis-participant', options.panel ?? []),
      ...(options.profiles?.(mock) ?? [])
    ],
    toolServer,
    toolModules: [childrenToolsModule(() => late.children)],
    keepLive: (id) => late.children?.keepLive(id) ?? false,
    settleLoaded: (id, items) => late.roundtables?.settleLoaded(id, items) ?? [],
    settingsFile: join(root, 'settings.json'),
    conversationsDir: join(root, 'conversations'),
    defaultWorkspace: repo,
    neutralFolder: repo,
    pathEnv: () => process.env['PATH'],
    worktrees: new Worktrees(queuedGit(gitCommand)),
    agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
  })
  const children = setupChildren(manager, {})
  late.children = children
  const roundtables = setupRoundtables(manager, {
    children,
    attention: () => ({}),
    providers: () => [],
    random: () => 0
  })
  late.roundtables = roundtables
  const events: { conversationId: string; event: AgentEvent }[] = []
  manager.subscribe({
    event: ({ conversationId, event }) => events.push({ conversationId, event })
  })
  const items = (id: string): TranscriptItem[] => manager.view(id).transcript.items
  const waitFor = (predicate: () => boolean, what: string, timeoutMs = 12_000) =>
    until(manager, predicate, what, timeoutMs)
  const rt = (id: string): RoundtableItem => {
    const item = lastRoundtable(items(id))
    if (!item) throw new Error('aucun tour de table')
    return item
  }
  const replies = (id: string) =>
    items(id).flatMap((i) => (i.kind === 'agent' && i.text.trim() ? [i.text] : []))
  const users = (id: string) => items(id).flatMap((i) => (i.kind === 'user' ? [i] : []))
  const seatChild = (id: string, letter: string): string => {
    const childId = rt(id).seats.find((s) => s.letter === letter)?.childId
    if (!childId) throw new Error(`place ${letter} sans conversation`)
    return childId
  }
  return {
    root,
    repo,
    manager,
    children,
    roundtables,
    events,
    items,
    waitFor,
    rt,
    replies,
    users,
    seatChild,
    stop: () => {
      manager.stopAll()
      toolServer.stop()
    }
  }
}

export type RoundtableEnv = Awaited<ReturnType<typeof roundtableEnv>>

/** Une conversation de `lead` qui a déjà un échange (le dernier échange part avec la question). */
export async function motherWithExchange(env: RoundtableEnv): Promise<string> {
  const mother = env.manager.state().activeId
  await env.manager.startActive()
  await env.manager.prompt(mother, 'Quelle moyenne pour calc.js ?')
  return mother
}
