/**
 * Sonde du contrat ACP de Bob (fiche 048) : ce qui se compare et se vérifie dans les réponses de
 * Bob, sans lancer de processus (testable). Le script `scripts/bob-probe.mts` recueille les
 * réponses ; ce module dit si elles ont changé et si l'app s'y retrouve encore.
 *
 * N'importe aucun alias (`@shared`) : le script tourne sous Node sans bundler.
 */
import {
  AUTH_REQUIRED,
  EXPIRED_LOGIN_MESSAGE,
  INTERNAL_ERROR,
  LICENSE_REQUIRED,
  UNTRUSTED_WORKSPACE
} from './bob-contract.ts'
import type { ContractCheck, Observation, Observations } from './probe-report.ts'
import { BOB_DEFAULT_ALLOWED_COMMANDS, BOB_DEFAULT_GROUPS } from '../../shared/approval-rules.ts'

export {
  diffObservations,
  stablePaths,
  type ContractCheck,
  type Observation,
  type Observations
} from './probe-report.ts'

/** Réponses attendues, enregistrées avec la version de Bob qui les a données. */
export interface Expected {
  bobVersion: string
  recordedAt: string
  observations: Observations
}

/** Sondage des règles d'approbation (fiche 215), nommé ici pour le script et les essais. */
export const APPROVAL_FORMAT_PROBE = 'règles d’approbation : settings.json après lancement'

/**
 * Section `approval` telle que Bobine l'écrit (fiche 215) : posée dans le HOME jetable avant le
 * lancement de `bob acp`, relue après. Bob doit la garder telle quelle.
 */
export const PROBE_APPROVAL = {
  allowed_permissions: [...BOB_DEFAULT_GROUPS, 'execute'],
  allowedExecutors: [
    {
      toolId: 'execute_command',
      approvedCommands: [...BOB_DEFAULT_ALLOWED_COMMANDS, 'bobine-sonde'],
      deniedCommands: ['bobine-sonde-refus']
    }
  ],
  outsideWorkspaceAllowed: false,
  permissionOptions: [{ groupId: 'read', enableOutsideWorkspace: false }]
}

/** Types documentés des clés de `approval` que Bobine lit (`object[]` : tableau d'objets). */
export const APPROVAL_KEY_TYPES: Record<string, string> = {
  allowed_permissions: 'string[]',
  allowedExecutors: 'object[]',
  permissionOptions: 'object[]',
  outsideWorkspaceAllowed: 'boolean',
  autoApprovalEnabled: 'boolean',
  forbiddenApprovalGroups: 'string[]'
}

/** Type d'une valeur JSON, sous la forme de `APPROVAL_KEY_TYPES`. */
export function jsonType(value: unknown): string {
  if (Array.isArray(value)) {
    const kinds = [...new Set(value.map((v) => jsonType(v)))]
    return kinds.length === 1 ? `${kinds[0] ?? ''}[]` : kinds.length === 0 ? '[]' : 'mixed[]'
  }
  return value === null ? 'null' : typeof value
}

/** Ce que la sonde relève de la section `approval` relue (types par clé, section gardée). */
export function approvalObservation(settings: unknown): Observation {
  const approval =
    typeof settings === 'object' && settings !== null
      ? (settings as Record<string, unknown>)['approval']
      : undefined
  if (typeof approval !== 'object' || approval === null || Array.isArray(approval)) {
    return { approval: jsonType(approval) }
  }
  const section = approval as Record<string, unknown>
  const keys = Object.fromEntries(
    Object.keys(section)
      .sort()
      .map((k) => [k, jsonType(section[k])])
  )
  const kept = Object.entries(PROBE_APPROVAL).every(
    ([k, v]) => JSON.stringify(section[k]) === JSON.stringify(v)
  )
  return { keys, kept }
}

/** Format des règles d'approbation (fiche 215) : non vérifié tant que la sonde ne l'a pas relevé. */
function approvalChecks(observations: Observations): ContractCheck[] {
  const format = observations[APPROVAL_FORMAT_PROBE]
  const keys = (format?.['keys'] ?? {}) as Record<string, unknown>
  return [
    {
      label: 'règles d’approbation écrites comme Bobine, gardées par Bob (types documentés)',
      ok:
        !format ||
        (format['kept'] === true &&
          Object.keys(PROBE_APPROVAL).every((k) => k in keys) &&
          Object.entries(keys).every(
            ([k, type]) =>
              !(k in APPROVAL_KEY_TYPES) || APPROVAL_KEY_TYPES[k] === type || type === '[]'
          )),
      ...(format ? {} : { unverified: true })
    }
  ]
}

const has = (list: unknown, value: string) => Array.isArray(list) && list.includes(value)
const matches = (pattern: RegExp, observed: Record<string, unknown>) =>
  typeof observed['message'] === 'string' && pattern.test(observed['message'])

/**
 * Ce dont l'app a besoin dans les réponses de Bob (voir docs/acp.md, « Compatibilité Bob ») :
 * un échec veut dire qu'une fonctionnalité de l'app ne marchera plus avec cette version de Bob.
 */
export function contractChecks(observations: Observations): ContractCheck[] {
  const init = observations['initialize'] ?? {}
  const caps = (init['sessionCapabilities'] as unknown[] | undefined) ?? []
  // Avant 2.0.9 : tout dossier non approuvé refusé ; depuis : seul « Don't trust » (fiche 163).
  const untrusted = [
    observations['session/new : dossier non approuvé'] ?? {},
    observations['session/new : dossier refusé (Don’t trust), clé'] ?? {}
  ]
  const auth = observations['session/new : sans connexion'] ?? {}
  const license = observations['session/new : clé, licence non acceptée'] ?? {}
  // Depuis 2.0.9, avec l'élicitation : formulaire au premier message, refusé → erreur de licence.
  const atPrompt = observations['licence au premier message (formulaire refusé), clé'] ?? {}
  const form = atPrompt['form'] as Record<string, unknown> | null | undefined
  const promptError = atPrompt['prompt'] as Record<string, unknown> | undefined
  // Connexion refusée au message (fiche 200) : sauté si la licence n'est pas acceptée sur ce Mac.
  const atTurn = observations['refus au tour : clé refusée (licence acceptée sur ce Mac)'] ?? {}
  const turnError = atTurn['prompt'] as Record<string, unknown> | undefined
  const db = observations['base locale (coûts)'] ?? {}
  const status = observations['bob chat (quota, /status)'] ?? {}
  return [
    {
      label: 'outils de l’app par MCP HTTP (navigateur, simulateurs, ask_user)',
      ok: (init['mcp'] as Record<string, unknown> | undefined)?.['http'] === true
    },
    { label: 'reprise d’une conversation (session/load)', ok: init['loadSession'] === true },
    { label: '« Relancer » reprend la session (session/resume)', ok: has(caps, 'resume') },
    { label: 'suppression chez l’agent (session/delete)', ok: has(caps, 'delete') },
    { label: 'connexion SSO proposée', ok: has(init['authMethods'], 'sso') },
    {
      label: 'dossier non approuvé reconnu (panneau « Faire confiance »)',
      ok: untrusted.some((o) => matches(UNTRUSTED_WORKSPACE, o))
    },
    { label: 'connexion requise reconnue (code -32000)', ok: auth['code'] === AUTH_REQUIRED },
    {
      label: 'licence à accepter reconnue (panneau « Licence », ou formulaire puis explication)',
      ok:
        matches(LICENSE_REQUIRED, license) ||
        (form?.['mode'] === 'form' &&
          has(form['fields'], 'accept') &&
          matches(LICENSE_REQUIRED, promptError ?? {}))
    },
    {
      label: 'connexion expirée au message reconnue (-32603 « Invalid or expired API key »)',
      ok:
        'skipped' in atTurn ||
        (turnError?.['code'] === INTERNAL_ERROR &&
          EXPIRED_LOGIN_MESSAGE.test(JSON.stringify(turnError['data'] ?? ''))),
      ...('skipped' in atTurn ? { unverified: true } : {})
    },
    {
      label: 'coûts lisibles dans la base de Bob (tasks : id, costs, updated_at, parent_id)',
      ok:
        db['absent'] === true ||
        ['id', 'costs', 'updated_at', 'parent_id'].every((c) => has(db['columns'], c))
    },
    {
      label: 'quota lisible par `/status` de `bob chat` (options de `bob chat --help`)',
      ok: ['--trust', '--disable-mcp', '--disable-subagents'].every((o) =>
        has(status['options'], o)
      )
    },
    ...approvalChecks(observations)
  ]
}
