/**
 * Réglages appliqués à l'ouverture d'une session (sortis de `agent-host.ts`, fiche 142) : ceux de
 * la conversation, sinon ceux retenus pour le profil (préférences, sinon défauts du profil ;
 * fiche 256), puis le mode de départ choisi dans les réglages. Un réglage inapplicable est signalé dans le fil sans bloquer la session.
 */
import { methods, RequestError } from '../../shared/acp-sdk.mts'
import type { ClientConnection, SessionConfigOption } from '../../shared/acp-sdk.mts'
import type { AgentEvent, ControlValue, SessionControl } from '@shared/agent'
import type { Message } from '@shared/i18n/message'
import { executionMode, isPlanMode } from '@shared/plan-doc'
import { t } from 'i18next'
import { log } from '../log'
import { AgentTimeout, errorMessage, race } from './process-utils'
import { isValidValue } from './session-controls'
import type { AgentProfile } from './profiles'
import type { AgentHostOptions } from './agent-host'

/**
 * Une session s'ouvre-t-elle au démarrage de l'hôte (`newSession`, essai du diagnostic) ? Toujours
 * par défaut ; `if-deletable` seulement si l'agent sait la supprimer ensuite ; `never` jamais
 * (profil jetable sur les vrais agents, fiche 242).
 */
export function opensSession(
  newSession: 'always' | 'if-deletable' | 'never' | undefined,
  canDelete: boolean
): boolean {
  if (newSession === 'never') return false
  return newSession !== 'if-deletable' || canDelete
}

export interface InitialControlsInput {
  /** Réglages de la session, relus après chaque changement. */
  controls: () => SessionControl[]
  /** Envoie un réglage à l'agent. */
  apply: (id: string, value: ControlValue) => Promise<void>
  /** Rejetée si l'agent meurt pendant l'ouverture. */
  failed: Promise<never>
  emit: (event: AgentEvent) => void
  /**
   * Nom de l'agent et nom retenu d'une valeur qu'il ne propose plus (modèles retenus, fiche 108) :
   * l'avis dit « GPT-6.2 Sol n'est plus proposé par OpenCode », sans identifiant brut (fiche 266).
   */
  labels?: {
    agent: string
    known?: ((controlId: string, value: string) => string | undefined) | undefined
    /** L'avis d'une valeur plus proposée est donné : ne plus la renvoyer à cette conversation. */
    warned?: ((controlId: string, value: string) => void) | undefined
  }
  /**
   * Réglages de la conversation, sinon (nouvelle conversation) ceux retenus pour le profil
   * (préférences, sinon défauts du profil) ; fiche 256.
   */
  initialControls?: Record<string, ControlValue> | undefined
  /** Mode de départ (réglage « Nouvelle conversation ») ; absent à la réouverture d'une session. */
  initialMode?: 'plan' | 'execute' | undefined
}

/**
 * Envoie un réglage à l'agent : `session/set_mode` (agent à modes seuls), sinon
 * `session/set_config_option`. Rend les options annoncées en réponse, ou `undefined` pour un mode.
 */
export async function sendControl(
  connection: ClientConnection,
  request: { sessionId: string; id: string; value: ControlValue; fromModes: boolean }
): Promise<SessionConfigOption[] | undefined> {
  const { sessionId, id: configId, value } = request
  if (request.fromModes && typeof value === 'string') {
    await connection.agent.request(methods.agent.session.setMode, { sessionId, modeId: value })
    return undefined
  }
  const response = await connection.agent.request(
    methods.agent.session.setConfigOption,
    typeof value === 'boolean'
      ? { sessionId, configId, type: 'boolean', value }
      : { sessionId, configId, value }
  )
  return response.configOptions
}

/**
 * Ce que l'hôte d'agent fournit à `applyInitialSettings` : réglages relus à cette ouverture (fiche
 * 256), mode de départ pour une session neuve seulement, noms dits dans l'avis (fiche 266).
 */
export function settingsOf(
  host: Pick<
    AgentHostOptions,
    'emit' | 'profile' | 'controlNotices' | 'initialControls' | 'initialMode'
  >,
  reopened: boolean,
  reopening: boolean
): Pick<InitialControlsInput, 'emit' | 'labels' | 'initialControls' | 'initialMode'> {
  return {
    emit: host.emit,
    labels: {
      agent: host.profile.label,
      known: host.controlNotices?.knownName,
      warned: host.controlNotices?.warned
    },
    initialControls: host.initialControls?.(reopened ? 'reopened' : 'new'),
    initialMode: reopening ? undefined : host.initialMode
  }
}

/** Réglages retenus, puis mode de départ. */
export async function applyInitialSettings(input: InitialControlsInput): Promise<void> {
  await applyInitialControls(input, input.initialControls ?? {})
  await applyInitialMode(input, input.initialMode)
}

/** Applique les réglages initiaux ; un réglage inapplicable est signalé sans bloquer la session. */
async function applyInitialControls(
  input: InitialControlsInput,
  wanted: Record<string, ControlValue>
): Promise<void> {
  for (const [id, value] of Object.entries(wanted)) {
    const control = input.controls().find((c) => c.id === id)
    if (control?.currentValue === value) continue
    // Valeur que l'agent ne propose plus (modèle retiré, connexion perdue) : rien n'est envoyé,
    // l'avis dit en clair ce qui est pris à la place (fiche 266, D32).
    if (control && !isValidValue(control, value)) {
      log.warn(`Réglage ${id} non proposé par l'agent : ${String(value)}`)
      input.emit(notOffered(input, control, value))
      if (typeof value === 'string') input.labels?.warned?.(id, value)
      continue
    }
    try {
      await Promise.race([input.apply(id, value), input.failed])
    } catch (error) {
      // L'erreur brute va au journal ; l'avis dit ce que la conversation garde (revue UX).
      log.warn(`Réglage ${id} non appliqué (${String(value)}) : ${errorMessage(error)}`)
      input.emit(failedNotice(input, control, id, value, error))
    }
  }
}

/** Ce que l'hôte d'agent fournit pour les avis d'un réglage plus proposé (fiche 266, D32). */
export interface ControlNotices {
  knownName?: (controlId: string, value: string) => string | undefined
  warned?: (controlId: string, value: string) => void
}

/**
 * Réglage non appliqué : un modèle, « n'a pas pu passer au modèle … : cette conversation garde … » ;
 * un autre réglage, ce qui est gardé ; sans valeur courante connue, l'erreur de l'agent.
 */
function failedNotice(
  input: InitialControlsInput,
  control: SessionControl | undefined,
  id: string,
  value: ControlValue,
  error: unknown
): AgentEvent {
  const current = control ? currentName(input.controls(), control.id) : undefined
  const wanted = control ? valueName(input, control, value) : String(value)
  const name = control?.name ?? id
  const agent = input.labels?.agent ?? ''
  const message: Message =
    current && control?.category === 'model'
      ? { key: 'agentHost.notice.modelFailedKept', params: { agent, wanted, current } }
      : current
        ? { key: 'agentHost.notice.controlFailedKept', params: { name, value: wanted, current } }
        : {
            key: 'agentHost.notice.controlFailed',
            params: { name, value: wanted, error: errorMessage(error) }
          }
  return { type: 'notice', level: 'warning', message }
}

/** Réglage appliqué par l'agent après le délai : l'avis d'échec est corrigé (revue QA). */
export function lateNotice(
  profile: Pick<AgentProfile, 'label'>,
  control: SessionControl,
  value: ControlValue
): AgentEvent {
  const option =
    control.type === 'select' ? control.options.find((o) => o.value === value)?.name : undefined
  return {
    type: 'notice',
    level: 'info',
    message: {
      key: 'agentHost.notice.controlLate',
      params: { agent: profile.label, name: control.name, value: option ?? String(value) }
    }
  }
}

/** Appel au-delà du délai (`raced` rejeté par `AgentTimeout`) qui aboutit quand même : `onLate`. */
export function watchLate(call: Promise<unknown>, raced: Promise<unknown>, onLate: () => void) {
  call.catch(() => {})
  raced.catch((error: unknown) => {
    if (error instanceof AgentTimeout) call.then(onLate, () => {})
  })
}

/**
 * Envoi d'un réglage borné par le délai (`race`) ; s'il aboutit quand même après le délai, un avis
 * le dit (`lateNotice`, revue QA).
 */
export async function raceControl(
  call: Promise<unknown>,
  failed: Promise<never>,
  ms: number,
  host: Pick<AgentHostOptions, 'emit' | 'profile'>,
  sent: { control: SessionControl; value: ControlValue }
): Promise<void> {
  const { control, value } = sent
  const what = t('agentHost.timeout.control', { name: control.name })
  const raced = race(failed, ms, what, call)
  watchLate(call, raced, () => host.emit(lateNotice(host.profile, control, value)))
  await raced
}

/** Nom affiché d'une valeur : celui de l'option, sinon un nom retenu, sinon la valeur. */
function valueName(input: InitialControlsInput, control: SessionControl, value: ControlValue) {
  if (typeof value !== 'string') return String(value)
  return (
    control.options.find((o) => o.value === value)?.name ??
    input.labels?.known?.(control.id, value) ??
    value
  )
}

/** Nom de la valeur courante d'un réglage `select`, relu après l'échec. */
function currentName(controls: readonly SessionControl[], id: string): string | undefined {
  const control = controls.find((c) => c.id === id)
  if (control?.type !== 'select') return undefined
  return control.options.find((o) => o.value === control.currentValue)?.name
}

/**
 * Avis d'une valeur plus proposée : « Le modèle GPT-6.2 Sol n'est plus proposé par OpenCode : cette
 * conversation utilise Tidepool Alpha Free. » ; un autre réglage, avec son nom.
 */
function notOffered(
  input: InitialControlsInput,
  control: SessionControl,
  value: ControlValue
): AgentEvent {
  const wanted = valueName(input, control, value)
  const current = currentName(input.controls(), control.id)
  const agent = input.labels?.agent ?? ''
  const model = control.category === 'model'
  const key = model
    ? current
      ? 'agentHost.notice.modelNotOffered'
      : 'agentHost.notice.modelNotOfferedNone'
    : current
      ? 'agentHost.notice.controlNotOffered'
      : 'agentHost.notice.controlNotOfferedNone'
  return {
    type: 'notice',
    level: 'warning',
    message: { key, params: { name: control.name, wanted, agent, ...(current ? { current } : {}) } }
  }
}

/** Mode de départ choisi dans les réglages, s'il diffère du mode courant. */
async function applyInitialMode(
  input: InitialControlsInput,
  wanted: 'plan' | 'execute' | undefined
): Promise<void> {
  const control = input.controls().find((c) => c.category === 'mode' && c.type === 'select')
  if (!wanted || control?.type !== 'select') return
  const value =
    wanted === 'plan'
      ? control.options.find((o) => isPlanMode({ id: o.value, name: o.name }))?.value
      : executionMode([], control.options)
  if (!value || value === control.currentValue) return
  await Promise.race([input.apply(control.id, value), input.failed]).catch((error: unknown) => {
    input.emit({
      type: 'notice',
      level: 'warning',
      message: { key: 'agentHost.notice.modeFailed', params: { error: errorMessage(error) } }
    })
  })
}

/**
 * Ouvre la session avec le mode de départ dans `_meta` quand le profil le permet (fiche 163 ;
 * Bob : `bob/mode`). Mode refusé par l'agent (`invalidParams`) : session ouverte sans, le mode
 * étant ensuite appliqué par `applyInitialSettings`, comme pour tout agent.
 */
export async function openWithStartMode<T>(
  open: (meta?: Record<string, string>) => Promise<T>,
  modeMeta: AgentProfile['initialModeMeta'],
  wanted: 'plan' | 'execute' | undefined
): Promise<T> {
  if (!modeMeta || !wanted) return open()
  try {
    return await open({ [modeMeta.key]: modeMeta.ids[wanted] })
  } catch (error) {
    if ((error as { code?: unknown }).code !== RequestError.invalidParams().code) throw error
    log.warn(`Mode de départ refusé à l'ouverture (${modeMeta.key}) : ${errorMessage(error)}`)
    return open()
  }
}
