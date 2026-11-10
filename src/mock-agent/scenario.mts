/**
 * Format des scénarios de l'agent factice et interpréteur qui les joue.
 *
 * Un scénario est une liste d'étapes jouées pendant un tour de prompt. Les étapes émettent des
 * `session/update`, demandent des permissions ou des élicitations au client, et peuvent brancher
 * selon la réponse. Voir docs/mock-agent.md.
 */
import { spawn as spawnChild } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { methods, RequestError } from '../shared/acp-sdk.mts'
import { createTwoFilesPatch, structuredPatch } from 'diff'
import type {
  AgentContext,
  ContentBlock,
  ElicitationSchema,
  McpServer,
  PermissionOption,
  RequestPermissionResponse,
  SessionUpdate,
  StopReason,
  ToolCallUpdate
} from '../shared/acp-sdk.mts'
import { say, sayAll, type MockLanguage } from './langue.mts'

/** Connexion faite dans un terminal (`touch .mock-agent-logged-in`, comme `opencode auth login`). */
export const LOGIN_MARKER = '.mock-agent-logged-in'

export type Step =
  /** Texte de l'agent, envoyé en plusieurs morceaux (streaming). */
  | { kind: 'text'; text: string }
  /** Réflexion de l'agent (agent_thought_chunk), en streaming. */
  | { kind: 'thought'; text: string }
  /** N'importe quel `session/update` brut. */
  | { kind: 'update'; update: SessionUpdate }
  /** Pause, en multiples du délai de base (`--delay`). */
  | { kind: 'pause'; ticks: number }
  /**
   * Branches jouées en même temps (appels d'outils parallèles, comme OpenCode) ; l'étape se termine
   * quand toutes ont fini (fiche 124).
   */
  | { kind: 'parallel'; branches: Step[][] }
  /** Demande de permission ; on joue la branche correspondant à l'option choisie. */
  | {
      kind: 'permission'
      toolCall: ToolCallUpdate
      options: PermissionOption[]
      branches: Record<string, Step[]>
      /**
       * Comme Bob 2.0.9 (écriture hors du dossier) : après `afterTicks`, l'agent retire sa demande
       * (`$/cancel_request`) sans attendre ; le tour continue avec `steps` quand le client a
       * répondu (fiche 214). Une réponse de l'utilisateur arrivée avant n'est pas retirée.
       */
      agentCancels?: { afterTicks: number; steps: Step[] }
    }
  /** Formulaire demandé à l'utilisateur (élicitation, comme Bob avec MCP). */
  | {
      kind: 'elicitation'
      message: string
      /** Formulaire (mode `form`)… */
      schema?: ElicitationSchema
      /** …ou lien à ouvrir dans le navigateur (mode `url`). */
      url?: string
      /** Appel d'outil qui pose la question (comme `AskUserQuestion` de Claude Code). */
      toolCallId?: string
      onAccept: (content: Record<string, unknown>) => Step[]
      onDecline: Step[]
    }
  /** Décrit le prompt reçu (texte, images, fichiers) : utile pour tester l'envoi de contenu. */
  | { kind: 'echo' }
  /** Décrit le contexte caché reçu avant le message (bascule d'agent, fiche 108 ; branche, 023). */
  | { kind: 'context' }
  /** Dit le dossier de travail et les autres dossiers reçus à l'ouverture de session (fiche 179). */
  | { kind: 'folders' }
  /** Décrit l'aparté reçu (fiche 180) : consigne de lecture seule, fil joint ou non, réglages. */
  | { kind: 'aside' }
  /**
   * Appelle l'outil `ask_user` du serveur MCP fourni par le client, comme Bob 2.0.6 : carte d'outil
   * « Running Ask User (serveur) », demande d'autorisation, puis `tools/call` en HTTP.
   */
  | { kind: 'ask-user'; args: Record<string, unknown>; onResult: (text: string) => Step[] }
  /** Appelle un outil du serveur MCP du client avec la même mise en scène (images non relayées). */
  | {
      kind: 'mcp-tool'
      tool: string
      args: Record<string, unknown>
      onResult: (text: string) => Step[]
    }
  /** Demande au serveur MCP du client ses outils (`tools/list`), sans carte : noms séparés par « , ». */
  | { kind: 'mcp-list'; onResult: (names: string) => Step[] }
  /**
   * Comme OpenCode 2 (« Code Mode », fiche 079) : une carte `execute` dont le code appelle des
   * outils du serveur MCP du client, sans demande d'autorisation ; les appels MCP arrivent pendant
   * que la carte est en cours.
   */
  | {
      kind: 'code-mode'
      calls: { tool: string; args: Record<string, unknown> }[]
      onResult: (text: string) => Step[]
    }
  /** Joue des étapes au nom d'une session enfant (sous-agent). */
  | { kind: 'child'; sessionId: string; steps: Step[] }
  /**
   * Travail d'un sous-agent relayé dans le flux de la session, comme OpenCode 2.0.31 (fiche 078) :
   * `_meta["opencode/child-session"]` sur chaque mise à jour, identifiants d'outil préfixés
   * `<session>:`, titres préfixés « <titre> : ».
   */
  | {
      kind: 'opencode-child'
      child: { id: string; parentId: string; depth?: number; title?: string }
      steps: Step[]
    }
  /**
   * Garde une session de sous-agent, rechargeable par `session/load` comme chez OpenCode 1.19
   * (fiche 053) : son échange est mémorisé sans être envoyé.
   */
  | {
      kind: 'child-session'
      sessionId: string
      history: SessionUpdate[]
      /**
       * Sous-agent en arrière-plan (OpenCode 2, fiche 122) : la session est réécrite avec cet
       * échange `afterMs` après, sans attendre (il finit après son outil, voire après le tour).
       */
      later?: { afterMs: number; history: SessionUpdate[] }
    }
  /**
   * Écrit dans la base de Bob (`--bob-db`), comme Bob 2.0.6 pendant un sous-agent (fiche 053) :
   * ligne créée au lancement, coût réécrit à chaque dépense, terminée à la fin. Sans base : rien.
   */
  | { kind: 'bob-subagent'; id: string; title?: string; cost?: number; done?: boolean }
  /**
   * Modifie un fichier du dossier de la session, comme l'outil d'édition d'un agent : carte d'outil
   * avec le diff (texte complet avant / après), écriture réelle, puis outil terminé.
   * `edit` : remplace un extrait ; sinon `content` est le nouveau contenu complet.
   */
  | {
      kind: 'edit-file'
      path: string
      content?: string
      edit?: { from: string; to: string }
      /** Fichier créé annoncé avec `oldText: ""` au lieu de `null`, comme Bob 2.0.6. */
      emptyOldText?: boolean
    }
  /**
   * Outil « patch » d'OpenCode 2.0.32 (fiche 096) : modifie des fichiers du dossier de la session
   * (`content` : contenu complet ; `edit` : remplace un extrait, fichier absent ignoré), carte
   * terminée avec un diff par fichier et `rawOutput.metadata.files[]`. Le rejeu garde la forme
   * qu'OpenCode renvoie quand le fichier a changé depuis : sans diff, sauf pour un fichier créé.
   */
  | {
      kind: 'opencode-patch'
      files: { path: string; content?: string; edit?: { from: string; to: string } }[]
    }
  /**
   * Outil `write` d'OpenCode 2.2.5 (fiche 202, traces `__traces__/opencode-2.2.5/creation-*`) :
   * annoncé sans rien, puis son entrée (`rawInput: { path, content }`) ; fini par un seul texte,
   * « Created file successfully » ou « Wrote file successfully », SANS diff. `ask` : demande
   * d'autorisation d'abord, seule à porter le diff (permission `edit: ask` d'OpenCode).
   */
  | { kind: 'opencode-write'; path: string; content: string; ask?: boolean }
  /**
   * Écrit un fichier du dossier de la session sans rien dire à l'app (ni carte, ni message) : ce
   * que fait l'outil d'un agent entre son autorisation et sa fin (fiche 203, scénarios Bob).
   */
  | { kind: 'write-file'; path: string; content: string }
  /** Suite différente selon le message reçu (contient `includes`, sans tenir compte de la casse). */
  | { kind: 'when-prompt'; includes: string; then: Step[]; else: Step[] }
  /** Suite différente selon le modèle de la session au moment du message (fiche 210). */
  | { kind: 'when-model'; model: string; then: Step[]; else: Step[] }
  /**
   * Fait échouer le tour avec une erreur JSON-RPC interne : `message` s'ajoute à « Internal error »,
   * `data` est joint tel quel (Bob y met la cause, dans `details`). `code` : autre code JSON-RPC
   * (le message est alors `message` seul) ; `stderr` : ligne écrite avant sur la sortie d'erreur.
   */
  | { kind: 'fail'; message?: string; data?: unknown; code?: number; stderr?: string }
  /**
   * `authRequired` (comme OpenCode 2.2.5) tant que `.mock-agent-logged-in` n'est pas là, ou que
   * la connexion SSO n'est pas refaite (D10). `error` : l'erreur JSON-RPC envoyée à la place (Bob
   * 2.0.9 : `-32603` « Invalid or expired API key », fiche 200).
   */
  | { kind: 'login-required'; error?: { code: number; message: string; data?: unknown } }
  /**
   * Panne passagère (fiche 142) : `fail` les `failures` premières fois que la session passe par
   * cette étape (une reconnexion renvoie le même message), puis `then`.
   */
  | { kind: 'flaky'; failures: number; fail: Step; then: Step[] }
  /** Le processus s'arrête net (plantage), après un message sur stderr. */
  | { kind: 'crash'; code?: number; stderr?: string }
  /**
   * Ne répond plus du tout : le tour ne se termine jamais, même après `session/cancel`. `text` est
   * envoyé d'un bloc juste avant (aucun moment où « Stop » interromprait encore le tour).
   */
  | { kind: 'hang'; text?: string }
  /** Écrit une ligne qui n'est pas du JSON-RPC sur stdout (journal mal placé). */
  | { kind: 'stdout-noise'; text: string }
  /**
   * Lance une commande dans le groupe de l'agent, sans l'attendre (fiche 195) : comme la commande
   * d'un vrai agent, qui lui survit s'il meurt (`kill -9`).
   */
  | {
      kind: 'spawn'
      command: string
      args: string[]
      /**
       * Détaché par l'agent (nouvelle session, comme `setsid` ou `nohup … &` dans un shell à part) :
       * hors du groupe de l'agent, Bobine ne le voit pas (fiche 195, M3).
       */
      detached?: boolean
    }
  /** Le processus reçoit un signal (fiche 195) : `SIGKILL`, `SIGSEGV`… mort sans un mot. */
  | { kind: 'signal'; signal: NodeJS.Signals }
  /** Flot sur stderr (fiche 195) : `lines` lignes de `bytes` octets, puis le tour continue. */
  | { kind: 'stderr-flood'; lines: number; bytes: number }
  /**
   * Ferme stdout et ne répond plus (fiche 195) : connexion coupée, processus vivant. Seul son
   * arrêt par l'app le termine.
   */
  | { kind: 'close-stdout' }

export interface Scenario {
  description: string
  steps: Step[]
  /** Raison d'arrêt renvoyée en fin de tour (défaut : `end_turn`). */
  stopReason?: StopReason
  /**
   * Ce que l'agent annonce à `initialize` à la place de ses valeurs (fiche 198) : version de
   * l'agent (défaut `0.1.0`), version du protocole ACP (défaut : celle du SDK ; `null` : absente).
   */
  announce?: { version?: string; protocolVersion?: number | null }
  /** Comportements de session, pour simuler les particularités de Bob. */
  session?: {
    /** `session/new` échoue tant que `authenticate` n'a pas été appelé. */
    requireAuth?: boolean
    /**
     * SSO fini dans le navigateur mais `authenticate` qui ne répond jamais (fiche 207) : la
     * connexion est notée (`.mock-agent-logged-in` dans le dossier de lancement), un agent relancé
     * ouvre donc sa session.
     */
    ssoNeverAnswers?: boolean
    /** `session/new` échoue : workspace non approuvé. */
    untrustedWorkspace?: boolean
    /**
     * Connexion « dans un terminal » (comme `opencode-login`) : `session/new` échoue tant que le
     * fichier `.mock-agent-logged-in` n'est pas dans le dossier (ou sans `MOCK_AGENT_API_KEY`).
     */
    terminalLogin?: boolean
    /**
     * Connexion expirée (comme OpenCode 2.2.5) : la session s'ouvre ; c'est l'étape
     * `login-required` qui refuse le message. `terminal` : méthode « terminal » annoncée (fichier
     * `.mock-agent-logged-in`) ; `sso` : méthode SSO (`authenticate`, comme Bob).
     */
    expiredLogin?: 'terminal' | 'sso'
    /** `session/load` refusé lui aussi (`authRequired`) tant que la connexion n'est pas refaite. */
    reopenNeedsLogin?: boolean
    /** Licence à accepter (Bob) : `-32600` tant que `.mock-agent-license` n'est pas dans le dossier. */
    requireLicense?: boolean
    /**
     * Limite d'étapes comptée sur toute la session, comme Bob 2.0.9 (fiche 209) : voir
     * `limite-etapes.mts`.
     */
    stepLimit?: StepLimit
  }
}

/** Limite d'étapes d'une session (fiche 209). */
export interface StepLimit {
  /**
   * Compteur enregistré avec la session : il survit à une relance de l'agent (`session/load` ne le
   * remet pas à zéro). Sinon, il vit dans le processus, comme le compte de Bob 2.0.9.
   */
  persistent?: boolean
  /** Étapes jouées quand le message demande de continuer (il contient « continu »). */
  continueSteps: Step[]
}

export interface TurnContext {
  sessionId: string
  prompt: ContentBlock[]
  /** Serveurs MCP fournis par le client pour cette session. */
  mcpServers?: McpServer[]
  signal: AbortSignal
  /** Délai de base entre deux morceaux, en millisecondes. 0 = aussi vite que possible. */
  delayMs: number
  client: AgentContext
  /** Dossier de la session (étape `edit-file`). */
  cwd?: string
  /** `authenticate` (SSO simulé) déjà appelé dans ce processus (étape `login-required`). */
  loggedIn?: boolean
  /** Autres dossiers reçus à l'ouverture de la session (étape `folders`, fiche 179). */
  additionalDirectories?: readonly string[]
  /** Modèle de la session au moment du message (étape `when-model`). */
  model?: string
  /** Résumé des réglages de session (mode, modèle…), affiché par l'étape `echo`. */
  describeSession?: () => string
  /** Transforme chaque update avant l'envoi (travail d'un sous-agent d'OpenCode 2). */
  project?: (update: SessionUpdate) => SessionUpdate
  /**
   * Appelé pour chaque update envoyée, sous la forme que l'agent rejouera (l'agent s'en sert pour
   * mémoriser l'échange).
   */
  onUpdate?: (sessionId: string, update: SessionUpdate) => void
  /** Mémorise une session de sous-agent (étape `child-session`). */
  saveChildSession?: (sessionId: string, history: SessionUpdate[]) => void
  /** Base de Bob où écrire les sous-agents (étape `bob-subagent`), jamais celle de l'utilisateur. */
  bobDb?: string
  /** Agent sans plan (`--sans-plan`, fiche 139) : les mises à jour `plan` ne partent pas. */
  withoutPlan?: boolean
  /**
   * Délai de fin des sous-agents en arrière-plan (`--arriere-plan-ms`, fiche 139), à la place de
   * celui du scénario (4 s, 12 s) : la grille de conformité n'attend pas.
   */
  backgroundMs?: number
  /** Langue des textes envoyés (fiche 167) ; français par défaut. */
  language?: MockLanguage
}

/** Levée quand le tour est annulé par le client (`session/cancel`). */
export class TurnCancelled extends Error {}

export async function playSteps(steps: Step[], ctx: TurnContext): Promise<void> {
  for (const step of steps) {
    await playStep(step, ctx)
  }
}

async function playStep(step: Step, ctx: TurnContext): Promise<void> {
  switch (step.kind) {
    case 'text':
      return streamChunks(ctx, say(step.text, lang(ctx)), 'agent_message_chunk')
    case 'thought':
      return streamChunks(ctx, say(step.text, lang(ctx)), 'agent_thought_chunk')
    case 'update':
      return send(ctx, sayAll(step.update, lang(ctx)))
    case 'pause':
      return tick(ctx, step.ticks)
    case 'parallel':
      await Promise.all(step.branches.map((branch) => playSteps(branch, ctx)))
      return
    case 'permission': {
      const withdrawal = new AbortController()
      const timer = step.agentCancels
        ? setTimeout(() => withdrawal.abort(), ctx.delayMs * step.agentCancels.afterTicks)
        : undefined
      const response = await ctx.client
        .request(
          methods.client.session.requestPermission,
          {
            sessionId: ctx.sessionId,
            toolCall: inSessionPaths(ctx, sayAll(step.toolCall, lang(ctx))),
            options: sayAll(step.options, lang(ctx))
          },
          // L'annulation envoie `$/cancel_request` ; la réponse du client est attendue quand même.
          { cancellationSignal: withdrawal.signal }
        )
        .finally(() => clearTimeout(timer))
      if (
        step.agentCancels &&
        withdrawal.signal.aborted &&
        response.outcome.outcome !== 'selected'
      ) {
        return playSteps(step.agentCancels.steps, ctx)
      }
      if (response.outcome.outcome !== 'selected') throw new TurnCancelled()
      const branch = step.branches[response.outcome.optionId]
      if (!branch) throw RequestError.invalidParams({ optionId: response.outcome.optionId })
      return playSteps(branch, ctx)
    }
    case 'elicitation': {
      const response = await ctx.client.request(
        methods.client.elicitation.create,
        step.url
          ? {
              sessionId: ctx.sessionId,
              mode: 'url',
              elicitationId: `elicitation-${Date.now()}`,
              message: step.message,
              url: step.url
            }
          : {
              sessionId: ctx.sessionId,
              mode: 'form',
              message: step.message,
              requestedSchema: step.schema ?? { type: 'object', properties: {} },
              ...(step.toolCallId ? { toolCallId: step.toolCallId } : {})
            }
      )
      if (response.action === 'accept') {
        const content = 'content' in response && response.content ? response.content : {}
        return playSteps(step.onAccept(content as Record<string, unknown>), ctx)
      }
      if (response.action === 'cancel') throw new TurnCancelled()
      return playSteps(step.onDecline, ctx)
    }
    case 'echo': {
      const header = ctx.describeSession ? `${ctx.describeSession()}\n\n` : ''
      const received = describePrompt(ctx.prompt, lang(ctx))
      return streamChunks(ctx, header + received, 'agent_message_chunk')
    }
    case 'context':
      return streamChunks(ctx, describeContext(ctx.prompt), 'agent_message_chunk')
    case 'folders':
      return streamChunks(ctx, describeFolders(ctx), 'agent_message_chunk')
    case 'aside':
      return streamChunks(
        ctx,
        describeAside(ctx.prompt, lang(ctx), ctx.describeSession?.()),
        'agent_message_chunk'
      )
    case 'child':
      return playSteps(step.steps, { ...ctx, sessionId: step.sessionId })
    case 'opencode-child':
      return playSteps(step.steps, { ...ctx, project: openCodeChild(step.child) })
    case 'child-session': {
      ctx.saveChildSession?.(step.sessionId, step.history)
      const later = step.later
      if (later)
        setTimeout(
          () => ctx.saveChildSession?.(step.sessionId, later.history),
          ctx.backgroundMs ?? later.afterMs
        )
      return
    }
    case 'bob-subagent':
      if (ctx.bobDb) writeBobSubagent(ctx.bobDb, ctx.sessionId, step)
      return
    case 'ask-user':
      return playSteps(step.onResult(await callMcpTool(ctx, 'ask_user', step.args)), ctx)
    case 'mcp-tool':
      return playSteps(step.onResult(await callMcpTool(ctx, step.tool, step.args)), ctx)
    case 'mcp-list':
      return playSteps(step.onResult(await listMcpTools(ctx)), ctx)
    case 'code-mode':
      return playSteps(step.onResult(await runCodeMode(ctx, step.calls)), ctx)
    case 'edit-file':
      return editFile(ctx, step)
    case 'opencode-patch':
      return openCodePatch(ctx, step)
    case 'opencode-write':
      return openCodeWrite(ctx, step)
    case 'write-file': {
      const path = inSession(ctx, step.path)
      await mkdir(dirname(path), { recursive: true })
      return writeFile(path, step.content)
    }
    case 'when-prompt': {
      const text = ctx.prompt
        .map((b) => (b.type === 'text' ? b.text : ''))
        .join('\n')
        .toLowerCase()
      return playSteps(text.includes(step.includes.toLowerCase()) ? step.then : step.else, ctx)
    }
    case 'when-model':
      return playSteps(ctx.model === step.model ? step.then : step.else, ctx)
    case 'login-required':
      if (
        ctx.loggedIn ||
        existsSync(join(ctx.cwd ?? '.', LOGIN_MARKER)) ||
        existsSync(join(process.cwd(), LOGIN_MARKER))
      )
        return
      if (step.error) throw new RequestError(step.error.code, step.error.message, step.error.data)
      throw RequestError.authRequired({}, 'provider authentication required')
    case 'fail':
      if (step.stderr) process.stderr.write(`${step.stderr}\n`)
      if (step.code !== undefined) throw new RequestError(step.code, step.message ?? '', step.data)
      throw RequestError.internalError(step.data, step.message)
    case 'flaky': {
      const seen = flakyRuns.get(step) ?? new Map<string, number>()
      flakyRuns.set(step, seen)
      const runs = seen.get(ctx.sessionId) ?? 0
      seen.set(ctx.sessionId, runs + 1)
      return runs < step.failures ? playStep(step.fail, ctx) : playSteps(step.then, ctx)
    }
    case 'crash':
      if (step.stderr) process.stderr.write(`${step.stderr}\n`)
      // Laisse partir les updates déjà écrites, puis s'arrête sans répondre au tour.
      await new Promise((resolve) => setTimeout(resolve, 20))
      process.exit(step.code ?? 1)
      return
    case 'hang':
      if (step.text)
        await send(ctx, {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: say(step.text, lang(ctx)) }
        })
      // Ignore `session/cancel` : seul l'arrêt du processus termine ce tour.
      return new Promise<void>(() => {})
    case 'stdout-noise':
      process.stdout.write(`${step.text}\n`)
      return
    case 'spawn':
      spawnChild(step.command, step.args, {
        stdio: 'ignore',
        ...(step.detached ? { detached: true } : {})
      }).unref()
      return
    case 'signal':
      // Laisse partir les updates déjà écrites, comme `crash`.
      await new Promise((resolve) => setTimeout(resolve, 20))
      process.kill(process.pid, step.signal)
      return new Promise<void>(() => {})
    case 'stderr-flood': {
      const line = `${'bruit '.repeat(Math.ceil(step.bytes / 6)).slice(0, step.bytes)}\n`
      for (let i = 0; i < step.lines; i++) {
        if (!process.stderr.write(line))
          await new Promise((resolve) => process.stderr.once('drain', resolve))
      }
      return
    }
    case 'close-stdout':
      await new Promise((resolve) => setTimeout(resolve, 20))
      process.stdout.end()
      // Garde le processus en vie : sans ce minuteur, Node sortirait faute de travail.
      setInterval(() => {}, 60_000)
      return new Promise<void>(() => {})
  }
}

let editCount = 0

/** Passages de chaque étape `flaky`, par session. */
/** Message de Bob quand la licence IBM n'est pas acceptée (code -32600, 2.0.6 et 2.0.9). */
export const LICENSE_MESSAGE =
  'A license agreement is required. Review it with --show-license and accept it with --accept-license.'

/**
 * Connexion refusée au message par Bob 2.0.9 (`pnpm bob-probe`, 07/11, fiche 200) : SSO expiré ou
 * clé refusée, sa passerelle a répondu 401. Telle que reçue, `data` compris.
 */
export const BOB_EXPIRED_LOGIN = {
  code: -32603,
  message: 'Internal error',
  data: {
    details:
      'ApiKeyError: {"id":"harness","title":"Request Failed","description":"Invalid or expired API key."}'
  }
}

/** Formulaire de licence de Bob 2.0.9 au premier message (élicitation `form`, relevé le 05/11). */
export const BOB_LICENSE_FORM_MESSAGE = [
  'Bob Shell requires the IBM license agreement. Review the license files:',
  '- /usr/local/lib/node_modules/@ibm/bob/dist/ibm-licence/license.txt',
  '- /usr/local/lib/node_modules/@ibm/bob/dist/ibm-licence/non_ibm_license.txt',
  '- /usr/local/lib/node_modules/@ibm/bob/dist/ibm-licence/notices.txt'
].join('\n')

const flakyRuns = new WeakMap<Step, Map<string, number>>()

async function editFile(
  ctx: TurnContext,
  step: Extract<Step, { kind: 'edit-file' }>
): Promise<void> {
  const path = inSession(ctx, step.path)
  const oldText = await readFile(path, 'utf8').catch(() => null)
  const newText = step.edit
    ? (oldText ?? '').replace(step.edit.from, step.edit.to)
    : (step.content ?? '')
  const toolCallId = `edit_${++editCount}`
  await send(ctx, {
    sessionUpdate: 'tool_call',
    toolCallId,
    title: `${oldText === null ? 'Création' : 'Modification'} de ${step.path}`,
    kind: 'edit',
    status: 'in_progress',
    locations: [{ path }],
    content: [{ type: 'diff', path, oldText: oldText ?? (step.emptyOldText ? '' : null), newText }]
  })
  await tick(ctx, 1)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, newText)
  await send(ctx, { sessionUpdate: 'tool_call_update', toolCallId, status: 'completed' })
}

/**
 * `{cwd}` dans un emplacement d'outil (`locations[].path`), son titre, une valeur texte de
 * `rawInput` ou le chemin d'un diff (`content[].path`, fiche 203) : le dossier de la session, pour
 * qu'un scénario cite des fichiers du dossier réel (chemins relatifs des cartes, fiche 107 ; titres
 * bruts de Bob, fiche 125). `{cwd:<relatif>}` : ce chemin résolu depuis le dossier de la session,
 * normalisé (`..` compris), comme l'emplacement absolu qu'OpenCode envoie pour un `workdir`
 * relatif (fiche 203, trace `commande-dans-un-sous-dossier`).
 */
function inSessionPaths<T extends SessionUpdate | ToolCallUpdate>(ctx: TurnContext, update: T): T {
  const cwd = ctx.cwd
  if (
    !cwd ||
    ('sessionUpdate' in update &&
      update.sessionUpdate !== 'tool_call' &&
      update.sessionUpdate !== 'tool_call_update')
  ) {
    return update
  }
  const tool = update as ToolCallUpdate
  const resolve = (value: string) =>
    value.replace(/\{cwd:([^}]*)\}/g, (_, rel: string) => join(cwd, rel)).replaceAll('{cwd}', cwd)
  const locations = tool.locations?.map((location) => ({
    ...location,
    path: resolve(location.path)
  }))
  const content = tool.content?.map((item) =>
    item.type === 'diff' ? { ...item, path: resolve(item.path) } : item
  )
  const raw = tool.rawInput
  const rawInput =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? Object.fromEntries(
          Object.entries(raw as Record<string, unknown>).map(([key, value]) => [
            key,
            typeof value === 'string' ? resolve(value) : value
          ])
        )
      : raw
  return {
    ...update,
    ...(tool.title ? { title: resolve(tool.title) } : {}),
    ...(locations ? { locations } : {}),
    ...(content ? { content } : {}),
    ...(rawInput !== undefined ? { rawInput } : {})
  }
}

/** Chemin d'un fichier du dossier de la session ; jamais en dehors. */
function inSession(ctx: TurnContext, file: string): string {
  if (!ctx.cwd) throw RequestError.internalError(undefined, 'Dossier de session inconnu')
  const path = join(ctx.cwd, file)
  const rel = relative(ctx.cwd, path)
  if (rel.startsWith('..') || isAbsolute(rel)) throw RequestError.invalidParams({ path: file })
  return path
}

/**
 * Outil « patch » d'OpenCode 2.0.32, relevé dans l'essai du 2026-10-20 (fiche 096) : carte titrée
 * « patch » (`kind: edit`), `rawInput.patchText`, écriture réelle, puis carte terminée avec un diff
 * par fichier (texte complet) et `rawOutput.metadata.files[]` (`file` relatif, `patch` unifié en
 * `Index: <chemin absolu>`, `additions`, `deletions`, `status`).
 */
async function openCodePatch(
  ctx: TurnContext,
  step: Extract<Step, { kind: 'opencode-patch' }>
): Promise<void> {
  // Plusieurs entrées pour un même fichier s'enchaînent (un bloc du patch chacune).
  const byPath = new Map<
    string,
    { file: string; path: string; oldText: string | null; newText: string }
  >()
  for (const file of step.files) {
    const path = inSession(ctx, file.path)
    const known = byPath.get(path)
    const oldText = known ? known.oldText : await readFile(path, 'utf8').catch(() => null)
    const current = known ? known.newText : oldText
    if (file.edit && current === null) continue
    const newText = file.edit
      ? (current ?? '').replace(file.edit.from, file.edit.to)
      : (file.content ?? '')
    byPath.set(path, { file: file.path, path, oldText, newText })
  }
  const changes = [...byPath.values()].filter((c) => c.newText !== c.oldText)
  const toolCallId = `patch_${++editCount}`
  const mark = (c: (typeof changes)[number]) => (c.oldText === null ? 'A' : 'M')
  await send(ctx, {
    sessionUpdate: 'tool_call',
    toolCallId,
    title: 'patch',
    kind: 'edit',
    status: 'pending',
    rawInput: {}
  })
  await send(ctx, {
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status: 'in_progress',
    locations: changes.map((c) => ({ path: c.path })),
    rawInput: {
      patchText: [
        '*** Begin Patch',
        ...changes.map((c) => `*** ${c.oldText === null ? 'Add' : 'Update'} File: ${c.file}`),
        '*** End Patch'
      ].join('\n')
    }
  })
  await tick(ctx, 1)
  for (const c of changes) {
    await mkdir(dirname(c.path), { recursive: true })
    await writeFile(c.path, c.newText)
  }
  const files = changes.map((c) => {
    const lines = structuredPatch(c.path, c.path, c.oldText ?? '', c.newText).hunks.flatMap(
      (h) => h.lines
    )
    return {
      file: c.file,
      patch: createTwoFilesPatch(c.path, c.path, c.oldText ?? '', c.newText),
      additions: lines.filter((l) => l.startsWith('+')).length,
      deletions: lines.filter((l) => l.startsWith('-')).length,
      status: c.oldText === null ? 'added' : 'modified'
    }
  })
  const text = {
    type: 'content' as const,
    content: {
      type: 'text' as const,
      text: [
        'Success. Updated the following files:',
        ...changes.map((c) => `${mark(c)} ${c.file}`)
      ].join('\n')
    }
  }
  const diffs = changes.map((c) => ({
    type: 'diff' as const,
    path: c.path,
    oldText: c.oldText,
    newText: c.newText
  }))
  const completed = {
    sessionUpdate: 'tool_call_update' as const,
    toolCallId,
    status: 'completed' as const,
    rawOutput: { metadata: { files } }
  }
  // Rejeu : OpenCode relit le fichier actuel et lui applique le patch à l'envers ; changé depuis,
  // plus de diff. Un fichier créé garde le sien.
  await send(
    ctx,
    { ...completed, content: [text, ...diffs] },
    { ...completed, content: [text, ...diffs.filter((d) => d.oldText === null)] }
  )
}

/** Outil `write` d'OpenCode 2.2.5, message pour message (voir l'étape `opencode-write`). */
async function openCodeWrite(
  ctx: TurnContext,
  step: Extract<Step, { kind: 'opencode-write' }>
): Promise<void> {
  const path = inSession(ctx, step.path)
  const oldText = await readFile(path, 'utf8').catch(() => null)
  const toolCallId = `write_${++editCount}`
  const locations = [{ path }]
  const rawInput = { path, content: step.content }
  await send(ctx, {
    sessionUpdate: 'tool_call',
    toolCallId,
    title: 'write',
    kind: 'edit',
    status: 'pending',
    locations: [],
    rawInput: {}
  })
  await tick(ctx, 1)
  await send(ctx, {
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status: 'in_progress',
    kind: 'edit',
    title: 'write',
    locations,
    rawInput
  })
  const text = (t: string) => [
    { type: 'content' as const, content: { type: 'text' as const, text: t } }
  ]
  if (step.ask) {
    const answer: RequestPermissionResponse = await ctx.client.request(
      methods.client.session.requestPermission,
      {
        sessionId: ctx.sessionId,
        toolCall: {
          toolCallId,
          title: path,
          kind: 'edit',
          status: 'pending',
          locations,
          rawInput,
          content: [{ type: 'diff', path, oldText, newText: step.content }]
        },
        options: [
          { optionId: 'once', kind: 'allow_once', name: 'Allow once' },
          { optionId: 'always', kind: 'allow_always', name: 'Always allow' },
          { optionId: 'reject', kind: 'reject_once', name: 'Reject' }
        ]
      }
    )
    if (answer.outcome.outcome !== 'selected' || answer.outcome.optionId === 'reject') {
      await send(ctx, {
        sessionUpdate: 'tool_call_update',
        toolCallId,
        status: 'failed',
        content: text('The user rejected permission to use this specific tool call.')
      })
      return
    }
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, step.content)
  const done = `${oldText === null ? 'Created' : 'Wrote'} file successfully: ${step.path}`
  await send(ctx, {
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status: 'completed',
    locations,
    content: text(done),
    rawOutput: { metadata: { truncated: false } }
  })
}

async function streamChunks(
  ctx: TurnContext,
  text: string,
  sessionUpdate: 'agent_message_chunk' | 'agent_thought_chunk'
): Promise<void> {
  for (const chunk of splitIntoChunks(text)) {
    await send(ctx, { sessionUpdate, content: { type: 'text', text: chunk } })
    await tick(ctx, 1)
  }
}

/** Base de Bob d'essai, créée au besoin avec la table `tasks` relevée sur Bob 2.0.6. */
function openBobDb(file: string): DatabaseSync {
  mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, parent_id TEXT, task_type TEXT NOT NULL DEFAULT 'normal',
    title TEXT NOT NULL DEFAULT '', status TEXT, costs TEXT,
    created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0)`)
  return db
}

/**
 * Coût cumulé de la tâche d'une session, comme Bob 2.0.6 l'écrit après chaque réponse
 * (`--cout-bob`, fiche 109) : `{"cost":…,"contextTokens":…}`.
 */
export function writeBobTaskCost(file: string, sessionId: string, cost: number): void {
  const db = openBobDb(file)
  try {
    const now = Date.now()
    db.prepare(
      `INSERT OR IGNORE INTO tasks (id, task_type, status, created_at, updated_at)
       VALUES (?, 'normal', 'running', ?, ?)`
    ).run(sessionId, now, now)
    db.prepare('UPDATE tasks SET costs = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify({ cost, contextTokens: 10_000 }),
      now,
      sessionId
    )
  } finally {
    db.close()
  }
}

/**
 * Tâche supprimée de la base de Bob, avec ses sous-agents, comme `session/delete` de Bob (fiche
 * 026) : son coût disparaît avec elle (recette 0.10, D10).
 */
export function deleteBobTask(file: string, sessionId: string): void {
  if (!existsSync(file)) return
  const db = openBobDb(file)
  try {
    db.prepare('DELETE FROM tasks WHERE id = ? OR parent_id = ?').run(sessionId, sessionId)
  } finally {
    db.close()
  }
}

/** Ligne de sous-agent dans la base de Bob, au format relevé sur Bob 2.0.6 (fiche 053). */
function writeBobSubagent(
  file: string,
  parentId: string,
  step: Extract<Step, { kind: 'bob-subagent' }>
): void {
  const db = openBobDb(file)
  try {
    const now = Date.now()
    db.prepare(
      `INSERT OR IGNORE INTO tasks (id, parent_id, task_type, title, status, created_at, updated_at)
       VALUES (?, ?, 'subagent', ?, 'running', ?, ?)`
    ).run(step.id, parentId, step.title ?? '', now, now)
    if (step.cost !== undefined) {
      db.prepare('UPDATE tasks SET costs = ?, updated_at = ? WHERE id = ?').run(
        JSON.stringify({ cost: step.cost, contextTokens: 1200 }),
        now,
        step.id
      )
    }
    if (step.done) db.prepare(`UPDATE tasks SET status = 'completed' WHERE id = ?`).run(step.id)
  } finally {
    db.close()
  }
}

/** Envoie une update ; `replayed` : autre forme gardée pour le rejeu (défaut : la même). */
async function send(ctx: TurnContext, raw: SessionUpdate, replayed?: SessionUpdate): Promise<void> {
  if (ctx.signal.aborted) throw new TurnCancelled()
  if (ctx.withoutPlan && raw.sessionUpdate === 'plan') return
  const project = (u: SessionUpdate) => (ctx.project ? ctx.project(u) : u)
  const update = project(inSessionPaths(ctx, raw))
  ctx.onUpdate?.(ctx.sessionId, replayed ? project(replayed) : update)
  await ctx.client.notify(methods.client.session.update, { sessionId: ctx.sessionId, update })
}

/** Projection d'OpenCode 2.0.31 (`packages/cli/src/acp/child.ts`, `project`). */
function openCodeChild(child: {
  id: string
  parentId: string
  depth?: number
  title?: string
}): (update: SessionUpdate) => SessionUpdate {
  const marker = {
    'opencode/child-session': {
      id: child.id,
      parentID: child.parentId,
      depth: child.depth ?? 1,
      ...(child.title ? { title: child.title } : {})
    }
  }
  return (update) => {
    const projected = { ...update, _meta: { ...update._meta, ...marker } } as SessionUpdate
    if (projected.sessionUpdate !== 'tool_call' && projected.sessionUpdate !== 'tool_call_update') {
      return projected
    }
    return {
      ...projected,
      toolCallId: `${child.id}:${projected.toolCallId}`,
      ...(projected.title && child.title ? { title: `${child.title}: ${projected.title}` } : {})
    }
  }
}

/** Attend `ticks` × délai de base, en réagissant à l'annulation. */
function tick(ctx: TurnContext, ticks: number): Promise<void> {
  const ms = ctx.delayMs * ticks
  return new Promise((resolve, reject) => {
    if (ctx.signal.aborted) return reject(new TurnCancelled())
    const onAbort = () => {
      clearTimeout(timer)
      reject(new TurnCancelled())
    }
    const timer = setTimeout(() => {
      ctx.signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    ctx.signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** Découpe un texte en morceaux de quelques mots, en conservant les espaces et retours à la ligne. */
export function splitIntoChunks(text: string, wordsPerChunk = 3): string[] {
  const tokens = text.match(/\S+\s*|\s+/g) ?? []
  const chunks: string[] = []
  for (let i = 0; i < tokens.length; i += wordsPerChunk) {
    chunks.push(tokens.slice(i, i + wordsPerChunk).join(''))
  }
  return chunks
}

/** Langue du tour (français par défaut). */
const lang = (ctx: TurnContext): MockLanguage => ctx.language ?? 'fr'

/** Dossiers que voit la session (étape `folders`, fiche 179), en liste Markdown. */
function describeFolders(ctx: TurnContext): string {
  const others = ctx.additionalDirectories ?? []
  const told = ctx.prompt
    .flatMap((block) => (block.type === 'text' ? block.text.split('\n') : []))
    .find((line) => line.startsWith('Additional working directories'))
  const lines = [
    `${say('Dossier de travail', lang(ctx))} : \`${ctx.cwd ?? '?'}\``,
    others.length > 0
      ? `${say('Autres dossiers', lang(ctx))} :\n${others.map((d) => `- \`${d}\``).join('\n')}`
      : say('Aucun autre dossier reçu.', lang(ctx)),
    // Ligne de contexte de l'app (D13) : une fois par changement de la liste, pas à chaque tour.
    told
      ? `${say('Ligne reçue', lang(ctx))} : ${told}`
      : say('Pas de ligne sur les dossiers dans ce message.', lang(ctx))
  ]
  return lines.join('\n\n')
}

export function describePrompt(prompt: ContentBlock[], language: MockLanguage = 'fr'): string {
  const en = language === 'en'
  const lines = prompt.map((block) => {
    switch (block.type) {
      case 'text':
        return en ? `- text: “${block.text}”` : `- texte : « ${block.text} »`
      case 'image': {
        const bytes = Math.round((block.data.length * 3) / 4)
        return en
          ? `- image: ${block.mimeType}, ${bytes} bytes`
          : `- image : ${block.mimeType}, ${bytes} octets`
      }
      case 'audio':
        return en ? `- audio: ${block.mimeType}` : `- audio : ${block.mimeType}`
      case 'resource_link':
        return en ? `- resource link: ${block.uri}` : `- lien de ressource : ${block.uri}`
      case 'resource':
        return en
          ? `- embedded resource: ${block.resource.uri}`
          : `- ressource intégrée : ${block.resource.uri}`
      default:
        return en ? `- unknown block type` : `- bloc de type inconnu`
    }
  })
  const header = en
    ? `I received ${prompt.length} block(s):`
    : `J'ai reçu ${prompt.length} bloc(s) :`
  return `${header}\n\n${lines.join('\n')}\n`
}

/**
 * Contexte caché reçu avant le message (bascule d'agent, fiche 108 ; branche, fiche 023) : qui l'a
 * commencé, combien de messages de chaque côté, la première demande. Rien de reçu : on le dit.
 */
export function describeContext(prompt: ContentBlock[]): string {
  const text = prompt.find(
    (b): b is Extract<ContentBlock, { type: 'text' }> =>
      b.type === 'text' && b.text.includes('<earlier_conversation>')
  )?.text
  if (!text) return 'Aucun contexte reçu avant ce message.'
  const lines = text.split('\n')
  const users = lines.filter((l) => l.startsWith('User: '))
  const replies = lines.filter((l) => l.startsWith('Assistant: ')).length
  const from = /started with another assistant \(([^)]+)\)/.exec(text)?.[1]
  const first = users[0]?.slice('User: '.length) ?? ''
  return [
    `Contexte reçu${from ? ` de « ${from} »` : ''} : ${users.length} message(s) de l'utilisateur,`,
    `${replies} réponse(s). Première demande : « ${first} ».`
  ].join(' ')
}

/** Aparté reçu (fiche 180) : consigne de Bobine, fin du fil jointe ou non, réglages de session. */
export function describeAside(
  prompt: ContentBlock[],
  language: MockLanguage,
  settings: string | undefined
): string {
  const text = prompt.find(
    (b): b is Extract<ContentBlock, { type: 'text' }> =>
      b.type === 'text' && b.text.includes('<bobine_aside>')
  )?.text
  const en = language === 'en'
  if (!text) return en ? 'No aside instruction received.' : 'Aucune consigne d’aparté reçue.'
  const readOnly = /Read only/.test(text)
  const joined = text.includes('<main_conversation>')
  const users = text.split('\n').filter((l) => l.startsWith('User: ')).length
  const parts = en
    ? [
        `Aside received${readOnly ? ', read only' : ''}.`,
        joined
          ? `Main conversation joined: ${users} user message(s).`
          : 'Nothing from the main conversation.'
      ]
    : [
        `Aparté reçu${readOnly ? ', en lecture seule' : ''}.`,
        joined
          ? `Fil principal joint : ${users} message(s) de l’utilisateur.`
          : 'Rien du fil principal.'
      ]
  return [...parts, ...(settings ? [settings] : [])].join(' ')
}

/** « Running Ask User (bobine) » : le titre que Bob 2.0.6 donne à un appel d'outil MCP. */
const bobToolTitle = (tool: string, server: string) =>
  `Running ${tool
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')} (${server})`

/**
 * Appel d'un outil du serveur MCP HTTP du client, avec la même mise en scène que Bob : carte,
 * autorisation, `tools/call`, puis seulement le texte du résultat (Bob ne relaie pas les images).
 */
/** Un appel `tools/call` au serveur MCP du client : tout le texte du résultat. */
/** Outils que le serveur MCP HTTP du client déclare (`tools/list`, fiche 109). */
async function listMcpTools(ctx: TurnContext): Promise<string> {
  const server = ctx.mcpServers?.find(
    (s): s is Extract<McpServer, { type: 'http' }> => 'type' in s && s.type === 'http'
  )
  if (!server) return '(aucun serveur MCP HTTP)'
  const call = mcpRequest(ctx, server.url)
  await call(1, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'mock-agent', version: '0' }
  })
  const listed = (await call(2, 'tools/list', {})) as { result?: { tools?: { name?: string }[] } }
  return (listed.result?.tools ?? []).map((t) => t.name ?? '?').join(', ')
}

/** Une requête JSON-RPC au serveur MCP du client (transport Streamable HTTP, réponse JSON). */
function mcpRequest(ctx: TurnContext, url: string) {
  return async (id: number, method: string, params: unknown): Promise<unknown> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      signal: ctx.signal
    })
    return response.json()
  }
}

async function mcpCall(
  ctx: TurnContext,
  url: string,
  tool: string,
  args: Record<string, unknown>
): Promise<string> {
  const request = mcpRequest(ctx, url)
  const call = async (id: number, method: string, params: unknown) =>
    (await request(id, method, params)) as {
      result?: { content?: { type?: string; text?: string }[] }
      error?: unknown
    }
  await call(1, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'mock-agent', version: '0' }
  })
  const result = await call(2, 'tools/call', { name: tool, arguments: args })
  // Tout le texte du résultat, comme un vrai agent le reçoit (une note peut suivre, fiche 072).
  const texts = (result.result?.content ?? []).flatMap((c) =>
    c.type === 'text' && typeof c.text === 'string' ? [c.text] : []
  )
  return texts.length ? texts.join('\n\n') : JSON.stringify(result.error ?? '(pas de réponse)')
}

/**
 * Comme OpenCode 2.0.32 (relevé de la fiche 079) : carte `execute` sans entrée, puis son code en
 * `in_progress`, les appels MCP pendant qu'elle tourne, et la fin avec les textes des résultats.
 */
async function runCodeMode(
  ctx: TurnContext,
  calls: { tool: string; args: Record<string, unknown> }[]
): Promise<string> {
  const server = ctx.mcpServers?.find(
    (s): s is Extract<McpServer, { type: 'http' }> => 'type' in s && s.type === 'http'
  )
  if (!server) return 'Aucun serveur MCP HTTP fourni par le client.'
  const toolCallId = `execute-${Date.now()}`
  const base = { toolCallId, title: 'execute', kind: 'other' as const }
  await send(ctx, { sessionUpdate: 'tool_call', ...base, status: 'pending', rawInput: {} })
  const code = calls
    .map(
      (c, i) => `const r${i + 1} = await tools.${server.name}.${c.tool}(${JSON.stringify(c.args)});`
    )
    .join('\n')
  await send(ctx, {
    sessionUpdate: 'tool_call_update',
    ...base,
    status: 'in_progress',
    rawInput: { code }
  })
  const results: string[] = []
  for (const c of calls) results.push(await mcpCall(ctx, server.url, c.tool, c.args))
  const text = results.join('\n\n')
  await send(ctx, {
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status: 'completed',
    content: [{ type: 'content', content: { type: 'text', text } }]
  })
  return text
}

/** Appels MCP du processus : identifiants d'outil distincts même lancés dans la même milliseconde. */
let mcpCalls = 0

async function callMcpTool(
  ctx: TurnContext,
  tool: string,
  args: Record<string, unknown>
): Promise<string> {
  const server = ctx.mcpServers?.find(
    (s): s is Extract<McpServer, { type: 'http' }> => 'type' in s && s.type === 'http'
  )
  if (!server) return 'Aucun serveur MCP HTTP fourni par le client.'
  const toolCallId = `${tool === 'ask_user' ? 'ask' : 'mcp'}-${Date.now()}-${++mcpCalls}`
  const title = bobToolTitle(tool, server.name)
  const toolCall = {
    toolCallId,
    title,
    kind: 'other' as const,
    rawInput: args,
    status: 'pending' as const
  }
  await send(ctx, { sessionUpdate: 'tool_call', ...toolCall })
  const permission: RequestPermissionResponse = await ctx.client.request(
    methods.client.session.requestPermission,
    {
      sessionId: ctx.sessionId,
      toolCall,
      options: [
        { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
        { optionId: 'allow_always', name: 'Always allow', kind: 'allow_always' },
        { optionId: 'reject', name: 'Reject', kind: 'reject_once' }
      ]
    }
  )
  if (permission.outcome.outcome !== 'selected' || permission.outcome.optionId === 'reject') {
    return 'Outil refusé.'
  }
  await send(ctx, { sessionUpdate: 'tool_call_update', toolCallId, status: 'in_progress' })
  const text = await mcpCall(ctx, server.url, tool, args)
  await send(ctx, {
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status: 'completed',
    content: [{ type: 'content', content: { type: 'text', text } }]
  })
  return text
}
