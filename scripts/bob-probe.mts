/**
 * Sonde du contrat ACP de Bob (fiche 048) : rejoue contre le Bob installé les sondages gratuits de
 * docs/acp.md (« Compatibilité Bob ») et compare ses réponses à celles attendues. À lancer après
 * chaque mise à jour de Bob Shell. Jamais en CI.
 *
 *   pnpm bob-probe [--bob <commande>] [--accept] [--traces] [--only <nom>…]
 *
 * `--only` : seulement les sondages dont le nom contient un des textes (ex. `modes personnalisés`) ;
 * ne compare que ceux-là, sans `--accept`. Les sondages des modes personnalisés ne lisent rien du
 * vrai `~/.bob`.
 *
 * Aucun message n'atteint le modèle : 0 bobcoin (le « ping » de 2.0.9 bute sur la licence,
 * refusée). Bob tourne avec un dossier personnel jetable (`HOME`), sans clé d'API de
 * l'utilisateur et télémétrie coupée : ni sa connexion, ni ses dossiers approuvés, ni son
 * historique ne sont lus ou modifiés. Exceptions, en lecture seule : les colonnes de la table
 * `tasks` de `~/.bob/db/bob.db`, d'où l'app tire les coûts (aucune ligne lue), et le seul réglage
 * `licenseConsent` de `~/.bob/settings/settings.json`. L'app n'accepte jamais la licence : la sonde
 * non plus ; elle reprend seulement, dans son HOME jetable, l'acceptation déjà donnée sur ce Mac
 * par l'utilisateur (refus au tour, ci-dessous). Sans elle, ce sondage est sauté.
 *
 * Règles d'approbation (fiche 215) : la section `approval` que Bobine écrit est posée dans le
 * HOME jetable, puis relue après un lancement de `bob acp` (Bob doit la garder, types documentés).
 * La sonde n'observe que le comportement de Bob : elle ne lit jamais son code installé.
 *
 * `--accept` enregistre les réponses obtenues comme nouvelles attentes (après les avoir lues, et
 * après avoir mis à jour docs/acp.md si le comportement de Bob a changé).
 *
 * `--traces` enregistre aussi les échanges ACP de chaque sondage, nettoyés (secrets masqués,
 * chemins remplacés), dans `src/main/agent/__traces__/bob-<version>/` (fiche 139).
 */
import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Readable, Writable } from 'node:stream'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { client, methods, ndJsonStream, PROTOCOL_VERSION } from '../src/shared/acp-sdk.mts'
import type { ClientContext } from '../src/shared/acp-sdk.mts'
import {
  APPROVAL_FORMAT_PROBE,
  approvalObservation,
  contractChecks,
  diffObservations,
  PROBE_APPROVAL,
  stablePaths,
  type Expected,
  type Observation,
  type Observations
} from '../src/main/agent/bob-probe.ts'
import { ProbeTraces } from '../src/main/agent/acp-trace.ts'
import { BOB_CUSTOM_MODES } from '../src/main/roles/export/bob-custom-modes.ts'

const EXPECTED_FILE = join(dirname(fileURLToPath(import.meta.url)), 'bob-probe.expected.json')
const PROBE_TIMEOUT_MS = 30_000
const FAKE_KEY = 'bobine-sonde-cle-factice'

const { values } = parseArgs({
  options: {
    bob: { type: 'string', default: 'bob' },
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
/** Sondage à faire : tous, ou ceux dont le nom contient un des `--only`. */
const wanted = (name: string) => !values.only || values.only.some((o) => name.includes(o))
const bob = values.bob ?? 'bob'
const TRACES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../src/main/agent/__traces__')
const traces = new ProbeTraces('bob', values.traces === true)

/** Dossiers jetables d'un sondage : le HOME de Bob et le dossier de travail. */
interface Sandbox {
  home: string
  workspace: string
}

function sandbox(): Sandbox {
  // Chemins réels : sur macOS, le dossier temporaire passe par un lien (`/var` → `/private/var`)
  // que Bob résout dans ses messages.
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'bob-sonde-home-')))
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-sonde-dossier-')))
  // Bob envoie des statistiques d'usage par défaut : coupées dans ce HOME neuf.
  mkdirSync(join(home, '.bob', 'settings'), { recursive: true })
  writeFileSync(
    join(home, '.bob', 'settings', 'settings.json'),
    JSON.stringify({ telemetry: { enabled: false } })
  )
  return { home, workspace }
}

/** Environnement de Bob : HOME jetable, aucune clé de l'utilisateur, `extra` en plus. */
function bobEnv(box: Sandbox, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: box.home, OTEL_SDK_DISABLED: 'true' }
  delete env['BOB_API_KEY']
  delete env['BOBSHELL_API_KEY']
  return { ...env, ...extra }
}

/** Réponse en erreur d'une requête ACP, sous une forme stable (`data` seulement si demandé). */
function errorOf(error: unknown, box: Sandbox, withData = false): Observation {
  const e = error as { code?: unknown; message?: unknown; data?: unknown }
  const paths = { dossier: box.workspace, home: box.home }
  return {
    code: typeof e.code === 'number' ? e.code : null,
    message: stablePaths(String(e.message ?? error), paths),
    ...(withData && e.data !== undefined
      ? { data: JSON.parse(stablePaths(JSON.stringify(e.data), paths)) as unknown }
      : {})
  }
}

/** Lance `bob acp` dans un bac à sable, s'y connecte, exécute `op`, puis l'arrête. */
async function withBob(
  args: string[],
  env: Record<string, string>,
  op: (ctx: ClientContext, box: Sandbox) => Promise<Observation>,
  prepare?: (box: Sandbox) => void
): Promise<Observation> {
  const box = sandbox()
  prepare?.(box)
  const child = spawn(bob, ['acp', ...args], {
    cwd: box.workspace,
    env: bobEnv(box, env),
    stdio: ['pipe', 'pipe', 'pipe']
  })
  let stderr = ''
  child.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
  const exited = new Promise<number | null>((resolve) => child.on('exit', resolve))
  const stream = traces.connection(
    ndJsonStream(
      Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
      Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>
    ),
    { dossier: box.workspace, home: box.home }
  )
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('délai dépassé')), PROBE_TIMEOUT_MS).unref()
  )
  try {
    const app = client({ name: 'bobine-sonde' })
      // Jamais rien d'accordé : aucun outil ne doit tourner pendant une sonde.
      .onRequest(methods.client.session.requestPermission, () => ({
        outcome: { outcome: 'cancelled' }
      }))
      .onRequest(methods.client.elicitation.create, ({ params }) => {
        elicitations.push(params)
        return { action: 'decline' }
      })
    return await Promise.race([app.connectWith(stream, (ctx) => op(ctx, box)), timeout])
  } catch (error) {
    // Bob arrêté avant de répondre : sa raison est sur stderr.
    const code = await Promise.race([exited, new Promise<null>((r) => setTimeout(r, 2000, null))])
    const reason = stablePaths(firstLine(stderr), { dossier: box.workspace, home: box.home })
    throw new Error(reason || `${(error as Error).message} (code de sortie ${String(code)})`)
  } finally {
    child.kill()
    await exited
    rmSync(box.home, { recursive: true, force: true })
    rmSync(box.workspace, { recursive: true, force: true })
  }
}

const firstLine = (text: string) => text.trim().split('\n')[0]?.slice(0, 200) ?? ''

function initialize(ctx: ClientContext) {
  return ctx.request(methods.agent.initialize, {
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: { elicitation: { form: {}, url: {} } },
    clientInfo: { name: 'bobine-sonde', version: '0.0.0' }
  })
}

/** Ouvre une session et rend la réponse (ou l'erreur) ; une session ouverte est refermée. */
async function newSession(ctx: ClientContext, box: Sandbox): Promise<Observation> {
  await initialize(ctx)
  try {
    const session = await ctx.request(methods.agent.session.new, {
      cwd: box.workspace,
      mcpServers: []
    })
    const modes = session.modes?.availableModes.map((m) => m.id) ?? []
    await ctx.request(methods.agent.session.close, { sessionId: session.sessionId }).catch(() => {})
    return { opened: true, modes }
  } catch (error) {
    return errorOf(error, box)
  }
}

/** Formulaires demandés par Bob pendant les sondages (tous refusés). */
const elicitations: { message: string; mode?: string; requestedSchema?: unknown }[] = []

/**
 * Licence demandée au premier message (Bob 2.0.9, fiche 163) : session ouverte avec une clé
 * factice, un message envoyé, le formulaire refusé. Bob demande la licence avant tout appel au
 * modèle, et la clé factice n'en permettrait aucun : 0 bobcoin.
 */
async function licenseAtPrompt(ctx: ClientContext, box: Sandbox): Promise<Observation> {
  await initialize(ctx)
  elicitations.length = 0
  try {
    const session = await ctx.request(methods.agent.session.new, {
      cwd: box.workspace,
      mcpServers: []
    })
    const prompt = await ctx
      .request(methods.agent.session.prompt, {
        sessionId: session.sessionId,
        prompt: [{ type: 'text', text: 'ping' }]
      })
      .then(
        (r) => ({ stopReason: r.stopReason }),
        (error: unknown) => errorOf(error, box)
      )
    const form = elicitations[0]
    const schema = form?.requestedSchema as { properties?: Record<string, unknown> } | undefined
    return {
      form: form
        ? {
            mode: form.mode ?? null,
            fields: Object.keys(schema?.properties ?? {}).sort(),
            message: form.message.split('\n')[0] ?? ''
          }
        : null,
      prompt
    }
  } catch (error) {
    return { sessionNew: errorOf(error, box) }
  }
}

/**
 * Connexion refusée au message (fiche 200) : clé factice, licence déjà acceptée sur ce Mac. Bob
 * ouvre la session (il ne vérifie pas la clé avant), puis sa passerelle répond 401 au premier
 * appel au modèle : la même erreur qu'une connexion SSO expirée (refresh refusé, 401). Aucun appel
 * n'aboutit : 0 bobcoin. Deux messages : le second dit si le refus se répète dans la même session.
 */
async function keyRefusedAtPrompt(ctx: ClientContext, box: Sandbox): Promise<Observation> {
  await initialize(ctx)
  try {
    const session = await ctx.request(methods.agent.session.new, {
      cwd: box.workspace,
      mcpServers: []
    })
    const send = () =>
      ctx
        .request(methods.agent.session.prompt, {
          sessionId: session.sessionId,
          prompt: [{ type: 'text', text: 'ping' }]
        })
        .then(
          (r) => ({ stopReason: r.stopReason }),
          (error: unknown) => errorOf(error, box, true)
        )
    const first = await send()
    const second = await send()
    return { sessionNew: { opened: true }, prompt: first, again: second }
  } catch (error) {
    return { sessionNew: errorOf(error, box) }
  }
}

/** L'utilisateur a accepté la licence de Bob sur ce Mac (`licenseConsent`), lu seulement. */
function licenseConsented(): boolean {
  try {
    const file = join(homedir(), '.bob', 'settings', 'settings.json')
    return (
      (JSON.parse(readFileSync(file, 'utf8')) as { licenseConsent?: unknown }).licenseConsent ===
      true
    )
  } catch {
    return false
  }
}

/** Reprend dans le HOME jetable l'acceptation déjà donnée (rien d'autre des réglages réels). */
const consented = (box: Sandbox) =>
  writeFileSync(
    join(box.home, '.bob', 'settings', 'settings.json'),
    JSON.stringify({ telemetry: { enabled: false }, licenseConsent: true })
  )

/** Dossier marqué « Don't trust » dans le HOME jetable (`~/.bob/trustedFolders.json`). */
const distrust = (box: Sandbox) =>
  writeFileSync(
    join(box.home, '.bob', 'trustedFolders.json'),
    JSON.stringify({ version: 1, folders: { [box.workspace]: 'DONT_TRUST' } })
  )

/** Règles d'approbation écrites comme Bobine les écrit (fiche 215), dans le HOME jetable. */
const approvalRules = (box: Sandbox) =>
  writeFileSync(
    join(box.home, '.bob', 'settings', 'settings.json'),
    JSON.stringify({ telemetry: { enabled: false }, approval: PROBE_APPROVAL }, null, 2)
  )

/**
 * Bob lancé sur des règles écrites comme Bobine les écrit : elles doivent rester telles quelles
 * dans `settings.json` (Bob peut y ajouter ses clés, dont `forbiddenApprovalGroups`), avec les
 * types documentés (fiche 215, ADR-0044). Session ouverte puis refermée : aucun message, 0 bobcoin.
 */
async function approvalFormat(ctx: ClientContext, box: Sandbox): Promise<Observation> {
  await newSession(ctx, box)
  const file = join(box.home, '.bob', 'settings', 'settings.json')
  try {
    return approvalObservation(JSON.parse(readFileSync(file, 'utf8')) as unknown)
  } catch (error) {
    return { unreadable: (error as Error).message.split('\n')[0] ?? '' }
  }
}

/**
 * Modes personnalisés de la sonde (fiche 223) : un personnel en lecture seule (groupes
 * `[read, mcp]`), un de projet qui travaille (`[read, edit, execute, mcp]`), écrits EXACTEMENT comme
 * Bobine les installe (`BOB_CUSTOM_MODES.put`, phase 4).
 */
const CUSTOM_MODES = {
  perso: {
    id: 'bobine-sonde-perso',
    label: 'Sonde Bobine perso',
    description: 'Mode personnel de la sonde de Bobine',
    prompt: 'You are a probe mode used by Bobine. Never used for real work.',
    readOnly: true
  },
  projet: {
    id: 'bobine-sonde-projet',
    label: 'Sonde Bobine projet',
    description: 'Mode de projet de la sonde de Bobine',
    prompt: 'You are a probe mode used by Bobine. Never used for real work.',
    readOnly: false
  }
} as const

/** `custom_modes.yaml` tel que Bobine l'écrit (fichier neuf). */
function customModesYaml(mode: (typeof CUSTOM_MODES)[keyof typeof CUSTOM_MODES]): string {
  const put = BOB_CUSTOM_MODES.put(undefined, mode)
  if ('error' in put || put.text === null) throw new Error('mode de la sonde refusé par Bobine')
  return put.text
}

/** Fichier de modes personnalisés : personnel (HOME jetable) ou de projet (dossier de travail). */
const customModesFile = (box: Sandbox, scope: keyof typeof CUSTOM_MODES) =>
  scope === 'perso'
    ? join(box.home, '.bob', 'settings', 'custom_modes.yaml')
    : join(box.workspace, '.bob', 'custom_modes.yaml')

const writeCustomModes = (scope: keyof typeof CUSTOM_MODES) => (box: Sandbox) => {
  const file = customModesFile(box, scope)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, customModesYaml(CUSTOM_MODES[scope]))
}

/**
 * Modes personnalisés de Bob (`custom_modes.yaml`) listés par ACP ? Session ouverte : modes rendus
 * (id, nom, description) ; si le mode de la sonde y est, `session/set_mode` vers lui. Aucun
 * message : 0 bobcoin. Dit aussi si Bob a gardé le fichier tel quel.
 */
const customModesProbe =
  (scope: keyof typeof CUSTOM_MODES) =>
  async (ctx: ClientContext, box: Sandbox): Promise<Observation> => {
    await initialize(ctx)
    const file = customModesFile(box, scope)
    const slug = CUSTOM_MODES[scope].id
    let observed: Observation
    try {
      const session = await ctx.request(methods.agent.session.new, {
        cwd: box.workspace,
        mcpServers: []
      })
      const available = session.modes?.availableModes ?? []
      const setMode = available.some((m) => m.id === slug)
        ? await ctx
            .request(methods.agent.session.setMode, { sessionId: session.sessionId, modeId: slug })
            .then(
              (r) => ({ ok: true, response: JSON.parse(JSON.stringify(r ?? null)) as unknown }),
              (error: unknown) => errorOf(error, box)
            )
        : null
      await ctx
        .request(methods.agent.session.close, { sessionId: session.sessionId })
        .catch(() => {})
      observed = {
        opened: true,
        currentModeId: session.modes?.currentModeId ?? null,
        modes: available.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description ?? null
        })),
        setMode
      }
    } catch (error) {
      observed = { sessionNew: errorOf(error, box) }
    }
    const kept = existsSync(file)
      ? readFileSync(file, 'utf8') === customModesYaml(CUSTOM_MODES[scope])
      : 'supprimé'
    return { ...observed, yamlKept: kept }
  }

const probes: [string, () => Promise<Observation>][] = [
  [
    'initialize',
    () =>
      withBob([], {}, async (ctx) => {
        const init = await initialize(ctx)
        const caps = init.agentCapabilities
        // Extensions propres à Bob (`_meta` des capacités), avec leur version.
        const extensions = Object.fromEntries(
          Object.entries(caps?._meta ?? {}).map(([key, value]) => [
            key,
            (value as { version?: unknown } | null)?.version ?? null
          ])
        )
        return {
          agent: init.agentInfo?.name ?? null,
          title: init.agentInfo?.title ?? null,
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
          extensions
        }
      })
  ],
  [
    'session/list avant connexion',
    () =>
      withBob([], {}, async (ctx, box) => {
        await initialize(ctx)
        try {
          const listed = await ctx.request(methods.agent.session.list, { cwd: box.workspace })
          return { sessions: listed.sessions.length }
        } catch (error) {
          return errorOf(error, box)
        }
      })
  ],
  ['session/new : dossier non approuvé', () => withBob([], {}, newSession)],
  // Bob 2.0.9 : un dossier jamais décidé est approuvé en ACP ; seul « Don't trust » est refusé.
  [
    'session/new : dossier refusé (Don’t trust), clé',
    () => withBob([], { BOB_API_KEY: FAKE_KEY }, newSession, distrust)
  ],
  ['session/new : sans connexion', () => withBob(['--trust'], {}, newSession)],
  [
    'session/new : clé, licence non acceptée',
    () => withBob(['--trust'], { BOB_API_KEY: FAKE_KEY }, newSession)
  ],
  [
    'licence au premier message (formulaire refusé), clé',
    () => withBob(['--trust'], { BOB_API_KEY: FAKE_KEY }, licenseAtPrompt)
  ],
  [
    'refus au tour : clé refusée (licence acceptée sur ce Mac)',
    () =>
      licenseConsented()
        ? withBob(['--trust'], { BOB_API_KEY: FAKE_KEY }, keyRefusedAtPrompt, consented)
        : Promise.resolve({ skipped: 'licence de Bob pas encore acceptée sur ce Mac' })
  ],
  [
    'deux clés différentes',
    () =>
      withBob([], { BOB_API_KEY: FAKE_KEY, BOBSHELL_API_KEY: `${FAKE_KEY}-autre` }, async (ctx) => {
        await initialize(ctx)
        return { refused: false }
      }).catch((error: unknown) => ({ refused: true, reason: (error as Error).message }))
  ],
  [
    APPROVAL_FORMAT_PROBE,
    () => withBob(['--trust'], { BOB_API_KEY: FAKE_KEY }, approvalFormat, approvalRules)
  ],
  [
    'modes personnalisés : ~/.bob/settings/custom_modes.yaml, clé',
    () =>
      withBob(
        ['--trust'],
        { BOB_API_KEY: FAKE_KEY },
        customModesProbe('perso'),
        writeCustomModes('perso')
      )
  ],
  [
    'modes personnalisés : <dossier>/.bob/custom_modes.yaml, clé',
    () =>
      withBob(
        ['--trust'],
        { BOB_API_KEY: FAKE_KEY },
        customModesProbe('projet'),
        writeCustomModes('projet')
      )
  ],
  ['base locale (coûts)', () => Promise.resolve(bobDbSchema())],
  ['bob chat (quota, /status)', () => bobStatusContract()]
]

const CHAT_OPTIONS = ['--trust', '--disable-mcp', '--disable-subagents']

/**
 * Lecture du quota par `bob chat` (fiche 091) : options présentes dans `bob chat --help`. Rien
 * n'est lancé au-delà de `--help` (le panneau `/status` demande une connexion : vérifié à la main).
 */
async function bobStatusContract(): Promise<Observation> {
  const box = sandbox()
  try {
    const help = await new Promise<string>((resolve) => {
      const child = spawn(bob, ['chat', '--help'], {
        env: bobEnv(box),
        stdio: ['ignore', 'pipe', 'ignore']
      })
      let out = ''
      child.stdout.on('data', (d: Buffer) => (out += d.toString()))
      child.on('error', () => resolve(''))
      child.on('exit', () => resolve(out))
    })
    return { options: CHAT_OPTIONS.filter((o) => help.includes(o)) }
  } finally {
    rmSync(box.home, { recursive: true, force: true })
    rmSync(box.workspace, { recursive: true, force: true })
  }
}

/** Colonnes de la table `tasks` de la vraie base de Bob, en lecture seule (aucune donnée lue). */
function bobDbSchema(): Observation {
  const file = join(homedir(), '.bob', 'db', 'bob.db')
  if (!existsSync(file)) return { absent: true }
  const db = new DatabaseSync(file, { readOnly: true })
  try {
    const columns = (db.prepare('PRAGMA table_info(tasks)').all() as { name: string }[])
      .map((c) => c.name)
      .sort()
    return { columns }
  } finally {
    db.close()
  }
}

async function main(): Promise<void> {
  const version = await bobVersion()
  console.log(`Sonde du contrat ACP de Bob — ${bob} ${version}\n`)
  const observations: Observations = {}
  for (const [name, run] of probes) {
    if (!wanted(name)) continue
    traces.current = name
    try {
      observations[name] = await run()
    } catch (error) {
      observations[name] = { failed: (error as Error).message }
    }
    console.log(`  · ${name} : ${JSON.stringify(observations[name])}`)
  }

  if (values.traces) {
    const files = traces.save(TRACES_DIR, version.replace(/^\D*/, '') || 'inconnue')
    console.log(`\n${files.length} trace(s) enregistrée(s) dans ${TRACES_DIR}`)
  }

  console.log('\nContrat de l’app')
  // `--only` : le contrat repose sur tous les sondages, il n'est pas jugé sur une partie.
  const checks = values.only ? [] : contractChecks(observations)
  if (values.only) console.log('  (non vérifié avec --only)')
  for (const check of checks) {
    const mark = check.unverified ? '?' : check.ok ? '✓' : '✗'
    console.log(`  ${mark} ${check.label}${check.unverified ? ' (pas vérifié cette fois)' : ''}`)
  }

  const expected = existsSync(EXPECTED_FILE)
    ? (JSON.parse(readFileSync(EXPECTED_FILE, 'utf8')) as Expected)
    : undefined
  // `--only` : seuls les sondages faits sont comparés.
  const compared = expected
    ? values.only
      ? Object.fromEntries(Object.entries(expected.observations).filter(([k]) => k in observations))
      : expected.observations
    : {}
  const changes = expected ? diffObservations(compared, observations) : []
  console.log(
    `\nRéponses comparées à celles de Bob ${expected?.bobVersion ?? '(aucune attente)'}` +
      (expected ? ` (${expected.recordedAt})` : '')
  )
  if (!expected && !values.accept) console.log('  (pas encore d’attentes : relancer avec --accept)')
  else if (changes.length === 0) console.log('  ✓ identiques')
  else for (const change of changes) console.log(`  ≠ ${change}`)

  if (values.accept) {
    const record: Expected = {
      bobVersion: version,
      recordedAt: new Date().toISOString().slice(0, 10),
      observations
    }
    writeFileSync(EXPECTED_FILE, `${JSON.stringify(record, null, 2)}\n`)
    console.log(`\nAttentes enregistrées dans ${EXPECTED_FILE}`)
  }
  const failed = checks.some((c) => !c.ok) || (!values.accept && (!expected || changes.length > 0))
  console.log(failed ? '\n✗ à examiner (voir docs/acp.md)' : '\n✓ Bob se comporte comme prévu')
  process.exitCode = failed ? 1 : 0
}

function bobVersion(): Promise<string> {
  const box = sandbox()
  return new Promise<string>((resolve) => {
    const child = spawn(bob, ['--version'], {
      env: bobEnv(box),
      stdio: ['ignore', 'pipe', 'ignore']
    })
    let out = ''
    child.stdout.on('data', (d: Buffer) => (out += d.toString()))
    child.on('error', () => resolve('introuvable'))
    child.on('exit', () => resolve(out.trim().split('\n')[0] || 'inconnue'))
  }).finally(() => {
    rmSync(box.home, { recursive: true, force: true })
    rmSync(box.workspace, { recursive: true, force: true })
  })
}

await main()
