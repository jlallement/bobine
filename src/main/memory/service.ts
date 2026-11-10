/**
 * Mémoire côté main (fiche 182, ADR-0040) : ce que l'agent propose devient une carte du fil
 * (`memory-proposal`), et rien n'est écrit ni oublié avant la décision de l'utilisateur
 * (`decide`, IPC `memory:decide`). La décision relit la proposition dans le fil du main, jamais un
 * texte venu du renderer. Index donné à l'agent au début de chaque session (`sessionContext`).
 */
import { randomBytes } from 'node:crypto'
import { t } from 'i18next'
import { basename } from 'node:path'
import type { AgentEvent } from '@shared/agent'
import {
  MEMORY_LIMITS,
  memoryContext,
  memoryProposals,
  type MemoryDecision,
  type MemoryDecisionResult,
  type MemoryDraft,
  type MemoryEntryView,
  type MemoryPlace,
  type MemoryProposal,
  type MemoryProposalItem,
  type MemoryScope,
  type ExternalSource
} from '@shared/memory'
import type { TranscriptItem } from '@shared/transcript'
import { APP_TOOLS_SERVER_NAME } from '@shared/mcp'
import { projectKeyOf } from './project-key'
import type { MemoryStore } from './store'

/** Ce que la mémoire lit et écrit d'une conversation (le gestionnaire de conversations). */
export interface MemoryConversations {
  items: (id: string) => readonly TranscriptItem[]
  post: (id: string, event: AgentEvent) => void
  /** Dossier de travail ; lève une erreur sans dossier choisi. */
  workspaceOf: (id: string) => string
  /** Nom de l'agent de la conversation (« OpenCode »). */
  agentLabel: (id: string) => string
}

export interface MemoryServiceOptions {
  store: MemoryStore
  conversations: MemoryConversations
  /** Réglage « Mémoire activée », relu à chaque usage. */
  enabled: () => boolean
  log?: (message: string) => void
}

/** Une mémoire et le dossier qui la fait exister (noté dans `project.json`). */
interface Located {
  place: MemoryPlace
  folder?: string
}

/** Refus à dire à l'agent (`isError`) ; jamais une exception. */
export class MemoryRefusal extends Error {}

export class MemoryService {
  private readonly options: MemoryServiceOptions
  /** Décisions en cours (double clic) : la seconde est refusée. */
  private readonly deciding = new Set<string>()
  private readonly keys = new Map<string, ReturnType<typeof projectKeyOf>>()

  constructor(options: MemoryServiceOptions) {
    this.options = options
  }

  get store(): MemoryStore {
    return this.options.store
  }

  enabled(): boolean {
    return this.options.enabled()
  }

  /** Mémoire « Vous » ou celle du projet du dossier (clé mise en cache par dossier). */
  locate(scope: MemoryScope, workspace: string | undefined): Located | undefined {
    if (scope === 'user') return { place: { scope: 'user' } }
    if (!workspace) return undefined
    if (!this.keys.has(workspace)) {
      const key = projectKeyOf(workspace)
      if (key?.orphanWorktree) {
        this.options.log?.(
          `Mémoire : dépôt principal introuvable pour ${workspace}, mémoire du worktree seul`
        )
      }
      this.keys.set(workspace, key)
    }
    const key = this.keys.get(workspace)
    return key ? { place: { scope: 'project', projectId: key.id }, folder: key.root } : undefined
  }

  /** Souvenirs « Vous » et du projet du dossier, pour l'index d'une session. */
  async memoriesFor(
    workspace: string | undefined
  ): Promise<{ user: MemoryEntryView[]; project: MemoryEntryView[] }> {
    const { store } = this.options
    const project = this.locate('project', workspace)
    const [user, own] = await Promise.all([
      store.list({ scope: 'user' }).catch(() => []),
      project ? store.list(project.place).catch(() => []) : Promise.resolve([])
    ])
    // Seuls les souvenirs validés par l'utilisateur vont aux agents : un fichier écrit ou modifié
    // hors de Bobine (éditeur, outils de l'agent) attend « Garder ces modifications ».
    return { user: user.filter((e) => e.approved), project: own.filter((e) => e.approved) }
  }

  /** Bloc d'index joint au premier message de chaque session (`<bobine_memory>`). */
  async sessionContext(workspace: string | undefined): Promise<string> {
    return memoryContext(await this.memoriesFor(workspace))
  }

  /** Souvenirs nommés, cherchés dans le projet puis dans « Vous ». */
  async recall(
    workspace: string | undefined,
    names: readonly string[]
  ): Promise<MemoryEntryView[]> {
    const { store } = this.options
    const project = this.locate('project', workspace)
    const own = project ? (await store.read(project.place, names)).filter((e) => e.approved) : []
    const rest = names.filter((name) => !own.some((e) => e.name === name))
    return [...own, ...(await store.read({ scope: 'user' }, rest))].filter((e) => e.approved)
  }

  /**
   * Pose la carte d'une proposition dans le fil (rien n'est écrit) et rend son identifiant.
   * `draft` est déjà validé (format, bornes, secrets) par l'outil.
   */
  async propose(
    conversationId: string,
    workspace: string | undefined,
    action: MemoryProposal['action'],
    draft: MemoryDraft
  ): Promise<string> {
    const { conversations, store } = this.options
    if (!this.enabled()) throw new MemoryRefusal('Memory is turned off by the user.')
    const items = conversations.items(conversationId)
    const pending = memoryProposals(items).filter((p) => p.status === 'pending').length
    if (pending >= MEMORY_LIMITS.pendingPerConversation) {
      throw new MemoryRefusal(
        `Too many pending proposals (${pending}): wait for the user to decide on them first.`
      )
    }
    const located = this.locate(draft.scope, workspace)
    if (!located) {
      throw new MemoryRefusal(
        'This conversation has no project folder: use `scope: "user"` for a memory about the user.'
      )
    }
    const current = await store.get(located.place, draft.name)
    const external = externalContentSince(items)
    if (action === 'forget' && !current) {
      throw new MemoryRefusal(`No memory named "${draft.name}" in the ${draft.scope} memory.`)
    }
    const proposal: MemoryProposal = {
      proposalId: `mem-${randomBytes(4).toString('hex')}`,
      action,
      draft:
        action === 'forget' && current
          ? {
              name: current.name,
              description: current.description,
              type: current.type,
              body: current.body,
              scope: draft.scope
            }
          : draft,
      seen: current?.version ?? null,
      ...(current ? { replaces: textOf(current) } : {}),
      ...(external ? { source: 'external' as const, sourceOf: external } : {}),
      ...(draft.scope === 'project' && located.folder ? { project: basename(located.folder) } : {}),
      agent: conversations.agentLabel(conversationId),
      status: 'pending',
      at: Date.now()
    }
    conversations.post(conversationId, { type: 'memory-proposal', proposal })
    return proposal.proposalId
  }

  /**
   * Décision de l'utilisateur sur une carte. La proposition est relue dans le fil ; une version
   * changée depuis la proposition n'est pas écrasée sans `force` (« Remplacer quand même ? »).
   */
  async decide(decision: MemoryDecision): Promise<MemoryDecisionResult> {
    const { conversations, store } = this.options
    const key = `${decision.conversationId}/${decision.proposalId}`
    if (this.deciding.has(key)) throw new Error('Decision already in progress')
    const proposal = memoryProposals(conversations.items(decision.conversationId)).find(
      (p) => p.proposalId === decision.proposalId
    )
    if (!proposal) throw new Error(`Unknown memory proposal: ${decision.proposalId}`)
    if (proposal.status !== 'pending') return { done: true, status: proposal.status }
    if (!decision.accept) return this.settle(decision.conversationId, proposal, 'declined')
    if (!this.enabled()) throw new Error('Memory is turned off')
    this.deciding.add(key)
    try {
      const workspace = safely(() => conversations.workspaceOf(decision.conversationId))
      const located = this.locate(proposal.draft.scope, workspace)
      if (!located) throw new Error('No project folder for this memory')
      const expected = decision.force ? undefined : proposal.seen
      if (proposal.action === 'forget') {
        const removed = await store.remove(
          located.place,
          proposal.draft.name,
          expected ?? undefined
        )
        // Déjà supprimé ailleurs : le souhait est exaucé.
        if (!removed.ok && removed.current) return { done: false, changed: textOf(removed.current) }
        return this.settle(decision.conversationId, proposal, 'forgotten')
      }
      const { scope: _scope, ...draft } = proposal.draft
      const written = await store.write(
        located.place,
        {
          ...draft,
          by: `${proposal.agent}, conversation ${decision.conversationId.slice(0, 8)}`,
          ...(proposal.source ? { source: proposal.source } : {})
        },
        {
          ...(expected !== undefined ? { expected } : {}),
          ...(located.folder ? { folder: located.folder } : {})
        }
      )
      if (written.ok) return this.settle(decision.conversationId, proposal, 'kept')
      if (written.reason === 'full') {
        throw new Error(`Memory full (${MEMORY_LIMITS.perScope} entries): forget some first`)
      }
      if (written.reason === 'locked') throw new Error(t('memory.keyLocked'))
      return { done: false, changed: written.current ? textOf(written.current) : null }
    } finally {
      this.deciding.delete(key)
    }
  }

  private settle(
    conversationId: string,
    proposal: MemoryProposalItem,
    status: 'kept' | 'forgotten' | 'declined'
  ): MemoryDecisionResult {
    const { kind: _kind, id: _id, ...rest } = proposal
    this.options.conversations.post(conversationId, {
      type: 'memory-proposal',
      proposal: { ...rest, status, decidedAt: Date.now() }
    })
    return { done: true, status }
  }
}

const textOf = (entry: MemoryEntryView) => ({
  description: entry.description,
  body: entry.body,
  updated: entry.updated
})

function safely<T>(read: () => T): T | undefined {
  try {
    return read()
  } catch {
    return undefined
  }
}

/** Serveur d'un titre d'outil MCP (formats de `tools.ts`), s'il n'est pas celui de l'app. */
const FOREIGN_MCP = [/^Running .+ \(([^)]+)\)$/i, /^mcp__([^_]+(?:_[^_]+)*?)__\w+$/i]

function foreignMcp(title: string): string | undefined {
  for (const format of FOREIGN_MCP) {
    const server = format.exec(title.trim())?.[1]
    if (server) return server.toLowerCase() !== APP_TOOLS_SERVER_NAME ? server : undefined
  }
  return undefined
}

/** Hôte d'une adresse dans un titre d'outil (« Fetch https://exemple.fr/… » → `exemple.fr`). */
function hostIn(text: string): string | undefined {
  const url = /https?:\/\/[^\s/]+/i.exec(text)?.[0]
  try {
    return url ? new URL(url).host : undefined
  } catch {
    return undefined
  }
}

/** Commande ou adresse qui fait entrer du contenu d'ailleurs (titre, commande, code d'un outil). */
const FETCHES = /https?:\/\/|\b(?:curl|wget)\b|\bgit\s+clone\b/i
/** Appels d'outils MCP dans du code (« Code Mode » d'OpenCode : `tools.<serveur>.<outil>(…)`). */
const CODE_CALLS = /\btools\.([A-Za-z0-9_-]+)\./g

/** Ce qu'une carte d'outil a fait entrer d'ailleurs, ou `undefined`. */
function toolSource(item: Extract<TranscriptItem, { kind: 'tool' }>): ExternalSource | undefined {
  const host = hostIn([item.title, item.input?.url, item.input?.command].join(' '))
  if (item.toolKind === 'fetch') return { kind: 'web', ...(host ? { detail: host } : {}) }
  if (item.appTool?.group === 'browser') return { kind: 'browser' }
  const server = foreignMcp(item.title)
  if (server) return { kind: 'mcp', detail: server }
  const code = item.input?.code ?? ''
  for (const match of code.matchAll(CODE_CALLS)) {
    const name = match[1] ?? ''
    if (name.toLowerCase() !== APP_TOOLS_SERVER_NAME) return { kind: 'mcp', detail: name }
  }
  const text = [item.title, item.input?.command, item.input?.url, code].join('\n')
  if (FETCHES.test(text)) return { kind: 'web', ...(host ? { detail: host } : {}) }
  return undefined
}

/**
 * Du contenu venu d'ailleurs est-il entré dans la conversation depuis la dernière compaction,
 * bascules d'agent comprises (l'échange d'avant est transmis au nouvel agent) ? Lecture web (`fetch`, commande ou code qui télécharge), navigateur
 * intégré, autre serveur MCP (carte, ou appel dans du code), pièce jointe. Générique : d'après les
 * cartes du fil, rien de propre à un agent. Des trous restent (un outil de l'agent sans genre ni
 * cible annoncés) : c'est une information pour l'utilisateur, pas un tri (ADR-0040).
 */
export function externalContentSince(items: readonly TranscriptItem[]): ExternalSource | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (!item) continue
    // Ce que l'agent a encore en contexte : depuis la dernière compaction. Une bascule d'agent
    // (ou une session neuve) ne coupe pas : l'échange d'avant lui est transmis (fiche 108).
    if (item.kind === 'compaction') return undefined
    if (item.kind === 'user') {
      if (item.attachments?.length) return { kind: 'attachment' }
      if (item.compaction) return undefined
    }
    if (item.kind !== 'tool') continue
    const source = toolSource(item)
    if (source) return source
  }
  return undefined
}
