/**
 * Sonde de suivi d'OpenCode (fiche 078) : ce qui se vérifie dans ses réponses, sans lancer de
 * processus (testable). Le script `scripts/opencode-probe.mts` recueille les réponses ; ce module
 * dit si l'app s'y retrouve encore, et ce qui mérite d'être regardé (un `plan` ACP, par exemple).
 *
 * N'importe aucun alias (`@shared`) : le script tourne sous Node sans bundler.
 */
import type { SessionUpdate } from '../../shared/acp-sdk.mts'
import { childSessionOf, LOGIN_METHOD } from './opencode-contract.ts'
import { openCodeSubagentOf as subagentOf } from './opencode-subagents.ts'
import type { ContractCheck, Observation, Observations } from './probe-report.ts'

export {
  diffObservations,
  stablePaths,
  type ContractCheck,
  type Observation,
  type Observations
} from './probe-report.ts'

/** Réponses attendues, enregistrées avec la version d'OpenCode qui les a données. */
export interface Expected {
  opencodeVersion: string
  recordedAt: string
  /** Modèle des sondages qui l'appellent (gratuit). */
  model: string
  observations: Observations
  /**
   * Dernière version acceptée sans modèle (`--offline --accept`) : ses réponses aux sondages
   * gratuits remplacent celles de `opencodeVersion`, les autres restent celles du dernier passage
   * complet (fiche 172). Absent après un passage complet.
   */
  offline?: { opencodeVersion: string; recordedAt: string }
}

/**
 * Attentes à enregistrer après `--accept`. Un passage complet remplace tout ; un passage sans
 * modèle ne remplace que les sondages qu'il a faits et garde la version, la date et le modèle du
 * dernier passage complet : la version n'est pas dite testée tant qu'un modèle ne l'a pas essayée.
 */
export function acceptedExpectations(
  previous: Expected | undefined,
  run: { version: string; date: string; model: string; offline: boolean },
  observations: Observations
): Expected {
  if (!run.offline || !previous) {
    return {
      opencodeVersion: run.version,
      recordedAt: run.date,
      model: run.model,
      observations
    }
  }
  return {
    ...previous,
    observations: { ...previous.observations, ...observations },
    offline: { opencodeVersion: run.version, recordedAt: run.date }
  }
}

/**
 * Carte d'outil qui pose une question par l'outil `ask_user` de l'app : appel MCP direct, titré
 * `bobine_ask_user` (OpenCode 1), `mcp__bobine__ask_user` ou « Running Ask User (bobine) » (formats
 * de `matchAppTool`, fiche 071), ou code d'`execute` qui le cite (OpenCode 2, Code Mode). Large à
 * dessein : une question posée par le parent prise à tort pour la sienne rend le sondage « à
 * relancer », jamais vert (fiche 232).
 */
export function asksUser(card: { title?: string | null; rawInput?: unknown }): boolean {
  const title = (card.title ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (title.includes('askuser') || title.includes('asktheuser')) return true
  const input =
    typeof card.rawInput === 'string' ? card.rawInput : JSON.stringify(card.rawInput ?? '')
  return /(^|[^A-Za-z0-9_])ask_user([^A-Za-z0-9_]|$)/.test(input)
}

/**
 * Cartes d'outil de la conversation elle-même : ni travail relayé d'un sous-agent
 * (`_meta["opencode/child-session"]`), ni carte de sous-agent. Titre, entrée et statut fusionnés
 * par appel (le titre peut ne venir qu'avec `tool_call`, l'entrée qu'avec une mise à jour).
 */
export function parentCards(
  updates: SessionUpdate[]
): Map<string, { title: string; rawInput: unknown; status: string }> {
  const cards = new Map<string, { title: string; rawInput: unknown; status: string }>()
  const relayed = new Set<string>()
  for (const u of updates) {
    if (u.sessionUpdate !== 'tool_call' && u.sessionUpdate !== 'tool_call_update') continue
    if (childSessionOf(u)) relayed.add(u.toolCallId)
    const known = cards.get(u.toolCallId) ?? { title: '', rawInput: undefined, status: 'pending' }
    cards.set(u.toolCallId, {
      title: u.title ?? known.title,
      rawInput: u.rawInput ?? known.rawInput,
      status: u.status ?? known.status
    })
  }
  for (const [id, card] of cards) {
    if (relayed.has(id) || subagentOf(card.title || 'subagent', card.rawInput)) cards.delete(id)
  }
  return cards
}

/**
 * Faits qui dépendent du moment où le tour du parent finit (OpenCode 2.3.0, fiche 232) : le travail
 * d'un sous-agent n'est relayé que pendant ce tour, donc relayé ou non selon la course. Vérifiés par
 * le contrat quand ils sont observés ; jamais comparés aux attentes (une course n'est pas un
 * changement d'OpenCode).
 */
export const TIMING_DEPENDENT: ReadonlySet<string> = new Set([
  'sous-agent.childRelayed',
  'sous-agent.childMarker',
  'sous-agent.childToolIdsPrefixed',
  'sous-agent.childTitleIsDescription',
  'sous-agents en parallèle.routed',
  // Pendant ou après le tour du parent, selon le moment où le sous-agent la pose.
  'question d’un sous-agent.afterTurn'
])

/** Les observations sans les faits de `TIMING_DEPENDENT`, pour les comparer aux attentes. */
export function comparable(observations: Observations): Observations {
  return Object.fromEntries(
    Object.entries(observations).map(([name, observation]) => [
      name,
      Object.fromEntries(
        Object.entries(observation).filter(([key]) => !TIMING_DEPENDENT.has(`${name}.${key}`))
      )
    ])
  )
}

/** Mises à jour ACP que l'app sait afficher ou utiliser (`shared/transcript.ts`, hôte d'agent). */
export const KNOWN_UPDATES = new Set([
  'agent_message_chunk',
  'agent_thought_chunk',
  'user_message_chunk',
  'tool_call',
  'tool_call_update',
  'plan',
  'available_commands_update',
  'current_mode_update',
  'config_option_update',
  'usage_update',
  'session_info_update',
  'compaction_update',
  'compaction_summary_chunk'
])

const has = (list: unknown, value: string) => Array.isArray(list) && list.includes(value)
const get = (o: Observations, key: string): Observation => o[key] ?? {}

/**
 * Vérification qui dépend du modèle : sans l'appel attendu (`done` faux), on ne conclut rien.
 */
const byModel = (label: string, done: unknown, ok: unknown): ContractCheck =>
  done === true
    ? { label, ok: ok === true }
    : {
        label: `${label} (non vérifié : le modèle ne l’a pas fait, relancer)`,
        ok: false,
        unverified: true
      }

/**
 * Fournisseurs de modèles écrits par l'app dans `opencode.json` (fiche 104) : le bloc `provider`
 * compatible OpenAI est lu, `enabled_providers` ne laisse que lui, la clé arrive par `{env:VAR}`
 * depuis l'environnement donné à `opencode acp`, et le certificat d'entreprise comme le proxy
 * passent par `NODE_EXTRA_CA_CERTS` et `HTTPS_PROXY`. Sondage absent (sonde ancienne) : rien.
 */
function providerChecks(providers: Observation): ContractCheck[] {
  if (Object.keys(providers).length === 0) return []
  const skipped = typeof providers['extraCaCerts'] === 'string'
  return [
    {
      label:
        'fournisseur compatible OpenAI de opencode.json proposé, et seul avec enabled_providers',
      ok: providers['listed'] === true && providers['onlyListed'] === true
    },
    {
      label:
        'clé du fournisseur posée par l’app : {env:VAR} lu dans l’environnement d’opencode acp',
      ok: providers['keyFromEnv'] === true && providers['answered'] === true
    },
    {
      label: skipped
        ? 'certificat d’entreprise (NODE_EXTRA_CA_CERTS) et proxy (HTTPS_PROXY) : openssl introuvable, non vérifié'
        : 'certificat d’entreprise (NODE_EXTRA_CA_CERTS) et proxy (HTTPS_PROXY) transmis à OpenCode',
      ok: providers['extraCaCerts'] === true && providers['proxy'] === true,
      ...(skipped ? { unverified: true } : {})
    }
  ]
}

/**
 * Rôles installés comme agents d'OpenCode (fiche 223, phase 4) : un agent écrit comme Bobine,
 * personnel et du projet, est listé dans le réglage de mode par ACP et s'y choisit.
 */
function roleAgentsCheck(observed: Observation): ContractCheck[] {
  // Sondage absent (attentes d'avant la phase 4) : rien à vérifier.
  if (Object.keys(observed).length === 0) return []
  const both = (key: string) => {
    const value = observed[key] as Record<string, unknown> | undefined
    return value?.['perso'] === true && value['projet'] === true
  }
  return [
    {
      label: 'rôles installés comme agents (agents/<id>.md) listés et choisis par ACP',
      ok: both('listed') && both('selected') && both('kept')
    }
  ]
}

/**
 * Ce dont l'app a besoin dans les réponses d'OpenCode (docs/acp.md, docs/agents.md) : un échec veut
 * dire qu'une fonctionnalité de l'app ne marchera plus avec cette version d'OpenCode.
 */
export function contractChecks(observations: Observations): ContractCheck[] {
  const init = get(observations, 'initialize')
  const caps = init['sessionCapabilities']
  const session = get(observations, 'session/new')
  const list = get(observations, 'session/list')
  const reopen = get(observations, 'session/load, resume, delete')
  const checks: ContractCheck[] = [
    {
      label: 'outils de l’app par MCP HTTP (navigateur, simulateurs, ask_user)',
      ok: (init['mcp'] as Record<string, unknown> | undefined)?.['http'] === true
    },
    { label: 'reprise d’une conversation (session/load)', ok: init['loadSession'] === true },
    { label: '« Relancer » reprend la session (session/resume)', ok: has(caps, 'resume') },
    { label: '« Reprendre une session… » (session/list)', ok: has(caps, 'list') },
    {
      label: `connexion dans un terminal (${LOGIN_METHOD} → opencode auth login)`,
      ok: has(init['authMethods'], LOGIN_METHOD)
    },
    {
      label: 'modes « build » et « plan » (réglage Session Mode)',
      ok: has(session['modes'], 'build') && has(session['modes'], 'plan')
    },
    {
      label: 'sessions vides masquées (titre « New session - <date> »)',
      ok: list['emptyTitle'] === true
    },
    {
      label: 'session rechargée puis reprise (load, resume)',
      ok: reopen['load'] === 'ok' && reopen['resume'] === 'ok'
    },
    ...providerChecks(get(observations, 'fournisseurs')),
    ...roleAgentsCheck(get(observations, 'rôles installés (agents)'))
  ]
  if (observations['réponse simple'] === undefined) return checks
  const simple = get(observations, 'réponse simple')
  const sub = get(observations, 'sous-agent')
  const question = get(observations, 'question')
  const compaction = get(observations, 'compaction')
  const rules = get(observations, 'règles')
  const appTools = get(observations, 'outils de l’app')
  const replay = get(observations, 'modifications rejouées')
  const create = get(observations, 'création (autorisée d’office)')
  const facts = (key: 'live' | 'replayed') => (create[key] ?? {}) as Observation
  return [
    ...checks,
    byModel(
      'outils de l’app rattachés à leur carte (titre de l’outil, ou carte en cours dont le code le cite : fiche 079)',
      appTools['called'],
      appTools['via'] === 'title' ||
        (appTools['via'] === 'code' && appTools['citedByRunningCard'] === true)
    ),
    ...(appTools['via'] === 'code'
      ? [
          {
            label:
              'erreurs des outils de l’app appelés par execute lisibles (rawOutput.metadata.toolCalls[].status, fiche 122)',
            ok: appTools['toolCallsStatus'] === 'completed'
          }
        ]
      : []),
    {
      label: 'consommation (usage_update avec coût en USD)',
      ok: simple['usageCurrency'] === 'USD'
    },
    // Plus récent que la sonde (fiche 232) : rien tant qu'il n'a pas tourné.
    ...(simple['messageId'] === undefined
      ? []
      : [
          {
            label:
              'messageId sur chaque morceau de réponse (deux réponses hors tour rapprochées séparées, fiche 232)',
            ok: simple['messageId'] === true
          }
        ]),
    byModel('sous-agent reconnu (carte « Sous-agent »)', sub['called'], sub['recognized']),
    byModel(
      'travail du sous-agent rangé sous sa carte (_meta « opencode/child-session », titre = description)',
      // 2.3.0 : rien de relayé si le tour du parent finit avant (course, fiche 232) : à relancer.
      sub['called'] === true && sub['childRelayed'] !== false,
      sub['childMarker'] === true && sub['childTitleIsDescription'] === true
    ),
    byModel(
      '« Voir son travail » : session du sous-agent nommée et rechargeable',
      sub['called'],
      sub['sessionIdFound'] === true && sub['childLoadable'] === true
    ),
    // Carte « en cours » jusqu'à sa vraie fin (fiches 122, 232) : l'outil le dit encore au travail
    // (`metadata.status: "running"`, suivi par sa session), ou sa réponse est dans le résultat.
    byModel(
      'sous-agent suivi jusqu’à sa fin (metadata.status « running », ou réponse dans le résultat)',
      sub['called'],
      sub['background'] === true || sub['resultTag'] === 'subagent' || sub['resultTag'] === 'task'
    ),
    ...parallelChecks(observations['sous-agents en parallèle']),
    ...questionChecks(observations),
    byModel(
      'questions de l’agent affichées en questionnaire',
      question['asked'],
      question['recognized']
    ),
    byModel(
      '/compact compacte la conversation',
      compaction['ran'],
      has(compaction['statuses'], 'completed')
    ),
    byModel(
      'règles actives listées par l’app = règles chargées par OpenCode',
      rules['answered'],
      rules['match']
    ),
    byModel(
      'modifications d’une conversation rouverte : diff refait depuis rawOutput.metadata.files[].patch (fiche 096)',
      replay['edited'],
      replay['patchKept'] === true && replay['rebuilt'] === true
    ),
    // Sondage plus récent que la sonde (fiche 202) : rien tant qu'il n'a pas tourné.
    ...(observations['création (autorisée d’office)'] === undefined
      ? []
      : [
          byModel(
            'fichier créé par write compté dans les modifications, en direct et rouvert (diff refait de rawInput, fiche 202)',
            create['created'],
            facts('live')['rebuilt'] === true && facts('replayed')['rebuilt'] === true
          )
        ])
  ]
}

/**
 * Deux sous-agents lancés ensemble (fiche 232) : chacun sa session, et son travail relayé à sa
 * carte. Rien tant que le sondage, plus récent que la sonde, n'a pas tourné.
 */
function parallelChecks(par: Observation | undefined): ContractCheck[] {
  if (par === undefined) return []
  return [
    byModel(
      'sous-agents en parallèle : chacun sa session, nommée par son outil avant son travail relayé (rangé sous sa carte)',
      par['called'] === true && par['routed'] !== null,
      par['distinctSessions'] === true && par['routed'] === true
    )
  ]
}

/**
 * Questions répondues (fiche 232) : la réponse que Bobine construit revient à l'agent ; un refus ou
 * une annulation finit le tour sans rien laisser en attente ; plusieurs questions d'un seul appel
 * et celle d'un sous-agent s'affichent en questionnaire. Rien tant que ces sondages, plus récents
 * que la sonde, n'ont pas tourné.
 */
function questionChecks(observations: Observations): ContractCheck[] {
  if (observations['question (texte libre)'] === undefined) return []
  const choice = get(observations, 'question')
  const free = get(observations, 'question (texte libre)')
  const many = get(observations, 'questions (plusieurs, choix multiple)')
  const sub = get(observations, 'question d’un sous-agent')
  const closed = (o: Observation) => o['pending'] === false && o['continues'] === true
  return [
    byModel(
      'réponse à une question rendue à l’agent (choix, puis texte libre « Autre »)',
      choice['asked'] === true && free['asked'] === true,
      choice['used'] === true && free['used'] === true
    ),
    byModel(
      'plusieurs questions d’un seul appel affichées en questionnaire, réponses rendues',
      many['asked'],
      many['recognized'] === true && Number(many['questions']) >= 2 && many['used'] === true
    ),
    ...(['question refusée', 'question annulée'] as const).map((name) =>
      byModel(
        `${name} : le tour finit, rien en attente, la conversation continue`,
        get(observations, name)['asked'],
        closed(get(observations, name))
      )
    ),
    // Un sous-agent d'OpenCode 2.3.0 n'a pas l'outil `question` : il passe par `ask_user` de l'app.
    // Qu'il l'ait un jour (`elicited`) se verra en écart aux attentes, pas en contrat rompu.
    byModel(
      'question d’un sous-agent en arrière-plan (ask_user de l’app) affichée en questionnaire',
      sub['asked'] === true && sub['parentAsked'] === false,
      sub['recognized']
    )
  ]
}

/**
 * À regarder, même si le contrat tient : ce qu'OpenCode fait de nouveau et que l'app pourrait
 * utiliser (un `plan` ACP pour la liste de tâches, `subagent_update`, une mise à jour inconnue).
 */
export function watchNotes(observations: Observations): string[] {
  const notes: string[] = []
  const stream = get(observations, 'flux')
  const todo = get(observations, 'liste de tâches')
  const sub = get(observations, 'sous-agent')
  if (stream['plan'] === true || todo['plan'] === true) {
    notes.push(
      'OpenCode envoie un `plan` ACP : sa liste de tâches peut s’afficher (onglet Tâches, fiche 035 ; liste épinglée, fiche 077) — à vérifier, puis docs/agents.md.'
    )
  }
  const todoTools = Array.isArray(todo['todoTools']) ? (todo['todoTools'] as string[]) : []
  if (todoTools.length > 0) {
    notes.push(`Outil de liste de tâches revenu : ${todoTools.join(', ')} (sans \`plan\` ACP ?).`)
  }
  if (sub['subagentUpdate'] === true) {
    notes.push(
      'OpenCode envoie `subagent_update` (ACP) : le travail des sous-agents pourrait passer par le protocole plutôt que par `_meta` (fiches 010, 078).'
    )
  }
  const appTools = get(observations, 'outils de l’app')
  if (appTools['via'] === 'none' && appTools['called'] === true) {
    notes.push(
      'Outil MCP de l’app appelé sans carte qui le nomme ni le cite : son libellé et ses captures manqueront dans le fil (fiche 079).'
    )
  }
  const replay = get(observations, 'modifications rejouées')
  if (replay['patchKept'] === true && replay['diffLost'] === false) {
    notes.push(
      'OpenCode rejoue le diff d’une modification même si le fichier a changé depuis : `replay-diffs` (opencode-diffs.ts) n’a peut-être plus lieu d’être (fiche 096).'
    )
  }
  const unknown = Array.isArray(stream['unknown']) ? (stream['unknown'] as string[]) : []
  if (unknown.length > 0) {
    notes.push(`Mises à jour ACP inconnues de l’app : ${unknown.join(', ')}.`)
  }
  return notes
}
