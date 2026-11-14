/**
 * Sonde de suivi d'OpenCode (fiche 078) : rejoue contre l'OpenCode installé les relevés de
 * docs/acp.md et docs/agents.md, compare ses réponses à celles attendues, vérifie le contrat de
 * l'app et signale ce qui mérite d'être regardé — le jour où OpenCode enverra un `plan` ACP, par
 * exemple. À lancer après chaque mise à jour d'OpenCode. En CI, seulement `--offline`, une fois par
 * semaine (`.github/workflows/opencode-probe.yml`, fiche 198) ; jamais avec un modèle.
 *
 *   pnpm opencode-probe [--opencode <commande>] [--model <id>] [--offline] [--accept] [--traces] [--only <nom>…]
 *
 * OpenCode tourne avec un `HOME` et des `XDG_*` jetables : ni sa configuration, ni ses connexions,
 * ni l'historique de l'utilisateur ne sont lus ou modifiés. Les sondages sans modèle (initialize,
 * sessions, réglages) sont gratuits ; les autres utilisent un modèle gratuit de Zen (`--model`,
 * défaut `opencode/big-pickle`) — `--offline` s'en passe. Une demande d'autorisation est notée puis
 * refusée, sauf, une fois, dans le bac à sable jetable : création de fichier (fiche 202), commande
 * dans un sous-dossier (fiche 203).
 *
 * `--accept` enregistre les réponses obtenues comme nouvelles attentes (après les avoir lues, et
 * après avoir mis à jour docs/acp.md et docs/agents.md si le comportement d'OpenCode a changé).
 * Avec `--offline`, seules les réponses des sondages gratuits sont remplacées ; celles du dernier
 * passage avec modèle (et sa version) sont gardées (fiche 172).
 *
 * `--traces` enregistre aussi les échanges ACP de chaque sondage, nettoyés (secrets masqués,
 * chemins remplacés), dans `src/main/agent/__traces__/opencode-<version>/` (fiche 139).
 */
import { execFileSync, spawn } from 'node:child_process'
import { createServer } from 'node:http'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Readable, Writable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { client, methods, ndJsonStream, PROTOCOL_VERSION } from '../src/shared/acp-sdk.mts'
import type {
  ClientContext,
  McpServer,
  ElicitationSchema,
  RequestPermissionRequest,
  SessionUpdate
} from '../src/shared/acp-sdk.mts'
import {
  acceptedExpectations,
  contractChecks,
  diffObservations,
  KNOWN_UPDATES,
  stablePaths,
  watchNotes,
  type Expected,
  type Observation,
  type Observations
} from '../src/main/agent/opencode-probe.ts'
import { childSessionOf, EMPTY_SESSION_TITLE } from '../src/main/agent/opencode-contract.ts'
import { filesOf, OPENCODE_DIFF_SOURCE, withPatchDiffs } from '../src/main/agent/opencode-diffs.ts'
import { ToolCallMemory } from '../src/main/agent/tool-call-memory.ts'
import { ProbeTraces } from '../src/main/agent/acp-trace.ts'
import { activeRules } from '../src/main/agent-config/rules.ts'
import { OPENCODE_RULES } from '../src/main/agent-config/opencode-rules.ts'
import { questionsOf } from '../src/shared/questions.ts'
import { OPENCODE_AGENTS, openCodeAgentFile } from '../src/main/roles/export/opencode-agents.ts'
import {
  openCodeSubagentOf as subagentOf,
  openCodeSubagentSessionId as subagentSessionId
} from '../src/main/agent/opencode-subagents.ts'
import {
  hasOpenssl,
  selfSigned,
  startConnectProxy,
  startOpenAiCompatible
} from '../e2e/fixtures/openai-compatible.mts'

const EXPECTED_FILE = join(dirname(fileURLToPath(import.meta.url)), 'opencode-probe.expected.json')
const REQUEST_MS = 60_000
const PROMPT_MS = 240_000

const { values } = parseArgs({
  options: {
    opencode: { type: 'string', default: 'opencode' },
    model: { type: 'string', default: 'opencode/big-pickle' },
    offline: { type: 'boolean' },
    accept: { type: 'boolean' },
    traces: { type: 'boolean' },
    only: { type: 'string', multiple: true }
  }
})
if (values.only && values.accept) {
  console.error(
    '--only et --accept ne vont pas ensemble : les attentes viennent d’un passage complet.'
  )
  process.exit(2)
}
/** Sondage avec modèle à faire : tous, ou ceux dont le nom contient un des `--only`. */
const wanted = (name: string) => !values.only || values.only.some((o) => name.includes(o))
const TRACES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../src/main/agent/__traces__')
const traces = new ProbeTraces('opencode', values.traces === true)
const opencode = values.opencode ?? 'opencode'
const model = values.model ?? 'opencode/big-pickle'

/** Bac à sable : `HOME` et `XDG_*` jetables, dossier de travail (dépôt git) dedans. */
interface Sandbox {
  home: string
  workspace: string
  env: Record<string, string>
}

function sandbox(): Sandbox {
  // Chemins réels : sur macOS, le dossier temporaire passe par un lien (`/var` → `/private/var`).
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'opencode-sonde-')))
  const env = {
    HOME: home,
    XDG_CONFIG_HOME: join(home, '.config'),
    XDG_DATA_HOME: join(home, '.local', 'share'),
    XDG_STATE_HOME: join(home, '.local', 'state'),
    XDG_CACHE_HOME: join(home, '.cache'),
    OPENCODE_DISABLE_AUTOUPDATE: '1'
  }
  for (const dir of Object.values(env).slice(1, 5)) mkdirSync(dir, { recursive: true })
  const workspace = join(home, 'projet')
  mkdirSync(workspace)
  execFileSync('git', ['init', '-q'], { cwd: workspace })
  writeFileSync(join(workspace, 'README.md'), '# Projet d’essai\n')
  return { home, workspace, env }
}

/** Ce que l'agent a envoyé pendant une connexion. */
interface Seen {
  updates: SessionUpdate[]
  permissions: RequestPermissionRequest[]
  elicitations: { message: string; schema?: ElicitationSchema; toolCallId?: string }[]
}

/** Lance `opencode acp` dans le bac à sable, s'y connecte, exécute `op`, puis l'arrête. */
async function withOpenCode<T>(
  box: Sandbox,
  op: (ctx: ClientContext, seen: Seen) => Promise<T>,
  grant = false
): Promise<T> {
  const child = spawn(opencode, ['acp'], {
    cwd: box.workspace,
    env: { ...process.env, ...box.env },
    stdio: ['pipe', 'pipe', 'pipe']
  })
  let stderr = ''
  child.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
  const exited = new Promise<number | null>((resolve) => child.on('exit', resolve))
  const seen: Seen = { updates: [], permissions: [], elicitations: [] }
  const stream = traces.connection(
    ndJsonStream(
      Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
      Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>
    ),
    { dossier: box.workspace, home: box.home }
  )
  try {
    const app = client({ name: 'bobine-sonde' })
      .onNotification(methods.client.session.update, ({ params }) => {
        seen.updates.push(params.update)
      })
      // Rien n'est accordé (la demande est notée, puis refusée), sauf `grant` : une seule fois,
      // dans le bac à sable jetable (création de fichier, fiche 202).
      .onRequest(methods.client.session.requestPermission, ({ params }) => {
        seen.permissions.push(params)
        const reject = params.options.find((o) => o.kind === (grant ? 'allow_once' : 'reject_once'))
        return reject
          ? { outcome: { outcome: 'selected', optionId: reject.optionId } }
          : { outcome: { outcome: 'cancelled' } }
      })
      // Questions : la première option de chaque choix.
      .onRequest(methods.client.elicitation.create, ({ params }) => {
        const schema =
          'requestedSchema' in params ? (params.requestedSchema as ElicitationSchema) : undefined
        seen.elicitations.push({
          message: params.message,
          ...(schema ? { schema } : {}),
          ...('toolCallId' in params && typeof params.toolCallId === 'string'
            ? { toolCallId: params.toolCallId }
            : {})
        })
        if (!schema) return { action: 'decline' }
        const content: Record<string, string> = {}
        for (const [key, property] of Object.entries(schema.properties ?? {})) {
          const first = (property as { oneOf?: { const?: unknown }[] }).oneOf?.[0]?.const
          if (typeof first === 'string') content[key] = first
        }
        return { action: 'accept', content }
      })
    return await app.connectWith(stream, (ctx) => op(ctx, seen))
  } catch (error) {
    const line = stderr.trim().split('\n')[0]?.slice(0, 200) ?? ''
    throw new Error(
      stablePaths(line || (error as Error).message, {
        dossier: box.workspace,
        home: box.home
      })
    )
  } finally {
    child.kill()
    await exited
  }
}

const within = <T,>(ms: number, label: string, promise: Promise<T>): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`délai dépassé : ${label}`)), ms).unref()
    )
  ])

function initialize(ctx: ClientContext) {
  // Les capacités de Bobine (`agent-host.ts`) : OpenCode répond selon ce que le client annonce.
  return within(
    REQUEST_MS,
    'initialize',
    ctx.request(methods.agent.initialize, {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {
        elicitation: { form: {}, url: {} },
        session: { compaction: {} },
        _meta: { terminal_output: true, terminal_output_delta: true }
      },
      clientInfo: { name: 'bobine-sonde', version: '0.0.0' }
    })
  )
}

async function newSession(
  ctx: ClientContext,
  box: Sandbox,
  useModel = false,
  mcpServers: McpServer[] = []
) {
  const session = await within(
    REQUEST_MS,
    'session/new',
    ctx.request(methods.agent.session.new, { cwd: box.workspace, mcpServers })
  )
  if (!useModel) return session
  // Modèle de la sonde : les réglages (« Effort »…) dépendent du modèle choisi.
  const selected = await within(
    REQUEST_MS,
    'modèle',
    ctx.request(methods.agent.session.setConfigOption, {
      sessionId: session.sessionId,
      configId: 'model',
      value: model
    })
  )
  return { ...session, configOptions: selected.configOptions }
}

const prompt = (ctx: ClientContext, sessionId: string, text: string) =>
  within(
    PROMPT_MS,
    'session/prompt',
    ctx.request(methods.agent.session.prompt, {
      sessionId,
      prompt: [{ type: 'text', text }]
    })
  )

const sorted = (values: Iterable<string>) => [...new Set(values)].sort()
const kindsOf = (updates: SessionUpdate[]) => sorted(updates.map((u) => u.sessionUpdate))
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Tous les types de mise à jour vus pendant les sondages qui appellent le modèle. */
const streamKinds = new Set<string>()
let streamPlan = false
function note(seen: Seen): void {
  for (const u of seen.updates) {
    streamKinds.add(u.sessionUpdate)
    if (u.sessionUpdate === 'plan') streamPlan = true
  }
}

// ===== Sans modèle =====

async function probeInitialize(): Promise<{ observation: Observation; version: string }> {
  const box = sandbox()
  try {
    return await withOpenCode(box, async (ctx) => {
      const init = await initialize(ctx)
      const caps = init.agentCapabilities
      return {
        version: init.agentInfo?.version ?? 'inconnue',
        observation: {
          agent: init.agentInfo?.name ?? null,
          protocolVersion: init.protocolVersion,
          loadSession: caps?.loadSession === true,
          sessionCapabilities: Object.keys(caps?.sessionCapabilities ?? {}).sort(),
          prompt: {
            image: caps?.promptCapabilities?.image === true,
            audio: caps?.promptCapabilities?.audio === true,
            embeddedContext: caps?.promptCapabilities?.embeddedContext === true
          },
          mcp: {
            http: caps?.mcpCapabilities?.http === true,
            sse: caps?.mcpCapabilities?.sse === true
          },
          authMethods: (init.authMethods ?? []).map((m) => m.id).sort(),
          extensions: Object.keys(caps?._meta ?? {}).sort()
        }
      }
    })
  } finally {
    rmSync(box.home, { recursive: true, force: true })
  }
}

async function probeSessions(): Promise<Observations> {
  const box = sandbox()
  try {
    const opened = await withOpenCode(box, async (ctx, seen) => {
      await initialize(ctx)
      const session = await newSession(ctx, box, true)
      await sleep(1500)
      const options = session.configOptions ?? []
      const mode = options.find((o) => o.id === 'mode')
      const commands = seen.updates.flatMap((u) =>
        u.sessionUpdate === 'available_commands_update'
          ? u.availableCommands.map((c) => c.name)
          : []
      )
      const all = await ctx.request(methods.agent.session.list, {})
      const here = await ctx.request(methods.agent.session.list, { cwd: box.workspace })
      const entry = here.sessions.find((s) => s.sessionId === session.sessionId)
      return {
        sessionId: session.sessionId,
        observations: {
          'session/new': {
            legacyModes: session.modes != null,
            options: options.map((o) => `${o.id}:${o.category ?? ''}`).sort(),
            modes: sorted(
              mode && 'options' in mode
                ? (mode.options as { value?: unknown }[]).flatMap((o) =>
                    typeof o.value === 'string' ? [o.value] : []
                  )
                : []
            ),
            commands: sorted(commands)
          },
          'session/list': {
            fields: entry ? Object.keys(entry).sort() : [],
            emptyTitle: EMPTY_SESSION_TITLE.test(entry?.title ?? ''),
            nextCursor: here.nextCursor != null,
            // Sans dossier : les sessions d'un dépôt git aussi (1.19 : non).
            withoutFolderListsRepo: all.sessions.some((s) => s.sessionId === session.sessionId)
          }
        } as Observations
      }
    })
    // Autre processus : la session se recharge, se reprend, se supprime.
    const reopened = await withOpenCode(box, async (ctx) => {
      await initialize(ctx)
      const request = { sessionId: opened.sessionId, cwd: box.workspace, mcpServers: [] }
      const outcome = (p: Promise<unknown>) =>
        p.then(
          () => 'ok',
          (e: { code?: unknown }) => `erreur ${String(e.code ?? '?')}`
        )
      const load = await outcome(ctx.request(methods.agent.session.load, request))
      const resume = await outcome(ctx.request(methods.agent.session.resume, request))
      const deleted = await outcome(
        ctx.request(methods.agent.session.delete, { sessionId: opened.sessionId })
      )
      const after = await ctx.request(methods.agent.session.list, {}).catch(() => undefined)
      return {
        load,
        resume,
        delete: deleted,
        gone: after ? !after.sessions.some((s) => s.sessionId === opened.sessionId) : false
      }
    })
    return { ...opened.observations, 'session/load, resume, delete': reopened }
  } finally {
    rmSync(box.home, { recursive: true, force: true })
  }
}

/**
 * Rôles installés comme agents (fiche 223, phase 4) : un agent écrit EXACTEMENT comme Bobine
 * (`openCodeAgentFile`), personnel (`$XDG_CONFIG_HOME/opencode/agents/`, lecture seule, avec
 * `permissions`) et du projet (`.opencode/agents/`, sans). Sans modèle : listés dans les modes par
 * ACP ? choisis par `session/set_config_option` ? Que les permissions tiennent ne se voit qu'avec
 * un modèle (non sondé).
 */
async function probeRoleAgents(): Promise<Observation> {
  const box = sandbox()
  const agent = (id: string, readOnly: boolean) => ({
    id,
    label: id,
    description: `Bobine probe agent (${readOnly ? 'read-only' : 'read-write'}).`,
    prompt: 'You are a probe agent written by Bobine. Never used for real work.',
    readOnly
  })
  try {
    const written = {
      perso: OPENCODE_AGENTS.place('user', 'bobine-sonde-perso', {
        home: box.home,
        xdgConfigHome: box.env['XDG_CONFIG_HOME']
      }).file,
      projet: OPENCODE_AGENTS.place(
        'project',
        'bobine-sonde-projet',
        { home: box.home },
        box.workspace
      ).file
    }
    for (const [scope, file] of Object.entries(written)) {
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, openCodeAgentFile(agent(`bobine-sonde-${scope}`, scope === 'perso')))
    }
    return await withOpenCode(box, async (ctx) => {
      await initialize(ctx)
      const session = await newSession(ctx, box)
      const mode = (session.configOptions ?? []).find((o) => o.category === 'mode')
      const values =
        mode && 'options' in mode
          ? (mode.options as { value?: unknown }[]).flatMap((o) =>
              typeof o.value === 'string' ? [o.value] : []
            )
          : []
      const legacy = (session.modes?.availableModes ?? []).map((m) => m.id)
      // Chaque agent choisi dans sa propre session : la réponse dit le mode en cours.
      const select = async (value: string): Promise<boolean | string> => {
        if (!mode) return false
        const own = await newSession(ctx, box)
        return ctx
          .request(methods.agent.session.setConfigOption, {
            sessionId: own.sessionId,
            configId: mode.id,
            value
          })
          .then(
            (r) => {
              const current = (r.configOptions ?? []).find((o) => o.id === mode.id)?.currentValue
              return current === value || `mode en cours : ${String(current)}`
            },
            (error: { message?: string }) => `refusé : ${error.message ?? '?'}`
          )
      }
      return {
        modeOption: mode ? `${mode.id}:${mode.category ?? ''}` : null,
        listed: {
          perso: values.includes('bobine-sonde-perso'),
          projet: values.includes('bobine-sonde-projet')
        },
        legacyModes: legacy.filter((id) => id.startsWith('bobine-sonde')).sort(),
        selected: {
          perso: await select('bobine-sonde-perso'),
          projet: await select('bobine-sonde-projet')
        },
        kept: {
          perso:
            readFileSync(written.perso, 'utf8') ===
            openCodeAgentFile(agent('bobine-sonde-perso', true)),
          projet:
            readFileSync(written.projet, 'utf8') ===
            openCodeAgentFile(agent('bobine-sonde-projet', false))
        }
      }
    })
  } finally {
    rmSync(box.home, { recursive: true, force: true })
  }
}

/**
 * Fournisseurs de modèles (fiche 104) : un bloc `provider` compatible OpenAI dans `opencode.json`
 * (clé par `{env:VAR}`, `enabled_providers`), un faux point d'accès local qui répond « OK ». Sans
 * modèle réel. Trois lancements : en HTTP ; en HTTPS avec un certificat auto-signé passé par
 * `NODE_EXTRA_CA_CERTS` ; derrière un proxy `HTTPS_PROXY`, sous un faux nom d'hôte que seul le
 * proxy sait joindre.
 */
async function probeProviders(): Promise<Observation> {
  const PROVIDER = 'llmaas'
  const MODEL = 'qwen3-32b'
  const KEY_VAR = 'LLMAAS_API_KEY'
  const KEY = 'cle-essai-104'
  const FAKE_HOST = 'llmaas.essai.invalid'
  const configure = (box: Sandbox, baseURL: string) => {
    mkdirSync(box.env['XDG_CONFIG_HOME'] + '/opencode', { recursive: true })
    writeFileSync(
      join(box.env['XDG_CONFIG_HOME'] ?? '', 'opencode', 'opencode.json'),
      JSON.stringify(
        {
          $schema: 'https://opencode.ai/config.json',
          provider: {
            [PROVIDER]: {
              npm: '@ai-sdk/openai-compatible',
              name: 'LLMaaS d’essai',
              options: { baseURL, apiKey: `{env:${KEY_VAR}}` },
              models: { [MODEL]: { name: 'Qwen 3 32B' }, 'mistral-small': { name: 'Mistral' } }
            }
          },
          enabled_providers: [PROVIDER]
        },
        null,
        2
      )
    )
  }
  /** Session sur le fournisseur d'essai, un message, le texte reçu. */
  const converse = async (box: Sandbox) =>
    withOpenCode(box, async (ctx, seen) => {
      await initialize(ctx)
      const session = await newSession(ctx, box)
      const model = (session.configOptions ?? []).find((o) => o.id === 'model')
      const values =
        model && 'options' in model
          ? (model.options as { value?: unknown }[]).flatMap((o) =>
              typeof o.value === 'string' ? [o.value] : []
            )
          : []
      let selected = 'ok'
      await within(
        REQUEST_MS,
        'modèle',
        ctx.request(methods.agent.session.setConfigOption, {
          sessionId: session.sessionId,
          configId: 'model',
          value: `${PROVIDER}/${MODEL}`
        })
      ).catch((e: { message?: string }) => (selected = `erreur : ${e.message ?? '?'}`))
      seen.updates.length = 0
      const response = await prompt(ctx, session.sessionId, 'Réponds seulement « OK ».').catch(
        (e: { message?: string }) => ({ stopReason: `erreur : ${e.message ?? '?'}` })
      )
      const text = seen.updates
        .flatMap((u) =>
          u.sessionUpdate === 'agent_message_chunk' && u.content.type === 'text'
            ? [u.content.text]
            : []
        )
        .join('')
      return { values, selected, stopReason: response.stopReason, text }
    })

  // 1. HTTP : clé par l'environnement, modèles du fichier seuls proposés, réponse reçue.
  const box = sandbox()
  box.env[KEY_VAR] = KEY
  const plain = await startOpenAiCompatible({ models: [MODEL], apiKey: KEY })
  let http
  try {
    configure(box, plain.url)
    http = await converse(box)
  } finally {
    await plain.close()
    rmSync(box.home, { recursive: true, force: true })
  }
  const completion = plain.requests.find((r) => r.path.endsWith('/chat/completions'))
  const observation: Observation = {
    listed: http.values.includes(`${PROVIDER}/${MODEL}`),
    onlyListed: http.values.length > 0 && http.values.every((v) => v.startsWith(`${PROVIDER}/`)),
    selected: http.selected,
    keyFromEnv: completion?.authorization === `Bearer ${KEY}`,
    path: completion?.path ?? null,
    answered: http.text.includes('OK'),
    stopReason: http.stopReason
  }
  if (!hasOpenssl()) return { ...observation, extraCaCerts: 'openssl introuvable', proxy: 'idem' }

  // 2. HTTPS auto-signé, certificat donné par NODE_EXTRA_CA_CERTS.
  const tls = selfSigned([FAKE_HOST, '127.0.0.1'])
  const secure = await startOpenAiCompatible({ models: [MODEL], apiKey: KEY, tls })
  const proxy = await startConnectProxy({ host: '127.0.0.1', port: secure.port })
  try {
    const box2 = sandbox()
    box2.env[KEY_VAR] = KEY
    box2.env['NODE_EXTRA_CA_CERTS'] = tls.certFile
    let https
    try {
      configure(box2, secure.url)
      https = await converse(box2)
    } finally {
      rmSync(box2.home, { recursive: true, force: true })
    }
    observation['extraCaCerts'] = https.text.includes('OK')
    if (!https.text.includes('OK')) observation['extraCaCertsStop'] = https.stopReason

    // 3. Même serveur, sous un faux nom, joignable seulement par le proxy.
    const box3 = sandbox()
    box3.env[KEY_VAR] = KEY
    box3.env['NODE_EXTRA_CA_CERTS'] = tls.certFile
    box3.env['HTTPS_PROXY'] = proxy.url
    box3.env['NO_PROXY'] = 'localhost,127.0.0.1'
    let viaProxy
    try {
      configure(box3, `https://${FAKE_HOST}/v1`)
      viaProxy = await converse(box3)
    } finally {
      rmSync(box3.home, { recursive: true, force: true })
    }
    observation['proxy'] = viaProxy.text.includes('OK')
    observation['proxyConnect'] = proxy.connects.some((c) => c.startsWith(`${FAKE_HOST}:`))
    if (!viaProxy.text.includes('OK')) observation['proxyStop'] = viaProxy.stopReason
  } finally {
    await proxy.close()
    await secure.close()
    tls.remove()
  }
  return observation
}

// ===== Avec le modèle (gratuit) =====

async function probeSimple(): Promise<Observation> {
  const box = sandbox()
  try {
    return await withOpenCode(box, async (ctx, seen) => {
      await initialize(ctx)
      const { sessionId } = await newSession(ctx, box, true)
      seen.updates.length = 0
      const response = await prompt(ctx, sessionId, 'Réponds seulement « OK ».')
      note(seen)
      const usage = seen.updates.find((u) => u.sessionUpdate === 'usage_update')
      // Que des faits stables : la réflexion et les jetons varient d'un modèle et d'un essai à l'autre.
      return {
        stopReason: response.stopReason,
        usageUpdate: usage ? Object.keys(usage).sort() : [],
        usageCurrency:
          usage?.sessionUpdate === 'usage_update' ? (usage.cost?.currency ?? null) : null,
        turnUsage: response.usage?.inputTokens != null && response.usage.outputTokens != null
      }
    })
  } finally {
    rmSync(box.home, { recursive: true, force: true })
  }
}

async function probeSubagent(): Promise<Observation> {
  const box = sandbox()
  writeFileSync(join(box.workspace, 'secret.txt'), 'Le mot de code est KANGOUROU.\n')
  try {
    const run = await withOpenCode(box, async (ctx, seen) => {
      await initialize(ctx)
      const { sessionId } = await newSession(ctx, box, true)
      seen.updates.length = 0
      await prompt(
        ctx,
        sessionId,
        'Lance un sous-agent (outil subagent, agent « explore ») pour lire le fichier secret.txt et rapporter le mot de code. Ne lis pas le fichier toi-même. Puis donne-moi le mot de code.'
      )
      note(seen)
      const own = seen.updates.filter((u) => !childSessionOf(u))
      const children = seen.updates.filter((u) => childSessionOf(u))
      const tools = own.filter(
        (u): u is Extract<SessionUpdate, { sessionUpdate: 'tool_call' | 'tool_call_update' }> =>
          u.sessionUpdate === 'tool_call' || u.sessionUpdate === 'tool_call_update'
      )
      // La carte : le premier outil dont une mise à jour porte une consigne de sous-agent.
      const titles = new Map<string, string>()
      let card: (typeof tools)[number] | undefined
      for (const t of tools) {
        if (t.title) titles.set(t.toolCallId, t.title)
        if (!card && t.rawInput && Object.keys(t.rawInput).length > 0 && t.kind === 'think')
          card = t
        if (!card && subagentOf(titles.get(t.toolCallId), t.rawInput)) card = t
      }
      const done =
        card && tools.find((t) => t.toolCallId === card.toolCallId && t.status === 'completed')
      const text = (done?.content ?? [])
        .flatMap((c) => (c.type === 'content' && c.content.type === 'text' ? [c.content.text] : []))
        .join('\n')
      const childSession = children.map(childSessionOf).find(Boolean)
      const input = (card?.rawInput ?? {}) as Record<string, unknown>
      const childId = subagentSessionId(text, done?.rawOutput)
      const listed = await ctx.request(methods.agent.session.list, {})
      return {
        called: !!card,
        title: card ? (titles.get(card.toolCallId) ?? null) : null,
        kind: card?.kind ?? null,
        inputKeys: Object.keys(input).sort(),
        recognized: !!card && !!subagentOf(titles.get(card.toolCallId), card.rawInput),
        childMarker: !!childSession,
        childKinds: kindsOf(children).filter((k) => k !== 'agent_thought_chunk'),
        childToolIdsPrefixed: children
          .filter((u) => u.sessionUpdate === 'tool_call')
          .every((u) => 'toolCallId' in u && u.toolCallId.startsWith(`${childSession?.id}:`)),
        childTitleIsDescription:
          !!childSession && childSession.title === (input['description'] as string | undefined),
        resultTag: /^\s*<(\w+)/.exec(text)?.[1] ?? null,
        metadataSessionId:
          typeof (done?.rawOutput as { metadata?: { sessionID?: unknown } } | undefined)?.metadata
            ?.sessionID === 'string',
        sessionIdFound: !!childId,
        childInList: !!childId && listed.sessions.some((s) => s.sessionId === childId),
        // Sous-agents par le protocole (`subagent_update`, instable dans le SDK 1.8).
        subagentUpdate: seen.updates.some((u) => (u.sessionUpdate as string) === 'subagent_update'),
        permissionAsked: seen.permissions.length > 0,
        childId
      }
    })
    const { childId, ...observation } = run
    let childLoadable = false
    if (childId) {
      childLoadable = await withOpenCode(box, async (ctx, seen) => {
        await initialize(ctx)
        await ctx.request(methods.agent.session.load, {
          sessionId: childId,
          cwd: box.workspace,
          mcpServers: []
        })
        return seen.updates.some((u) => u.sessionUpdate === 'tool_call')
      }).catch(() => false)
    }
    return { ...observation, childLoadable }
  } finally {
    rmSync(box.home, { recursive: true, force: true })
  }
}

/** Image PNG d'un pixel : ce que renvoie la fausse capture du serveur MCP de la sonde. */
const PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

/**
 * Outils de l'app (fiche 079) : un serveur MCP « bobine » avec une fausse `browser_screenshot`.
 * Comment OpenCode l'appelle-t-il, et l'app peut-elle rattacher l'appel à sa carte ? Par le titre
 * de la carte (comme Bob, OpenCode 1), ou par une carte en cours dont l'entrée cite l'outil
 * (`execute` d'OpenCode 2).
 */
async function probeAppTools(): Promise<Observation> {
  const box = sandbox()
  const TOOL = 'browser_screenshot'
  try {
    return await withOpenCode(box, async (ctx, seen) => {
      const status = new Map<string, { title: string; input: string; status: string }>()
      const track = () => {
        for (const u of seen.updates) {
          if (u.sessionUpdate !== 'tool_call' && u.sessionUpdate !== 'tool_call_update') continue
          const known = status.get(u.toolCallId) ?? { title: '', input: '', status: 'pending' }
          status.set(u.toolCallId, {
            title: u.title ?? known.title,
            input: u.rawInput !== undefined ? JSON.stringify(u.rawInput) : known.input,
            status: u.status ?? known.status
          })
        }
      }
      let called = false
      /** Cartes en cours quand l'appel MCP est arrivé (leur code peut arriver juste après). */
      const runningAtCall = new Set<string>()
      const server = createServer((req, res) => {
        let body = ''
        req.on('data', (c: Buffer) => (body += c.toString()))
        req.on('end', () => {
          const m = JSON.parse(body || '{}') as {
            id?: number
            method?: string
            params?: { protocolVersion?: string; name?: string }
          }
          const reply = (result: unknown) => {
            res.writeHead(200, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ jsonrpc: '2.0', id: m.id, result }))
          }
          if (m.method === 'initialize') {
            return reply({
              protocolVersion: m.params?.protocolVersion,
              capabilities: { tools: {} },
              serverInfo: { name: 'bobine', version: '0' }
            })
          }
          if (m.method === 'tools/list') {
            return reply({
              tools: [
                {
                  name: TOOL,
                  description: 'Screenshot of the browser panel page.',
                  inputSchema: { type: 'object', properties: {} }
                }
              ]
            })
          }
          if (m.method === 'tools/call') {
            called = true
            track()
            for (const [id, s] of status) {
              if (s.status !== 'completed' && s.status !== 'failed') runningAtCall.add(id)
            }
            return reply({
              content: [
                { type: 'text', text: 'Screenshot 1×1 px.' },
                { type: 'image', data: PIXEL_PNG, mimeType: 'image/png' }
              ]
            })
          }
          if (m.id === undefined) return void res.writeHead(202).end()
          reply({})
        })
      })
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
      const address = server.address()
      const url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/mcp`
      try {
        await initialize(ctx)
        const { sessionId } = await newSession(ctx, box, true, [
          { type: 'http', name: 'bobine', url, headers: [] }
        ])
        seen.updates.length = 0
        await prompt(
          ctx,
          sessionId,
          `Call the tool ${TOOL} of the MCP server named bobine once, then answer "done".`
        )
        note(seen)
        track()
        const cards = [...status.values()]
        const byTitle = cards.some((c) => c.title.includes(TOOL))
        const viaCode = cards.find((c) => !c.title.includes(TOOL) && c.input.includes(TOOL))
        return {
          called,
          via: byTitle ? 'title' : viaCode ? 'code' : 'none',
          ...(viaCode ? { codeCardTitle: viaCode.title } : {}),
          // Une carte en cours au moment de l'appel finit par le citer : l'app peut le rattacher.
          citedByRunningCard: [...runningAtCall].some((id) =>
            (status.get(id)?.input ?? '').includes(TOOL)
          ),
          // État de l'appel noté par `execute` (fiche 122) : l'app y lit les erreurs.
          toolCallsStatus: seen.updates.flatMap((u) => {
            if (u.sessionUpdate !== 'tool_call_update') return []
            const meta = (u.rawOutput as { metadata?: { toolCalls?: unknown } } | undefined)
              ?.metadata
            const calls = Array.isArray(meta?.toolCalls) ? meta.toolCalls : []
            return calls.flatMap((c: { tool?: unknown; status?: unknown }) =>
              typeof c.tool === 'string' && c.tool.endsWith(TOOL) ? [c.status] : []
            )
          })[0],
          imageInContent: seen.updates.some(
            (u) =>
              u.sessionUpdate === 'tool_call_update' &&
              (u.content ?? []).some((c) => c.type === 'content' && c.content.type === 'image')
          )
        }
      } finally {
        server.close()
      }
    })
  } finally {
    rmSync(box.home, { recursive: true, force: true })
  }
}

async function probeQuestion(): Promise<Observation> {
  const box = sandbox()
  try {
    return await withOpenCode(box, async (ctx, seen) => {
      await initialize(ctx)
      const { sessionId } = await newSession(ctx, box, true)
      seen.updates.length = 0
      await prompt(
        ctx,
        sessionId,
        'Utilise ton outil question pour me demander quel langage je préfère (choix : TypeScript, Rust, Go), puis réponds en une phrase selon ma réponse.'
      )
      note(seen)
      const asked = seen.elicitations[0]
      const keys = Object.keys(asked?.schema?.properties ?? {})
      return {
        asked: !!asked,
        // Forme des clés (`q0`, `q0_custom`), sans dépendre du nombre de questions.
        keys: sorted(keys.map((k) => k.replace(/\d+/g, 'N'))),
        toolCallId: !!asked?.toolCallId,
        recognized: !!asked?.schema && !!questionsOf(asked.schema, asked.message)
      }
    })
  } finally {
    rmSync(box.home, { recursive: true, force: true })
  }
}

/** Édition, liste de tâches et compaction, dans la même session (la compaction a de quoi faire). */
async function probeWork(): Promise<Observations> {
  const box = sandbox()
  const original = 'ligne un\nligne deux\nligne trois\n'
  writeFileSync(join(box.workspace, 'notes.md'), original)
  try {
    return await withOpenCode(box, async (ctx, seen) => {
      await initialize(ctx)
      const { sessionId } = await newSession(ctx, box, true)
      seen.updates.length = 0
      await prompt(
        ctx,
        sessionId,
        'Dans notes.md, remplace « ligne deux » par « ligne DEUX » avec ton outil d’édition, puis crée le fichier nouveau.txt contenant « bonjour » avec ton outil d’écriture. Ne fais rien d’autre.'
      )
      note(seen)
      const diffs = seen.updates.flatMap((u) =>
        u.sessionUpdate === 'tool_call_update' || u.sessionUpdate === 'tool_call'
          ? (u.content ?? []).flatMap((c) => (c.type === 'diff' ? [c] : []))
          : []
      )
      const edited = diffs.find((d) => d.path.endsWith('notes.md'))
      const edit = {
        edited: readFileSync(join(box.workspace, 'notes.md'), 'utf8').includes('ligne DEUX'),
        fullDiff: edited?.oldText === original,
        createdFileDiff: diffs.some((d) => d.path.endsWith('nouveau.txt')),
        permissionAsked: seen.permissions.length > 0
      }
      seen.updates.length = 0
      await prompt(
        ctx,
        sessionId,
        'Établis une liste de tâches (todo list) de 3 étapes pour écrire un petit README, avec ton outil de liste de tâches s’il existe, marque la première comme en cours, puis arrête-toi.'
      )
      note(seen)
      const todo = {
        plan: seen.updates.some((u) => u.sessionUpdate === 'plan'),
        todoTools: sorted(
          seen.updates.flatMap((u) =>
            u.sessionUpdate === 'tool_call' && /todo/i.test(u.title ?? '') ? [u.title ?? ''] : []
          )
        )
      }
      seen.updates.length = 0
      await prompt(ctx, sessionId, '/compact')
      note(seen)
      const compaction = {
        ran: true,
        statuses: sorted(
          seen.updates.flatMap((u) => (u.sessionUpdate === 'compaction_update' ? [u.status] : []))
        ),
        summaryChunks: seen.updates.some((u) => u.sessionUpdate === 'compaction_summary_chunk')
      }
      return { édition: edit, 'liste de tâches': todo, compaction }
    })
  } finally {
    rmSync(box.home, { recursive: true, force: true })
  }
}

/**
 * Modifications d'une conversation rouverte (fiche 096) : une édition, puis le fichier changé sur le
 * disque, puis la session rechargée dans un autre processus. OpenCode 2.0.32 ne joint plus le diff
 * (il relit le fichier actuel) ; l'app le refait depuis `rawOutput.metadata.files[].patch`.
 */
async function probeReplayDiffs(): Promise<Observation> {
  const box = sandbox()
  const file = join(box.workspace, 'liste.md')
  writeFileSync(file, 'alpha\nbeta\ngamma\n')
  try {
    const live = await withOpenCode(box, async (ctx, seen) => {
      await initialize(ctx)
      const { sessionId } = await newSession(ctx, box, true)
      seen.updates.length = 0
      await prompt(
        ctx,
        sessionId,
        'Dans liste.md, remplace « beta » par « BETA » avec ton outil d’édition. Ne fais rien d’autre.'
      )
      note(seen)
      const tools = seen.updates.flatMap((u) =>
        u.sessionUpdate === 'tool_call' && u.kind === 'edit' ? [u.title ?? ''] : []
      )
      return { sessionId, tools }
    })
    const edited = readFileSync(file, 'utf8').includes('BETA')
    // Changé depuis : le patch inversé ne s'applique plus au fichier actuel.
    writeFileSync(file, 'tout autre chose\n')
    const replayed = await withOpenCode(box, async (ctx, seen) => {
      await initialize(ctx)
      await within(
        REQUEST_MS,
        'session/load',
        ctx.request(methods.agent.session.load, {
          sessionId: live.sessionId,
          cwd: box.workspace,
          mcpServers: []
        })
      )
      await sleep(500)
      return seen.updates
    })
    const done = replayed.filter(
      (u) =>
        u.sessionUpdate === 'tool_call_update' &&
        u.status === 'completed' &&
        filesOf(u.rawOutput).length > 0
    )
    const diffsOf = (u: SessionUpdate) =>
      'content' in u && Array.isArray(u.content)
        ? u.content.flatMap((c) => (c.type === 'diff' && c.path === file ? [c] : []))
        : []
    const rebuilt = done.flatMap((u) => diffsOf(withPatchDiffs(u, box.workspace)))
    return {
      edited,
      tools: sorted(live.tools),
      patchKept: done.length > 0,
      diffLost: done.length > 0 && done.every((u) => diffsOf(u).length === 0),
      rebuilt: rebuilt.some((d) => d.oldText?.includes('beta') && d.newText.includes('BETA'))
    }
  } finally {
    rmSync(box.home, { recursive: true, force: true })
  }
}

/**
 * Fichier créé (fiche 202) : `write` d'un nouveau fichier, `write` d'un fichier existant et `edit`,
 * avec la permission `edit` par défaut (accordée d'office) ou réglée sur `ask` (accordée une fois,
 * dans le bac à sable jetable) ; puis la session rouverte dans un autre processus (`session/load`).
 */
async function probeCreate(permission: 'allow' | 'ask'): Promise<Observation> {
  const box = sandbox()
  const paths = {
    created: join(box.workspace, 'nouveau.txt'),
    rewritten: join(box.workspace, 'autre.md'),
    edited: join(box.workspace, 'notes.md')
  }
  writeFileSync(paths.edited, 'ligne un\nligne deux\n')
  writeFileSync(paths.rewritten, 'ancien contenu\n')
  if (permission === 'ask') {
    writeFileSync(
      join(box.workspace, 'opencode.json'),
      JSON.stringify({ permission: { edit: 'ask' } })
    )
  }
  try {
    const live = await withOpenCode(
      box,
      async (ctx, seen) => {
        await initialize(ctx)
        const { sessionId } = await newSession(ctx, box, true)
        seen.updates.length = 0
        await prompt(
          ctx,
          sessionId,
          'Fais exactement ces trois choses, dans l’ordre, sans rien d’autre : 1) crée le fichier nouveau.txt contenant « bonjour » avec ton outil d’écriture (write) ; 2) dans notes.md remplace « ligne deux » par « ligne DEUX » avec ton outil d’édition (edit) ; 3) remplace tout le contenu de autre.md par « remplacé » avec ton outil d’écriture (write), sans utiliser edit.'
        )
        note(seen)
        return { sessionId, updates: [...seen.updates], permissions: [...seen.permissions] }
      },
      permission === 'ask'
    )
    const replayed = await withOpenCode(box, async (ctx, seen) => {
      await initialize(ctx)
      await within(
        REQUEST_MS,
        'session/load',
        ctx.request(methods.agent.session.load, {
          sessionId: live.sessionId,
          cwd: box.workspace,
          mcpServers: []
        })
      )
      await sleep(500)
      return seen.updates
    })
    return {
      created: existsSync(paths.created),
      rewritten: readFileSync(paths.rewritten, 'utf8').includes('remplacé'),
      edited: readFileSync(paths.edited, 'utf8').includes('ligne DEUX'),
      live: writeFacts(live.updates, paths),
      permissionAsked: live.permissions.length > 0,
      permissionDiff: live.permissions.some((p) =>
        (p.toolCall.content ?? []).some((c) => c.type === 'diff' && c.path === paths.created)
      ),
      replayed: writeFacts(replayed, paths)
    }
  } finally {
    rmSync(box.home, { recursive: true, force: true })
  }
}

/**
 * Commande dans un autre dossier (fiche 203, recette réelle) : `bash` avec la permission réglée
 * sur `ask`, lancé avec `workdir` réglé sur `docs` (sous-dossier) ou `../autre` (hors du dossier,
 * mais dans le bac à sable). Ce que la demande d'autorisation et l'outil disent du dossier :
 * `rawInput.workdir` (relatif ou absolu ?) et `locations`. Le sous-dossier est autorisé une fois,
 * dans le bac à sable jetable ; le dossier extérieur est refusé (rien n'y est lancé).
 */
async function probeCommandFolder(workdir: 'docs' | '../autre'): Promise<Observation> {
  const box = sandbox()
  mkdirSync(join(box.workspace, 'docs'))
  mkdirSync(join(box.home, 'autre'))
  writeFileSync(join(box.workspace, 'docs', 'guide.md'), '# Guide\n')
  writeFileSync(
    join(box.workspace, 'opencode.json'),
    JSON.stringify({ permission: { bash: 'ask' } })
  )
  try {
    const live = await withOpenCode(
      box,
      async (ctx, seen) => {
        await initialize(ctx)
        const { sessionId } = await newSession(ctx, box, true)
        seen.updates.length = 0
        await prompt(
          ctx,
          sessionId,
          `Lance exactement une seule commande avec ton outil bash : « ls », en réglant le paramètre workdir sur « ${workdir} » (tel quel, relatif). Rien d’autre, puis dis ce que tu vois.`
        )
        note(seen)
        return { updates: [...seen.updates], permissions: [...seen.permissions] }
      },
      workdir === 'docs'
    )
    const inputOf = (raw: unknown) =>
      raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const asked = live.permissions[0]?.toolCall
    const rel = (path: string) => stablePaths(path, { dossier: box.workspace, home: box.home })
    const bash = live.updates.flatMap((u) =>
      (u.sessionUpdate === 'tool_call' || u.sessionUpdate === 'tool_call_update') &&
      typeof inputOf(u.rawInput)['command'] === 'string'
        ? [u]
        : []
    )
    return {
      permissionAsked: asked !== undefined,
      permissionTitles: live.permissions.map((p) => p.toolCall.title ?? null),
      permissionKind: asked?.kind ?? null,
      permissionWorkdir: (inputOf(asked?.rawInput)['workdir'] as string | undefined) ?? null,
      permissionLocations: (asked?.locations ?? []).map((l) => rel(l.path)),
      toolWorkdirs: sorted(
        bash.flatMap((u) => {
          const w = inputOf(u.rawInput)['workdir']
          return typeof w === 'string' ? [w.startsWith('/') ? rel(w) : w] : []
        })
      ),
      toolLocations: sorted(bash.flatMap((u) => (u.locations ?? []).map((l) => rel(l.path))))
    }
  } finally {
    rmSync(box.home, { recursive: true, force: true })
  }
}

/** Ce que disent les mises à jour des outils qui ont créé, réécrit et modifié un fichier. */
function writeFacts(
  updates: SessionUpdate[],
  paths: { created: string; rewritten: string; edited: string }
): Observation {
  const calls = updates.flatMap((u) =>
    u.sessionUpdate === 'tool_call' || u.sessionUpdate === 'tool_call_update' ? [u] : []
  )
  const of = (path: string) => {
    const ids = new Set(
      calls.flatMap((u) => ((u.locations ?? []).some((l) => l.path === path) ? [u.toolCallId] : []))
    )
    const mine = calls.filter((u) => ids.has(u.toolCallId))
    const done = mine.find((u) => u.status === 'completed')
    const texts = (done?.content ?? []).flatMap((c) =>
      c.type === 'content' && c.content.type === 'text' ? [c.content.text] : []
    )
    return {
      kind: mine.find((u) => u.kind)?.kind ?? null,
      inputKeys: sorted(
        mine.flatMap((u) =>
          u.rawInput && typeof u.rawInput === 'object' ? Object.keys(u.rawInput) : []
        )
      ),
      completedText: texts.map((text) => text.replace(/:.*$/s, ': …')),
      completedDiff: (done?.content ?? []).some((c) => c.type === 'diff' && c.path === path),
      files: filesOf(done?.rawOutput).length > 0
    }
  }
  // Ce que l'app en tire : les mises à jour passées par les adaptateurs (fiche 202), le fichier
  // créé a-t-il son diff (rien avant, tout en ajout) ?
  const memory = new ToolCallMemory()
  const adapted = updates.map((u) =>
    OPENCODE_DIFF_SOURCE.complete(u, dirname(paths.created), memory.note(u))
  )
  const rebuilt = adapted.some(
    (u) =>
      (u.sessionUpdate === 'tool_call' || u.sessionUpdate === 'tool_call_update') &&
      u.status === 'completed' &&
      (u.content ?? []).some(
        (c) => c.type === 'diff' && c.path === paths.created && c.oldText === null
      )
  )
  return {
    create: of(paths.created),
    rewrite: of(paths.rewritten),
    edit: of(paths.edited),
    rebuilt
  }
}

/**
 * Règles : un arbre de fichiers avec un mot de code chacun (essai de la fiche 056) ; OpenCode
 * recopie ceux qu'il a chargés, l'app liste les siens (`rules.ts`), on compare.
 */
async function probeRules(version: string): Promise<Observation> {
  const box = sandbox()
  const files: Record<string, string> = {
    '.config/opencode/AGENTS.md': 'ALPHA',
    '.claude/CLAUDE.md': 'BRAVO',
    'AGENTS.md': 'CHARLIE',
    'parent/AGENTS.md': 'DELTA',
    'parent/repo/AGENTS.md': 'ECHO',
    'parent/repo/sub/AGENTS.md': 'FOXTROT',
    'parent/repo/sub/CLAUDE.md': 'GOLF',
    'parent/repo/docs/regles.md': 'HOTEL',
    'perso/india.md': 'INDIA'
  }
  for (const [path, code] of Object.entries(files)) {
    mkdirSync(dirname(join(box.home, path)), { recursive: true })
    writeFileSync(join(box.home, path), `Mot de code : ${code}.\n`)
  }
  writeFileSync(
    join(box.home, 'parent/repo/opencode.json'),
    JSON.stringify({ instructions: ['docs/regles.md'] })
  )
  writeFileSync(
    join(box.home, '.config/opencode/opencode.json'),
    JSON.stringify({ instructions: ['~/perso/*.md'] })
  )
  execFileSync('git', ['init', '-q'], { cwd: join(box.home, 'parent/repo') })
  const workspace = join(box.home, 'parent/repo/sub')
  const sub = { ...box, workspace }
  try {
    const listed = await activeRules(OPENCODE_RULES, {
      workspace,
      home: box.home,
      env: { XDG_CONFIG_HOME: box.env['XDG_CONFIG_HOME'] },
      version
    })
    const expected = sorted(
      listed.flatMap((r) =>
        r.url ? [] : [/Mot de code : ([A-Z]+)/.exec(readFileSync(r.path, 'utf8'))?.[1] ?? '?']
      )
    )
    const answer = await withOpenCode(sub, async (ctx, seen) => {
      await initialize(ctx)
      const { sessionId } = await newSession(ctx, sub, true)
      seen.updates.length = 0
      await prompt(
        ctx,
        sessionId,
        'Recopie exactement, sans rien inventer, la liste de tous les mots de code (en majuscules) qui figurent dans tes instructions et fichiers de consignes chargés (AGENTS.md, etc.). N’utilise aucun outil. Réponds juste par la liste séparée par des virgules, ou AUCUN.'
      )
      note(seen)
      return seen.updates
        .flatMap((u) =>
          u.sessionUpdate === 'agent_message_chunk' && u.content.type === 'text'
            ? [u.content.text]
            : []
        )
        .join('')
    })
    const codes = Object.values(files)
    const loaded = sorted(codes.filter((code) => new RegExp(`\\b${code}\\b`).test(answer)))
    return {
      answered: loaded.length > 0 || /AUCUN/.test(answer),
      expected,
      loaded,
      match: JSON.stringify(expected) === JSON.stringify(loaded)
    }
  } finally {
    rmSync(box.home, { recursive: true, force: true })
  }
}

// ===== Rapport =====

async function record(
  observations: Observations,
  name: string,
  run: () => Promise<Observation | Observations>,
  many = false
): Promise<void> {
  const started = Date.now()
  traces.current = name
  try {
    const result = await run()
    if (many) Object.assign(observations, result as Observations)
    else observations[name] = result as Observation
  } catch (error) {
    observations[name] = { failed: (error as Error).message }
  }
  const shown = many ? name : `${name} : ${JSON.stringify(observations[name])}`
  console.log(`  · ${shown} (${Math.round((Date.now() - started) / 1000)} s)`)
}

async function main(): Promise<void> {
  const observations: Observations = {}
  let version = 'introuvable'
  console.log(
    `Sonde d’OpenCode — ${opencode}${values.offline ? ' (sans modèle)' : ` (modèle ${model})`}\n`
  )
  await record(observations, 'initialize', async () => {
    const init = await probeInitialize()
    version = init.version
    return init.observation
  })
  await record(observations, 'sessions', probeSessions, true)
  await record(observations, 'fournisseurs', probeProviders)
  await record(observations, 'rôles installés (agents)', probeRoleAgents)
  for (const key of ['session/new', 'session/list', 'session/load, resume, delete']) {
    if (observations[key]) console.log(`      ${key} : ${JSON.stringify(observations[key])}`)
  }
  if (!values.offline) {
    const probes: [string, () => Promise<Observation | Observations>, boolean?][] = [
      ['réponse simple', probeSimple],
      ['sous-agent', probeSubagent],
      ['question', probeQuestion],
      ['outils de l’app', probeAppTools],
      ['travail (édition, liste de tâches, compaction)', probeWork, true],
      ['modifications rejouées', probeReplayDiffs],
      ['création (autorisée d’office)', () => probeCreate('allow')],
      ['création (autorisation demandée)', () => probeCreate('ask')],
      ['commande dans un sous-dossier', () => probeCommandFolder('docs')],
      ['commande hors du dossier (refusée)', () => probeCommandFolder('../autre')],
      ['règles', () => probeRules(version)]
    ]
    for (const [name, run, many] of probes) {
      if (!wanted(name)) continue
      await record(observations, name, run, many)
      if (!many) continue
      for (const key of ['édition', 'liste de tâches', 'compaction']) {
        if (observations[key]) console.log(`      ${key} : ${JSON.stringify(observations[key])}`)
      }
    }
    // Types de mise à jour inconnus de l'app (la liste complète varie avec le modèle).
    observations['flux'] = {
      plan: streamPlan,
      unknown: [...streamKinds].filter((k) => !KNOWN_UPDATES.has(k)).sort()
    }
    console.log(`  · flux : ${JSON.stringify(observations['flux'])}`)
  }
  console.log(`\nOpenCode ${version}`)
  if (values.traces) {
    const files = traces.save(TRACES_DIR, version)
    console.log(`${files.length} trace(s) enregistrée(s) dans ${TRACES_DIR}`)
  }

  console.log('\nContrat de l’app')
  const checks = contractChecks(observations)
  for (const check of checks)
    console.log(`  ${check.unverified ? '?' : check.ok ? '✓' : '✗'} ${check.label}`)

  const notes = watchNotes(observations)
  console.log('\nÀ regarder')
  if (notes.length === 0)
    console.log('  rien de nouveau (pas de `plan` ACP, pas de mise à jour inconnue)')
  for (const n of notes) console.log(`  ! ${n}`)

  const expected = existsSync(EXPECTED_FILE)
    ? (JSON.parse(readFileSync(EXPECTED_FILE, 'utf8')) as Expected)
    : undefined
  // Sans modèle : on ne compare que les sondages faits.
  const compared = expected
    ? Object.fromEntries(Object.entries(expected.observations).filter(([k]) => k in observations))
    : {}
  const changes = expected ? diffObservations(compared, observations) : []
  console.log(
    `\nRéponses comparées à celles d’OpenCode ${expected?.opencodeVersion ?? '(aucune attente)'}` +
      (expected ? ` (${expected.recordedAt}, ${expected.model})` : '') +
      (expected?.offline
        ? ` ; sans modèle : ${expected.offline.opencodeVersion} (${expected.offline.recordedAt})`
        : '')
  )
  if (!expected && !values.accept) console.log('  (pas encore d’attentes : relancer avec --accept)')
  else if (changes.length === 0) console.log('  ✓ identiques')
  else for (const change of changes) console.log(`  ≠ ${change}`)

  if (values.accept) {
    const recorded = acceptedExpectations(
      expected,
      {
        version,
        date: new Date().toISOString().slice(0, 10),
        model,
        offline: values.offline === true
      },
      observations
    )
    writeFileSync(EXPECTED_FILE, `${JSON.stringify(recorded, null, 2)}\n`)
    console.log(`\nAttentes enregistrées dans ${EXPECTED_FILE}`)
  }
  const broken = checks.some((c) => !c.ok && !c.unverified)
  const unverified = checks.some((c) => c.unverified)
  const changed = !values.accept && (!expected || changes.length > 0)
  console.log(
    broken || changed || notes.length > 0
      ? '\n✗ à examiner (voir docs/acp.md, « Sonde d’OpenCode »)'
      : unverified
        ? '\n? à relancer : le modèle n’a pas fait tout ce qu’on lui demandait'
        : '\n✓ OpenCode se comporte comme prévu'
  )
  process.exitCode = broken || changed || notes.length > 0 ? 1 : unverified ? 2 : 0
}

await main()
