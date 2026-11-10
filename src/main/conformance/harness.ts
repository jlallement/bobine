/**
 * Harnais de la grille de conformité (fiche 139) : un vrai `ConversationManager` sur des dossiers
 * jetables, les trois personas comme profils, des réponses automatiques aux autorisations et aux
 * formulaires, et des attentes sur l'état de la conversation. Rien d'autre que ce qu'utilise l'app.
 */
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  AgentEvent,
  ConversationEvent,
  ConversationView,
  ElicitationAnswer,
  ElicitationPrompt
} from '@shared/agent'
import type { PermissionOption, ToolCallUpdate } from '../../shared/acp-sdk.mts'
import { ConversationManager } from '../conversations/manager'
import { ConversationStore } from '../conversations/store'
import { saveSettings } from '../settings'
import { PERSONAS, type Persona, type PersonaContext, type PersonaId } from './personas'

/** Choix fait à une demande d'autorisation (`null` : annulée). */
export type PermissionPolicy = (
  options: PermissionOption[],
  toolCall: ToolCallUpdate
) => string | null

/** Premier accord ponctuel (« Allow once »), sinon la première option. */
export const allowOnce: PermissionPolicy = (options) =>
  (options.find((o) => o.kind === 'allow_once') ?? options[0])?.optionId ?? null

/** Premier refus ponctuel. */
export const rejectOnce: PermissionPolicy = (options) =>
  (options.find((o) => o.kind === 'reject_once') ?? options.at(-1))?.optionId ?? null

/** Réponses valides aux formulaires des scénarios (`bob-elicitation`, `question-opencode2`). */
export function answerForm(prompt: ElicitationPrompt): ElicitationAnswer {
  if (prompt.mode !== 'form') return { action: 'accept' }
  const fields = Object.keys(prompt.schema.properties ?? {})
  if (fields.includes('q0')) return { action: 'accept', content: { q0: 'Rust' } }
  return {
    action: 'accept',
    content: { environnement: 'dev', instances: 2, regions: ['eu'], confirmer: true }
  }
}

export function waitFor(predicate: () => boolean, what: string, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const check = () => {
      if (predicate()) return resolve()
      if (Date.now() - started > timeoutMs) return reject(new Error(`délai dépassé : ${what}`))
      setTimeout(check, 10)
    }
    check()
  })
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Un environnement d'essai : dossiers jetables et profils des trois personas. */
export function environment(
  persona: Persona,
  options: { delayMs?: number; extraArgs?: string[] } = {}
) {
  const root = mkdtempSync(join(tmpdir(), `conformite-${persona.id}-`))
  const workspace = join(root, 'projet')
  const configHome = join(root, 'maison')
  mkdirSync(workspace)
  mkdirSync(configHome)
  const ctx: PersonaContext = {
    store: join(root, 'sessions-factices'),
    configHome,
    delayMs: options.delayMs ?? 0,
    ...(options.extraArgs ? { extraArgs: options.extraArgs } : {})
  }
  // Profils écrits dans le code, et agents déclarés dans les réglages (fiche 141) ; la persona est
  // le dernier agent choisi : ses conversations neuves la prennent.
  const all = Object.values(PERSONAS)
  const profiles = all.filter((p) => !p.declared).map((p) => p.profile(ctx))
  saveSettings(join(root, 'settings.json'), {
    recentWorkspaces: [],
    profileId: persona.profile(ctx).id,
    customAgents: all.flatMap((p) => (p.declared ? [p.declared(ctx)] : []))
  })
  const conversationsDir = join(root, 'conversations')

  /** Une « instance de l'app » sur ces dossiers. */
  function launch() {
    const events: ConversationEvent[] = []
    const manager = new ConversationManager({
      profiles,
      settingsFile: join(root, 'settings.json'),
      conversationsDir,
      defaultWorkspace: workspace,
      neutralFolder: workspace,
      pathEnv: () => process.env['PATH'],
      emit: (e) => events.push(e),
      // Jamais le vrai dossier personnel : ses règles fausseraient les essais (fiche 056).
      agentHome: configHome,
      // Reconnexion après une panne réseau (fiche 142) : cinq tentatives, sans attendre une minute.
      retryDelaysMs: [20, 20, 20, 20, 20]
    })
    return new App(manager, events)
  }

  /** Le fil tel qu'il est sur le disque, relu par un stockage neuf (comme au lancement). */
  const durable = (id: string) => new ConversationStore(conversationsDir).loadTranscript(id)

  /** Profil (dans cet environnement) d'une persona. */
  const profileIdOf = (id: PersonaId) => PERSONAS[id].profile(ctx).id

  return { root, workspace, launch, durable, persona, profileIdOf }
}

export type Environment = ReturnType<typeof environment>

/** Une instance de l'app, pilotée comme l'utilisateur la piloterait. */
export class App {
  private permissionPolicy: PermissionPolicy = allowOnce
  private elicitationAnswer: (prompt: ElicitationPrompt) => ElicitationAnswer = answerForm
  /** Messages envoyés par l'utilisateur, par conversation (invariant « pas de doublon »). */
  readonly sent = new Map<string, number>()

  readonly manager: ConversationManager
  readonly events: ConversationEvent[]

  constructor(manager: ConversationManager, events: ConversationEvent[]) {
    this.manager = manager
    this.events = events
    manager.subscribe({ event: (payload) => this.answer(payload) })
  }

  /** Réponse aux prochaines demandes d'autorisation. */
  permissions(policy: PermissionPolicy): void {
    this.permissionPolicy = policy
  }

  elicitations(answer: (prompt: ElicitationPrompt) => ElicitationAnswer): void {
    this.elicitationAnswer = answer
  }

  /** Conversation neuve de l'agent de la persona, prête. */
  async start(): Promise<string> {
    const view = await this.manager.startActive()
    const id = view.summary.id
    await waitFor(() => this.status(id) === 'ready', 'agent prêt')
    return id
  }

  view(id: string): ConversationView {
    return this.manager.view(id)
  }

  status(id: string) {
    return this.manager.view(id).snapshot?.status
  }

  /** Envoie un message et attend la fin du tour (ou sa mise en file si l'agent répond). */
  async prompt(id: string, text: string): Promise<void> {
    this.sent.set(id, (this.sent.get(id) ?? 0) + 1)
    await this.manager.prompt(id, text)
  }

  /** Évènements reçus pour une conversation, d'un type donné. */
  of<T extends AgentEvent['type']>(id: string, type: T): Extract<AgentEvent, { type: T }>[] {
    return this.events
      .filter((e) => e.conversationId === id && e.event.type === type)
      .map((e) => e.event as Extract<AgentEvent, { type: T }>)
  }

  /** Tours finis (réponse ou échec) d'une conversation. */
  turns(id: string): number {
    return this.of(id, 'turn-end').length + this.of(id, 'turn-error').length
  }

  /**
   * Attend que la conversation soit au repos : agent prêt (ou arrêté), file vide, puis `settleMs`
   * et 150 ms sans évènement.
   */
  async idle(id: string, settleMs = 0, timeoutMs = 8000): Promise<void> {
    await waitFor(
      () => this.status(id) !== 'busy' && !this.view(id).snapshot?.queued.length,
      'conversation au repos',
      timeoutMs
    )
    if (settleMs) await sleep(settleMs)
    // Deux relevés à 150 ms d'écart sans évènement.
    for (;;) {
      const before = this.events.length
      await sleep(150)
      if (this.events.length === before) return
    }
  }

  private answer({ conversationId: id, event }: ConversationEvent): void {
    if (event.type === 'permission-request') {
      const choice = this.permissionPolicy(event.options, event.toolCall)
      setTimeout(() => this.manager.respondPermission(id, event.requestId, choice), 0)
    }
    if (event.type === 'elicitation-request') {
      const answer = this.elicitationAnswer(event.prompt)
      setTimeout(() => this.manager.respondElicitation(id, event.requestId, answer), 0)
    }
  }
}
