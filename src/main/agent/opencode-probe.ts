/**
 * Sonde de suivi d'OpenCode (fiche 078) : ce qui se vérifie dans ses réponses, sans lancer de
 * processus (testable). Le script `scripts/opencode-probe.mts` recueille les réponses ; ce module
 * dit si l'app s'y retrouve encore, et ce qui mérite d'être regardé (un `plan` ACP, par exemple).
 *
 * N'importe aucun alias (`@shared`) : le script tourne sous Node sans bundler.
 */
import { LOGIN_METHOD } from './opencode-contract.ts'
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
    byModel('sous-agent reconnu (carte « Sous-agent »)', sub['called'], sub['recognized']),
    byModel(
      'travail du sous-agent rangé sous sa carte (_meta « opencode/child-session », titre = description)',
      sub['called'],
      sub['childMarker'] === true && sub['childTitleIsDescription'] === true
    ),
    byModel(
      '« Voir son travail » : session du sous-agent nommée et rechargeable',
      sub['called'],
      sub['sessionIdFound'] === true && sub['childLoadable'] === true
    ),
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
