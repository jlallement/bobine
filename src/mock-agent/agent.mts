/**
 * Agent ACP factice : handlers du protocole, état des sessions, simulations de Bob.
 */
import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { agent, methods, PROTOCOL_VERSION, RequestError } from '../shared/acp-sdk.mts'
import type {
  AgentConnection,
  AgentContext,
  ContentBlock,
  SessionConfigOption,
  McpServer,
  SessionUpdate,
  Stream,
  Usage
} from '../shared/acp-sdk.mts'
import {
  LICENSE_MESSAGE,
  LOGIN_MARKER,
  playSteps,
  TurnCancelled,
  writeBobTaskCost,
  deleteBobTask,
  type Scenario,
  type TurnContext
} from './scenario.mts'
import { scenarios as defaultCatalog } from './scenarios.mts'
import { SessionStore, type StoredSession } from './store.mts'
import { DEFAULT_MAX_STEPS, playWithinLimit, StepCounters } from './limite-etapes.mts'
import { describeSettings, say, sayAll, type MockLanguage } from './langue.mts'

export interface MockAgentOptions {
  /** Scénario joué par défaut à chaque prompt. */
  scenario: string
  /** Délai de base entre deux morceaux (ms). */
  delayMs: number
  /** `false` : n'expose que des modes, sans options de configuration (comme certains agents). */
  withConfigOptions?: boolean
  /**
   * `false` : l'agent ne sait pas reprendre ses sessions (pas de `loadSession` ni de
   * `sessionCapabilities`), comme un agent sans historique.
   */
  withHistory?: boolean
  /** `false` : sait reprendre (`session/resume`) mais pas rejouer (`loadSession`). */
  withReplay?: boolean
  /** Dossier où les sessions sont mémorisées (défaut : dossier temporaire du système). */
  storeDir?: string
  /** Essais : une ligne par `session/prompt` reçu (son texte), pour compter les envois (D10). */
  promptLog?: string
  /** L'agent propose un titre de conversation (`session_info_update`) après le premier message. */
  withTitles?: boolean
  /**
   * Titre = début du texte envoyé, blocs de l'app compris, sur une ligne, comme Bob (fiche 125) ;
   * sans préfixe « Factice : ».
   */
  promptTitles?: boolean
  /** `--trust` : tous les dossiers sont approuvés (comme `bob acp --trust`). */
  trustAll?: boolean
  /** `false` : ne rapporte aucune consommation (ni `usage_update`, ni `usage` en fin de tour). */
  withUsage?: boolean
  /** Devise du coût rapporté (défaut `USD` ; ex. `bobcoins`). */
  costCurrency?: string
  /** `--sans-cout` : contexte et jetons du tour, sans coût (comme Codex ; fiche 157). */
  withoutCost?: boolean
  /** Rejoue l'historique APRÈS la réponse à `session/load`, comme Bob 2.0.6. */
  lateReplay?: boolean
  /** Délai entre la réponse à `session/load` et le rejeu tardif (défaut 0 ; Bob : fiche 121). */
  lateReplayMs?: number
  /** N'accepte que du texte et des liens (ni images, ni fichiers embarqués). */
  textOnly?: boolean
  /**
   * Annonce toujours la méthode SSO, comme Bob (`authMethods: ["sso"]`), quel que soit le
   * scénario de départ (grille de conformité, fiche 200).
   */
  announceSso?: boolean
  /** Sait rejouer (`session/load`) mais pas reprendre sans rejeu (`session/resume`). */
  withoutResume?: boolean
  /** `initialize` ne répond jamais (agent bloqué au démarrage). */
  stallInitialize?: boolean
  /**
   * Panne au démarrage (`--panne`, fiche 195) : le processus s'arrête net à `initialize`
   * (`plantage-initialize`), `session/new` ne répond jamais (`bloque-session-new`), ou rouvrir une
   * session (`session/load` et `session/resume`) ne répond jamais (`bloque-session-load`).
   */
  failure?: MockFailure
  /** `initialize` répond après ce délai (ms) : démarrage lent (`--demarrage-lent`, fiche 139). */
  slowStartMs?: number
  /**
   * `--dossiers-en-plus` : annonce `sessionCapabilities.additionalDirectories`, comme OpenCode
   * (fiche 179). Sans, des dossiers reçus quand même sont refusés (`invalidParams`).
   */
  additionalDirectories?: boolean
  /** N'envoie aucun `plan` (`--sans-plan`, fiche 139), comme OpenCode 2 ou un agent minimal. */
  withoutPlan?: boolean
  /** Délai de fin des sous-agents en arrière-plan (`--arriere-plan-ms`, fiche 139). */
  backgroundMs?: number
  /** Base de Bob où écrire les sous-agents (`--bob-db`, fiche 053) ; jamais celle de l'utilisateur. */
  bobDb?: string
  /**
   * Consommation comme Bob 2.0.6 (`--cout-bob`, fiche 109) : rien par ACP, coût cumulé de la tâche
   * écrit dans `bobDb` juste après chaque réponse.
   */
  bobCost?: boolean
  /** Nom annoncé à `initialize` (`--nom`) ; « Agent factice » par défaut. */
  title?: string
  /**
   * Clé de `_meta` lue à `session/new` pour le mode de départ (`--mode-depart <clé>`, fiche 163),
   * comme `bob/mode` chez Bob 2.0.6+ : mode inconnu refusé (`invalidParams`).
   */
  startModeKey?: string
  /** Langue de ses textes (`--langue`, `MOCK_AGENT_LANG`, fiche 167) ; français par défaut. */
  language?: MockLanguage
  /** Limite d'étapes d'une session (`--max-etapes`, fiche 209) ; défaut `DEFAULT_MAX_STEPS`. */
  maxSteps?: number
  catalog?: Record<string, Scenario>
}

/** Présence de ce fichier dans un dossier = dossier approuvé (simule « lancer bob une fois »). */
/** Pannes au démarrage (`--panne`, fiche 195). */
export const MOCK_FAILURES = [
  'plantage-initialize',
  'bloque-session-new',
  'bloque-session-load'
] as const
export type MockFailure = (typeof MOCK_FAILURES)[number]

/** Le processus s'arrête net, après une ligne sur stderr (comme un agent qui plante). */
function crashNow(line: string): never {
  process.stderr.write(`${line}\n`)
  process.exit(4)
}

export const TRUST_MARKER = '.mock-agent-trusted'

export const DEFAULT_STORE_DIR = join(tmpdir(), 'bobine-mock-sessions')

export const SSO_AUTH_METHOD = 'mock-sso'
/** Connexion « dans un terminal », comme `opencode-login` : `authenticate` n'y fait rien. */
export const TERMINAL_AUTH_METHOD = 'mock-login'
/** Fichier qui marque la connexion faite dans le terminal (créé par l'étape du profil). */
export { LOGIN_MARKER }

/**
 * Connexion faite dans le terminal : marque dans le dossier de la session, ou dans celui où l'agent
 * a été lancé (essai du premier lancement, fiche 188 : session dans un dossier jetable, agent lancé
 * dans le dossier réservé de l'app, où tourne aussi la commande de connexion).
 */
export function loggedInAt(cwd: string): boolean {
  return existsSync(join(cwd, LOGIN_MARKER)) || existsSync(join(process.cwd(), LOGIN_MARKER))
}
/** Fichier qui marque la licence acceptée (scénario `bob-licence-requise`). */
export const LICENSE_MARKER = '.mock-agent-license'
export { LICENSE_MESSAGE }
/** Code renvoyé par Bob 2.0.6 pour un workspace non approuvé (vérifié : « Invalid request »). */
export const UNTRUSTED_WORKSPACE_CODE = -32600

/** Commandes « / » annoncées par l'agent factice. */
export const MOCK_COMMANDS = [
  {
    name: 'scenario',
    description: 'Joue un scénario de l’agent factice pour ce tour',
    input: { hint: 'nom du scénario (vide = liste)' }
  },
  { name: 'aide', description: 'Liste les scénarios disponibles' },
  { name: 'demo', description: 'Démonstration complète : réflexion, plan, outil, permission, diff' }
]

/** Consommation simulée d'un tour : déterministe, pour les tests. */
export const MOCK_CONTEXT_SIZE = 200_000
export const MOCK_TURN_COST = 0.0125
function mockTurnUsage(prompt: ContentBlock[]): Usage {
  const chars = prompt.reduce((n, b) => n + (b.type === 'text' ? b.text.length : 0), 0)
  const input = 1000 + chars
  return {
    inputTokens: input,
    outputTokens: 250,
    thoughtTokens: 120,
    cachedReadTokens: 800,
    cachedWriteTokens: 0,
    totalTokens: input + 250 + 120
  }
}

const MODES = [
  { id: 'code', name: 'Code', description: 'Modifie le code' },
  { id: 'ask', name: 'Question', description: 'Répond sans rien modifier' },
  { id: 'plan', name: 'Plan', description: 'Prépare un plan sans rien modifier' }
]

/** Mode de départ demandé dans `_meta` (comme `bob/mode`), sinon `code`. */
function startMode(key: string | undefined, meta: Record<string, unknown> | null | undefined) {
  const wanted = key ? meta?.[key] : undefined
  if (wanted === undefined) return 'code'
  if (!MODES.some((m) => m.id === wanted)) throw RequestError.invalidParams({ modeId: wanted })
  return wanted as string
}

interface SessionState extends StoredSession {
  turn: AbortController | null
  /** Serveurs MCP fournis par le client (non mémorisés : redonnés à chaque ouverture). */
  mcpServers?: McpServer[]
  /** Autres dossiers reçus à l'ouverture (fiche 179), redonnés eux aussi à chaque ouverture. */
  additionalDirectories?: string[]
}

/**
 * Longue liste de modèles façon OpenCode (fiche 092), avec `MOCK_MODELS=long` : une quarantaine de
 * noms « fournisseur/Modèle », en liste plate, pour le menu des modèles (recherche, défilement) et
 * la barre de saisie avec un nom long. Les deux modèles factices restent en tête.
 */
const LONG_MODELS =
  process.env['MOCK_MODELS'] === 'long'
    ? [
        ...['5.5', '5.6 Luna', '5.6 Sol', '5.6 Terra', '6 Astra', '6 Luna', '6 Sol', '6.1 Sol']
          .flatMap((v) => [`GPT-${v}`, `GPT-${v} Fast`])
          .map((name) => `openai/${name}`),
        ...['Haiku 5.5', 'Sonnet 5.5', 'Opus 5.5', 'Fable 5.1'].map((n) => `anthropic/Claude ${n}`),
        ...['Gemini 3.5 Flash', 'Gemini 3.5 Pro', 'Gemma 4 27B'].map((n) => `google/${n}`),
        ...['Beam Free', 'Big Pickle', 'DeepSeek V4.1 Flash Free', 'GLM-5.3 Flash Free'].map(
          (n) => `opencode/${n}`
        ),
        ...['MiniMax M3.1 Flash Free', 'Qwen 4 Coder Free', 'Kimi K3 Free'].map(
          (n) => `opencode/${n}`
        ),
        ...['Devstral 3', 'Codestral 3'].map((n) => `mistral/${n}`),
        'openrouter/meta-llama/Llama 5 70B',
        'ollama/ministral-3:8b',
        'ollama/ministral-3:14b-instruct-2512-q8_0',
        'ollama/qwen4-coder:32b'
      ].map((name) => ({ value: name.toLowerCase().replace(/\s+/g, '-'), name }))
    : []

/**
 * Modèles de fournisseurs déclarés (fiche 108), avec `MOCK_MODELS=<valeur=nom,…>` (ex.
 * `llmaas/qwen3-32b=LLMaaS/Qwen3 32B`) : un groupe de plus, après les deux modèles factices.
 */
const PROVIDER_MODELS = (process.env['MOCK_MODELS'] ?? '').includes('=')
  ? (process.env['MOCK_MODELS'] ?? '').split(',').flatMap((entry) => {
      const [value, name] = entry.split('=').map((part) => part.trim())
      return value && name ? [{ value, name }] : []
    })
  : []

const MODELS = {
  rapide: 'factice-rapide',
  precis: 'factice-precis',
  ...Object.fromEntries([...LONG_MODELS, ...PROVIDER_MODELS].map((m) => [m.value, m.value]))
} as const

/** Options de configuration ACP exposées par l'agent factice (sauf avec --sans-options). */
function configOptions(session: SessionState): SessionConfigOption[] {
  return [
    {
      id: 'model',
      name: 'Modèle',
      category: 'model',
      type: 'select',
      currentValue: session.model,
      options:
        LONG_MODELS.length > 0
          ? [
              { value: MODELS.rapide, name: 'factice/Factice rapide' },
              { value: MODELS.precis, name: 'factice/Factice précis' },
              ...LONG_MODELS
            ]
          : [
              {
                group: 'rapides',
                name: 'Rapides',
                options: [{ value: MODELS.rapide, name: 'Factice rapide' }]
              },
              {
                group: 'precis',
                name: 'Précis',
                options: [{ value: MODELS.precis, name: 'Factice précis' }]
              },
              ...(PROVIDER_MODELS.length > 0
                ? [{ group: 'fournisseurs', name: 'Fournisseurs', options: PROVIDER_MODELS }]
                : [])
            ]
    },
    { id: 'verbose', name: 'Réponses détaillées', type: 'boolean', currentValue: session.verbose }
  ]
}

export function connectMockAgent(stream: Stream, options: MockAgentOptions): AgentConnection {
  const catalog = options.catalog ?? defaultCatalog
  const scenario = catalog[options.scenario]
  if (!scenario) throw new Error(`Scénario inconnu : ${options.scenario}`)

  const sessions = new Map<string, SessionState>()
  const language = options.language ?? 'fr'
  let authenticated = false
  const withHistory = options.withHistory !== false
  const store = new SessionStore(options.storeDir ?? DEFAULT_STORE_DIR)
  const stepCounters = new StepCounters()

  const persist = (session: SessionState) => {
    if (!withHistory) return
    const { turn: _turn, ...stored } = session
    store.save({ ...stored, updatedAt: new Date().toISOString() })
  }
  /**
   * Annonce les commandes « / » juste après la réponse d'ouverture de session (comme Claude Code,
   * Codex, OpenCode et Bob) : le client ne connaît l'identifiant de session qu'à ce moment-là.
   */
  const announceCommands = (client: AgentContext, sessionId: string) => {
    setTimeout(() => {
      void client
        .notify(methods.client.session.update, {
          sessionId,
          update: {
            sessionUpdate: 'available_commands_update',
            availableCommands: sayAll(MOCK_COMMANDS, language)
          }
        })
        .catch(() => {})
    }, 0)
  }
  const controls = (session: SessionState) => ({
    modes: { currentModeId: session.modeId, availableModes: sayAll(MODES, language) },
    configOptions:
      options.withConfigOptions === false ? undefined : sayAll(configOptions(session), language)
  })
  /**
   * Autres dossiers reçus à l'ouverture (fiche 179) : sans la capacité annoncée, un client qui en
   * envoie quand même est refusé — les essais vérifient ainsi que l'app n'en envoie jamais.
   */
  const receivedDirectories = (dirs: string[] | null | undefined) => {
    if (!dirs?.length) return {}
    if (!options.additionalDirectories) {
      throw RequestError.invalidParams(
        undefined,
        'additionalDirectories sent without sessionCapabilities.additionalDirectories'
      )
    }
    return { additionalDirectories: dirs }
  }
  const setDirectories = (session: SessionState, dirs: { additionalDirectories?: string[] }) => {
    if (dirs.additionalDirectories) session.additionalDirectories = dirs.additionalDirectories
    else delete session.additionalDirectories
  }
  /** Session mémorisée → session active (rechargement ou reprise). */
  const restore = (sessionId: string, cwd: string): SessionState => {
    if (!withHistory) throw RequestError.methodNotFound(methods.agent.session.load)
    const stored = store.load(sessionId)
    if (!stored) throw RequestError.resourceNotFound(sessionId)
    const session: SessionState = { ...stored, cwd, turn: null }
    sessions.set(sessionId, session)
    return session
  }
  const replay = async (client: AgentContext, session: SessionState) => {
    for (const update of session.history) {
      await client.notify(methods.client.session.update, { sessionId: session.sessionId, update })
    }
  }

  const stallIf = async (when: MockFailure) => {
    if (options.failure === when) await new Promise<never>(() => {})
  }
  return agent({ name: 'mock-agent' })
    .onRequest(methods.agent.initialize, async () => ({
      ...(options.failure === 'plantage-initialize' ? crashNow('panic: initialize') : {}),
      ...(options.stallInitialize ? await new Promise<never>(() => {}) : {}),
      ...(options.slowStartMs
        ? await new Promise<object>((resolve) => setTimeout(() => resolve({}), options.slowStartMs))
        : {}),
      // `null` dans le scénario : champ absent de la réponse (fiche 198). Le type du SDK l'exige ;
      // `undefined` disparaît à l'envoi (JSON), comme chez un agent qui ne le dit pas.
      protocolVersion: (scenario.announce?.protocolVersion === null
        ? undefined
        : (scenario.announce?.protocolVersion ?? PROTOCOL_VERSION)) as number,
      agentInfo: {
        name: 'mock-agent',
        title: options.title ?? say('Agent factice', language),
        version: scenario.announce?.version ?? '0.1.0'
      },
      agentCapabilities: {
        loadSession: withHistory && options.withReplay !== false,
        sessionCapabilities: withHistory
          ? {
              list: {},
              ...(options.withoutResume ? {} : { resume: {} }),
              close: {},
              delete: {},
              ...(options.additionalDirectories ? { additionalDirectories: {} } : {})
            }
          : options.additionalDirectories
            ? { additionalDirectories: {} }
            : {},
        mcpCapabilities: { http: true },
        promptCapabilities:
          options.textOnly === true
            ? { image: false, audio: false, embeddedContext: false }
            : { image: true, audio: false, embeddedContext: true }
      },
      authMethods: sayAll(
        scenario.session?.terminalLogin || scenario.session?.expiredLogin === 'terminal'
          ? [
              {
                id: TERMINAL_AUTH_METHOD,
                name: 'Login with mock',
                description: 'Run `touch .mock-agent-logged-in` in the terminal'
              }
            ]
          : scenario.session?.requireAuth ||
              scenario.session?.expiredLogin === 'sso' ||
              options.announceSso === true
            ? [
                {
                  id: SSO_AUTH_METHOD,
                  // Le nom exact de Bob 2.0.9, en anglais quelle que soit la langue (fiche 205).
                  name: 'Log in with SSO',
                  description: 'Simule la connexion SSO de Bob'
                }
              ]
            : [],
        language
      )
    }))
    .onRequest(methods.agent.authenticate, async ({ params }) => {
      // Comme OpenCode 1.19 : la méthode « terminal » est acceptée sans rien faire.
      if (params.methodId === TERMINAL_AUTH_METHOD) return {}
      if (params.methodId !== SSO_AUTH_METHOD) {
        throw RequestError.invalidParams({ methodId: params.methodId })
      }
      // SSO fini dans le navigateur, mais la réponse ne revient jamais (fiche 207).
      if (scenario.session?.ssoNeverAnswers) {
        writeFileSync(join(process.cwd(), LOGIN_MARKER), '')
        return new Promise<never>(() => {})
      }
      // Simule le temps passé dans le navigateur (SSO).
      await new Promise((resolve) => setTimeout(resolve, options.delayMs * 10))
      authenticated = true
      return {}
    })
    .onRequest(methods.agent.session.new, async ({ params, client }) => {
      await stallIf('bloque-session-new')
      // Comme Bob 2.0.6 : la confiance du dossier est vérifiée AVANT l'authentification.
      const trusted = options.trustAll || existsSync(join(params.cwd, TRUST_MARKER))
      if (scenario.session?.untrustedWorkspace && !trusted) {
        throw new RequestError(
          UNTRUSTED_WORKSPACE_CODE,
          // Message calqué sur celui de Bob 2.0.6.
          // Pas de `data` : Bob n'en envoie pas, l'app doit se fier au message.
          `Invalid request: Workspace "${params.cwd}" is not trusted. Pass --trust to trust each workspace opened by this ACP server, or run Bob Shell interactively in this folder and choose a trust level, then reopen the ACP session.`
        )
      }
      // Comme Bob : une clé d'API dispense de la connexion SSO.
      const withKey = !!process.env['MOCK_AGENT_API_KEY']
      const ssoDone = scenario.session?.ssoNeverAnswers && loggedInAt(params.cwd)
      if (scenario.session?.requireAuth && !authenticated && !withKey && !ssoDone) {
        throw RequestError.authRequired()
      }
      if (scenario.session?.terminalLogin && !withKey && !loggedInAt(params.cwd)) {
        throw RequestError.authRequired()
      }
      if (scenario.session?.requireLicense && !existsSync(join(params.cwd, LICENSE_MARKER))) {
        throw new RequestError(-32600, LICENSE_MESSAGE)
      }
      const directories = receivedDirectories(params.additionalDirectories)
      const session: SessionState = {
        sessionId: `mock-${randomUUID()}`,
        ...directories,
        cwd: params.cwd,
        updatedAt: new Date().toISOString(),
        modeId: startMode(options.startModeKey, params._meta),
        model: MODELS.rapide,
        verbose: false,
        history: [],
        turn: null,
        mcpServers: params.mcpServers
      }
      sessions.set(session.sessionId, session)
      announceCommands(client, session.sessionId)
      return { sessionId: session.sessionId, ...controls(session) }
    })
    .onRequest(methods.agent.session.load, async ({ params, client }) => {
      await stallIf('bloque-session-load')
      if (options.withReplay === false)
        throw RequestError.methodNotFound(methods.agent.session.load)
      // Réouverture refusée tant que la connexion n'est pas refaite (D10, N2).
      if (scenario.session?.reopenNeedsLogin && !authenticated && !loggedInAt(params.cwd)) {
        throw RequestError.authRequired()
      }
      const directories = receivedDirectories(params.additionalDirectories)
      const session = restore(params.sessionId, params.cwd)
      session.mcpServers = params.mcpServers
      setDirectories(session, directories)
      if (options.lateReplay)
        setTimeout(() => void replay(client, session).catch(() => {}), options.lateReplayMs ?? 0)
      else await replay(client, session)
      announceCommands(client, session.sessionId)
      return controls(session)
    })
    .onRequest(methods.agent.session.resume, async ({ params, client }) => {
      await stallIf('bloque-session-load')
      const directories = receivedDirectories(params.additionalDirectories)
      const session = restore(params.sessionId, params.cwd)
      session.mcpServers = params.mcpServers ?? []
      setDirectories(session, directories)
      announceCommands(client, session.sessionId)
      return controls(session)
    })
    .onRequest(methods.agent.session.list, ({ params }) => {
      if (!withHistory) throw RequestError.methodNotFound(methods.agent.session.list)
      return {
        sessions: store.list(params.cwd).map((s) => ({
          sessionId: s.sessionId,
          cwd: s.cwd,
          title: s.title ?? null,
          updatedAt: s.updatedAt
        }))
      }
    })
    .onRequest(methods.agent.session.close, ({ params }) => {
      sessions.get(params.sessionId)?.turn?.abort()
      sessions.delete(params.sessionId)
      return {}
    })
    .onRequest(methods.agent.session.delete, ({ params }) => {
      sessions.get(params.sessionId)?.turn?.abort()
      sessions.delete(params.sessionId)
      store.delete(params.sessionId)
      // Comme Bob : la tâche quitte sa base, coût compris.
      if (options.bobDb) deleteBobTask(options.bobDb, params.sessionId)
      return {}
    })
    .onRequest(methods.agent.session.setConfigOption, ({ params }) => {
      const session = getSession(sessions, params.sessionId)
      if (options.withConfigOptions === false)
        throw RequestError.methodNotFound(methods.agent.session.setConfigOption)
      const value: unknown = params.value
      if (params.configId === 'model' && Object.values(MODELS).includes(value as never)) {
        session.model = value as string
      } else if (params.configId === 'verbose' && typeof value === 'boolean') {
        session.verbose = value
      } else {
        throw RequestError.invalidParams({ configId: params.configId, value })
      }
      persist(session)
      return { configOptions: sayAll(configOptions(session), language) }
    })
    .onRequest(methods.agent.session.setMode, async ({ params, client }) => {
      const session = getSession(sessions, params.sessionId)
      if (!MODES.some((m) => m.id === params.modeId)) {
        throw RequestError.invalidParams({ modeId: params.modeId })
      }
      session.modeId = params.modeId
      persist(session)
      await client.notify(methods.client.session.update, {
        sessionId: params.sessionId,
        update: { sessionUpdate: 'current_mode_update', currentModeId: params.modeId }
      })
      return {}
    })
    .onRequest(methods.agent.session.prompt, async ({ params, client }) => {
      const session = getSession(sessions, params.sessionId)
      if (options.promptLog) {
        const text = params.prompt.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join(' ')
        appendFileSync(options.promptLog, `${text.split('\n')[0]}\n`)
      }
      session.turn?.abort()
      const turn = new AbortController()
      session.turn = turn

      // Le message de l'utilisateur fait partie de l'échange rejoué par `session/load`.
      for (const block of params.prompt) {
        session.history.push({ sessionUpdate: 'user_message_chunk', content: block })
      }
      if (options.promptTitles && !session.title) {
        const sent = params.prompt.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join(' ')
        session.title = sent.replace(/\s+/g, ' ').trim().slice(0, 120)
        const update: SessionUpdate = { sessionUpdate: 'session_info_update', title: session.title }
        session.history.push(update)
        await client.notify(methods.client.session.update, { sessionId: session.sessionId, update })
      }
      if (options.withTitles && !session.title) {
        const first = params.prompt.find((b) => b.type === 'text')
        const start = first?.type === 'text' ? first.text.slice(0, 40) : undefined
        session.title =
          language === 'en' ? `Mock: ${start ?? 'no text'}` : `Factice : ${start ?? 'sans texte'}`
        const update: SessionUpdate = { sessionUpdate: 'session_info_update', title: session.title }
        session.history.push(update)
        await client.notify(methods.client.session.update, { sessionId: session.sessionId, update })
      }

      // Enregistrée dès le message reçu (comme un vrai agent) : un plantage pendant le tour ne
      // perd pas la session.
      persist(session)

      const chosen = pickScenario(params.prompt, scenario, catalog)
      // Un scénario peut fixer lui-même le contexte (ex. après une compaction) et le coût cumulé
      // (coût qui monte en cours de tour, fiche 157).
      let reportedContext: number | undefined
      const stepLimit = chosen.session?.stepLimit
      try {
        const ctx: TurnContext = {
          sessionId: params.sessionId,
          prompt: params.prompt,
          mcpServers: session.mcpServers ?? [],
          cwd: session.cwd,
          additionalDirectories: session.additionalDirectories ?? [],
          loggedIn: authenticated,
          model: session.model,
          signal: turn.signal,
          delayMs: options.delayMs,
          client,
          onUpdate: (sessionId, update) => {
            if (sessionId !== session.sessionId) return
            if (update.sessionUpdate === 'usage_update') {
              reportedContext = update.used
              if (update.cost) session.cost = update.cost.amount
            } else session.history.push(update)
          },
          saveChildSession: (sessionId, history) => {
            if (!withHistory) return
            store.save({
              sessionId,
              cwd: session.cwd,
              updatedAt: new Date().toISOString(),
              modeId: session.modeId,
              model: session.model,
              verbose: false,
              history,
              parentId: session.sessionId
            })
          },
          ...(options.bobDb ? { bobDb: options.bobDb } : {}),
          ...(options.withoutPlan ? { withoutPlan: true } : {}),
          ...(options.backgroundMs !== undefined ? { backgroundMs: options.backgroundMs } : {}),
          language,
          describeSession: () =>
            describeSettings(language, {
              mode: session.modeId,
              model: options.withConfigOptions === false ? '—' : session.model,
              verbose: session.verbose
            })
        }
        // Limite d'étapes de la session (fiche 209) : refus sans rien envoyer, comme Bob 2.0.9.
        let stopReason = chosen.stopReason ?? 'end_turn'
        if (stepLimit) {
          const used = stepCounters.used(stepLimit, session)
          const max = options.maxSteps ?? DEFAULT_MAX_STEPS
          const played = await playWithinLimit(stepLimit, chosen.steps, ctx, used, max)
          stepCounters.set(stepLimit, session, played.used)
          if (played.turn === 'refused') return { stopReason: 'max_turn_requests' }
          if (played.turn === 'stopped') stopReason = 'max_turn_requests'
        } else await playSteps(chosen.steps, ctx)
        if (options.bobCost && options.bobDb) {
          session.cost = Math.round(((session.cost ?? 0) + MOCK_TURN_COST) * 1e6) / 1e6
          const [file, cost, id] = [options.bobDb, session.cost, session.sessionId]
          // Bob écrit son coût après sa réponse : l'app le relit ensuite (fin de tour + 1,5 s).
          setTimeout(() => writeBobTaskCost(file, id, cost), 300)
        }
        if (options.withUsage === false || options.bobCost) return { stopReason }
        const usage = mockTurnUsage(params.prompt)
        session.contextUsed =
          (reportedContext ?? session.contextUsed ?? 0) + usage.inputTokens + usage.outputTokens
        session.cost = Math.round(((session.cost ?? 0) + MOCK_TURN_COST) * 1e6) / 1e6
        await client.notify(methods.client.session.update, {
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'usage_update',
            used: session.contextUsed,
            size: MOCK_CONTEXT_SIZE,
            ...(options.withoutCost
              ? {}
              : { cost: { amount: session.cost, currency: options.costCurrency ?? 'USD' } })
          }
        })
        return { stopReason, usage }
      } catch (error) {
        if (error instanceof TurnCancelled || turn.signal.aborted)
          return { stopReason: 'cancelled' }
        throw error
      } finally {
        if (session.turn === turn) session.turn = null
        persist(session)
      }
    })
    .onNotification(methods.agent.session.cancel, ({ params }) => {
      sessions.get(params.sessionId)?.turn?.abort()
    })
    .connect(stream)
}

function getSession(sessions: Map<string, SessionState>, sessionId: string): SessionState {
  const session = sessions.get(sessionId)
  if (!session) throw RequestError.invalidParams({ sessionId }, `Session inconnue : ${sessionId}`)
  return session
}

/** Début de la consigne de relecture de l'app (`REVIEW_BRIEF_LEAD` de `shared/review.ts`). */
export const REVIEW_BRIEF_LEAD = 'Code review request from Bobine.'

/**
 * `/scenario <nom>` en début de prompt joue ce scénario pour ce tour ;
 * `/scenario` seul (ou un nom inconnu) liste les scénarios disponibles.
 */
function pickScenario(
  prompt: ContentBlock[],
  fallback: Scenario,
  catalog: Record<string, Scenario>
): Scenario {
  // Le message de l'utilisateur est le premier bloc de texte : tout ce que l'app joint (contexte
  // d'une branche, d'une bascule, de session…) part après lui (fiche 125).
  const first = prompt.find((b) => b.type === 'text')
  const text = first?.type === 'text' ? first.text.trim() : ''
  // `/demo` et `/aide` : raccourcis de `/scenario demo` et `/scenario`.
  if (/^\/demo\b/.test(text) && catalog['demo']) return catalog['demo']
  // `/compact` : la conversation est résumée (comme `/compress` de Bob, `/compact` d'OpenCode).
  if (/^\/compact\b/.test(text) && catalog['compaction']) return catalog['compaction']
  // `/compress` : comme Bob 2.0.6, le résumé arrive en texte, sans `compaction_update` (fiche 126).
  if (/^\/compress\b/.test(text) && catalog['compaction-texte']) return catalog['compaction-texte']
  // Consigne de relecture de l'app (fiche 177, `REVIEW_BRIEF_LEAD`) : `/scenario` peut venir des
  // points à surveiller, n'importe où ; sinon le relecteur ordinaire.
  if (text.startsWith(REVIEW_BRIEF_LEAD)) {
    const named = /\/scenario\s+(\S+)/.exec(text)?.[1]
    const chosen = catalog[named ?? 'relecture']
    if (chosen && !chosen.session) return chosen
  }
  // Premier message d'une fille avec un rôle (fiche 223) : la consigne du rôle vient en tête,
  // `/scenario` sur une ligne de la tâche, après.
  if (text.startsWith('<bobine_role')) {
    const named = /^\/scenario\s+(\S+)/m.exec(text)?.[1]
    const chosen = named ? catalog[named] : undefined
    if (chosen && !chosen.session) return chosen
  }
  // Consigne d'une mère (`start_child`, `message_child`) : l'app y refuse une commande en tête
  // (fiche 160), `/scenario` vient alors en deuxième ligne, après une ligne de texte.
  const second = text.split('\n')[1]?.trim() ?? ''
  const asked = !text.startsWith('/') && /^\/scenario\b/.test(second) ? second : text
  const match = /^\/aide\b/.test(text) ? ['/aide'] : /^\/scenario(?:\s+(\S+))?/.exec(asked)
  // Aparté de Bobine (fiche 180) : sans `/scenario` en tête, il décrit ce qu'il a reçu.
  const aside = prompt.some((b) => b.type === 'text' && b.text.includes('<bobine_aside>'))
  if (!match && aside && catalog['aparte']) return catalog['aparte']
  if (!match) return fallback
  const requested = match[1] ? catalog[match[1]] : undefined
  if (requested && !requested.session) return requested
  const list = Object.entries(catalog)
    .map(
      ([name, s]) =>
        `- \`${name}\` — ${s.description}${s.session ? ' *(au lancement uniquement)*' : ''}`
    )
    .join('\n')
  const intro = match[1] ? `Scénario \`${match[1]}\` indisponible ici.` : 'Scénarios disponibles :'
  return { description: 'liste', steps: [{ kind: 'text', text: `${intro}\n\n${list}\n` }] }
}
