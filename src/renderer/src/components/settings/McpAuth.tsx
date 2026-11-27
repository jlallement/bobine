/**
 * Connexion des serveurs MCP distants par l'agent (fiche 293, ADR-0077), dans Réglages › Serveurs
 * MCP : la ligne d'état sous l'adresse d'un serveur, la ligne « <préréglage> » à ajouter, et la
 * ligne d'aide d'un agent qui n'a pas la capacité. Rien de propre à un agent ni à un serveur : la
 * capacité vient de la vue (`oauth`, posé par le main d'après le profil), le serveur de son
 * préréglage (`shared/mcp-presets.ts` : nom, logo, liste publique).
 *
 * Gabarit (maquette validée) : **un état = une ligne**, au poids du résultat de « Tester » ; icône +
 * texte court (jamais la couleur seule), puis les actions en liens séparés par « · », qui reste en
 * fin de ligne avec ce qui le précède. Le détail est dans l'info-bulle (`title`) et dans la
 * description accessible. Seul bouton plein : « Connecter <préréglage> ».
 */
import {
  Check,
  CircleAlert,
  ExternalLink,
  Info,
  LoaderCircle,
  X,
  type LucideIcon
} from 'lucide-react'
import i18next from 'i18next'
import { Fragment, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import {
  MCP_AUTH_MINUTES,
  type McpAgentView,
  type McpAuthState,
  type McpServerEntry
} from '@shared/mcp'
import { MCP_PRESETS, presetById, presetForUrl, type McpPreset } from '@shared/mcp-presets'
import { currentLocale } from '@shared/i18n/format'
import { brandLogo } from '../../brand-logos'
import type { McpAuthModel } from '../../mcp-auth'
import { ReasonButton } from '../common/ReasonButton'
import { ConfirmRow } from './ConfirmRow'
import '../../mcp-auth.css'

/** Logo officiel du préréglage, seulement mis à l'échelle ; texte alternatif vide (nom à côté). */
export function PresetLogo({ preset, size }: { preset: McpPreset; size: 28 | 56 }) {
  const src = brandLogo(preset.logo)
  if (!src) return null
  return (
    <img
      className={`mcp-preset-logo size-${size}`}
      src={src}
      alt=""
      height={size}
      draggable={false}
      data-testid="mcp-preset-logo"
    />
  )
}

/** Préréglage d'un serveur que l'agent connecte lui-même ; `undefined` pour les autres. */
export function authPresetOf(server: McpServerEntry): McpPreset | undefined {
  return server.authPreset ? presetById(server.authPreset) : undefined
}

type DotState = 'off' | 'unknown' | 'testing' | 'ok' | 'warn' | 'error'
/** Libellés des pastilles : clés `mcp.state.<label>`. */
type DotLabel =
  'off' | 'authUnknown' | 'toConnect' | 'connecting' | 'connected' | 'expired' | 'authError'

const DOTS: Record<McpAuthState['status'], { state: DotState; label: DotLabel }> = {
  unknown: { state: 'unknown', label: 'authUnknown' },
  'to-connect': { state: 'unknown', label: 'toConnect' },
  connecting: { state: 'testing', label: 'connecting' },
  connected: { state: 'ok', label: 'connected' },
  expired: { state: 'warn', label: 'expired' },
  refused: { state: 'error', label: 'authError' },
  error: { state: 'error', label: 'authError' },
  'no-page': { state: 'unknown', label: 'toConnect' },
  'agent-missing': { state: 'unknown', label: 'authUnknown' }
}

/** Pastille et son libellé (clé `mcp.state.<label>`) d'après l'état de la connexion. */
export function dotOf(
  server: McpServerEntry,
  state: McpAuthState | undefined
): { state: DotState; label: DotLabel } {
  return !server.enabled ? { state: 'off', label: 'off' } : DOTS[state?.status ?? 'unknown']
}

/** Pastille d'un serveur connecté par l'agent : d'après l'état de sa connexion, pas « Tester ». */
export function McpAuthDot({
  server,
  state
}: {
  server: McpServerEntry
  state: McpAuthState | undefined
}) {
  const { t } = useTranslation()
  const dot = dotOf(server, state)
  const label = t(`mcp.state.${dot.label}`)
  return (
    <span
      className={`mcp-dot ${dot.state}`}
      role="img"
      aria-label={label}
      title={label}
      data-testid="mcp-dot"
      data-state={dot.state}
    />
  )
}

interface Action {
  id: string
  label: string
  run: () => void
  /** Pourquoi le lien ne fait rien (fiche 287) ; il reste atteignable au clavier. */
  reason?: string | undefined
  tip?: string | undefined
  expanded?: boolean
}

interface Line {
  tone: '' | 'ok' | 'warn' | 'err'
  icon: LucideIcon
  spin?: boolean
  text: ReactNode
  tip?: string | undefined
  actions: Action[]
}

/**
 * Ligne d'état d'un serveur connecté par l'agent, sous son adresse : une phrase et ses actions.
 * `asking` : la confirmation de déconnexion est ouverte (bouton marqué).
 */
export function McpAuthLine({
  view,
  server,
  model,
  asking,
  onAskDisconnect
}: {
  view: McpAgentView
  server: McpServerEntry
  model: McpAuthModel
  asking: boolean
  onAskDisconnect: () => void
}) {
  const line = useLine(view, server, model, asking, onAskDisconnect)
  if (!line) return null
  const { tone, icon: Icon, spin, text, tip, actions } = line
  const status = model.states[server.name]?.status ?? 'unknown'
  return (
    <div
      className={`mcp-auth${tone ? ` ${tone}` : ''}`}
      title={tip}
      data-testid="mcp-auth"
      data-status={status}
    >
      {/* L'état est annoncé quand il change (lecteur d'écran), sans voler le focus. */}
      <span className="st" role="status" aria-live="polite" aria-description={tip}>
        <Icon size={12} className={spin ? 'spin' : undefined} aria-hidden="true" />
        <span data-testid="mcp-auth-text">{text}</span>
        {actions.length > 0 && <Sep />}
      </span>
      {actions.map((action, i) => (
        <Fragment key={action.id}>
          {/* Seule occasion de passer à la ligne : entre deux éléments, jamais avant un « · ». */}{' '}
          <span className="act">
            <ReasonButton
              className="link"
              reason={action.reason}
              tip={action.tip}
              aria-expanded={action.expanded}
              onClick={action.run}
              data-testid={`mcp-auth-${action.id}`}
            >
              {action.label}
            </ReasonButton>
            {i < actions.length - 1 && <Sep />}
          </span>
        </Fragment>
      ))}
    </div>
  )
}

const Sep = () => (
  <span className="sep" aria-hidden="true">
    ·
  </span>
)

/** Ce que dit la ligne, d'après l'état relu, la note de la dernière action et le serveur. */
function useLine(
  view: McpAgentView,
  server: McpServerEntry,
  model: McpAuthModel,
  asking: boolean,
  onAskDisconnect: () => void
): Line | undefined {
  const { t } = useTranslation()
  const preset = authPresetOf(server)
  const { name } = server
  const state = model.states[name]
  const agent = view.label
  const presetName = preset ? t(`mcp.preset.${preset.id}.name`) : name
  const minutes = MCP_AUTH_MINUTES
  const command = model.terminal[name]
  // « Se connecter » et ses variantes : grisés avec leur raison (fiche 287).
  const blocked = !server.enabled
    ? t('mcp.auth.disabled')
    : model.busy && state?.status !== 'connecting'
      ? t('mcp.auth.busy')
      : undefined
  const connect = (id: string, label: string): Action => ({
    id,
    label,
    run: () => void model.connect(name),
    reason: blocked
  })
  const terminal: Action[] = command
    ? [
        {
          id: 'terminal',
          label: t('mcp.auth.inTerminal'),
          tip: t('mcp.auth.inTerminalTip', { command, agent }),
          run: () => void model.copyCommand(name)
        }
      ]
    : []
  const signIn = connect('connect', t('mcp.auth.connect'))
  const retry = connect('retry', t('mcp.auth.retry'))

  if (!state) {
    // Relecture impossible : dite ; pas encore relue : rien (pas d'état deviné).
    return model.error
      ? { tone: '', icon: Info, text: t('mcp.auth.unknown'), tip: model.error, actions: [signIn] }
      : undefined
  }
  const note = model.notes[name]
  if (note?.kind === 'copied') {
    // Copiée sur plusieurs lignes (`cd` du dossier d'abord) : la commande montrée, le tout au survol.
    const lines = note.text.split('\n')
    const tip = t('mcp.auth.copiedTip', { agent, name: presetName })
    return {
      tone: '',
      icon: Check,
      text: (
        <Trans
          t={t}
          i18nKey="mcp.auth.copied"
          values={{ command: lines.at(-1) ?? note.text }}
          components={{ code: <code /> }}
        />
      ),
      tip: lines.length > 1 ? `${tip}\n${note.text}` : tip,
      actions: [connect('retryHere', t('mcp.auth.retryHere'))]
    }
  }
  // Serveur désactivé : pas de connexion proposée (le main la refuse aussi), sauf l'état connecté.
  if (!server.enabled && state.status !== 'connected' && state.status !== 'connecting') {
    return { tone: '', icon: Info, text: t('mcp.auth.disabled'), actions: [] }
  }
  const line = lineOf(state, {
    agent,
    presetName,
    minutes,
    expected: preset?.pageHost ?? '',
    signIn,
    retry,
    terminal,
    reconnect: connect('reconnect', t('mcp.auth.reconnect')),
    reopen: {
      id: 'reopen',
      label: t('mcp.auth.reopen'),
      run: () => void model.reopen(name)
    },
    cancel: { id: 'cancel', label: t('common.cancel'), run: () => void model.cancel(name) },
    disconnect: {
      id: 'disconnect',
      label: t('mcp.auth.disconnect'),
      run: onAskDisconnect,
      expanded: asking
    }
  })
  // Refus ou échec d'une action (déconnexion non confirmée, connexion refusée) : dit à la place
  // du texte de l'état, avec les mêmes actions, tant que l'état ne change pas.
  return note?.kind === 'problem'
    ? { ...line, tone: 'err', icon: X, spin: false, text: note.text, tip: line.tip }
    : line
}

interface LineParts {
  agent: string
  presetName: string
  minutes: number
  expected: string
  signIn: Action
  retry: Action
  reconnect: Action
  reopen: Action
  cancel: Action
  disconnect: Action
  terminal: Action[]
}

/** Textes d'une ligne, hors composant : la même instance d'i18next qu'`useTranslation`. */
const tr = i18next.t.bind(i18next)

/** Au-delà, un hôte est raccourci par le début : deux lignes au plus dans des Réglages de 736 px. */
const HOST_SHOWN = 14

export function shortHost(host: string): string {
  return host.length <= HOST_SHOWN ? host : `…${host.slice(-(HOST_SHOWN - 1))}`
}

/** Hôte raccourci à l'écran ; en entier au survol et pour un lecteur d'écran. */
function HostName({ host }: { host: string }) {
  const short = shortHost(host)
  if (short === host) return <span className="mcp-auth-host">{host}</span>
  return (
    <span className="mcp-auth-host" title={host} data-testid="mcp-auth-host">
      <span aria-hidden="true">{short}</span>
      <span className="sr-only">{host}</span>
    </span>
  )
}

function errorTexts(
  state: McpAuthState,
  parts: Pick<LineParts, 'agent' | 'minutes' | 'expected'>
): { text: ReactNode; detail: string } {
  const { agent, minutes } = parts
  // TODO(R2) : le refus sur la page n'est pas relevé ; le main ne rend jamais `refused`
  // aujourd'hui. S'il arrivait, il est dit comme l'échec générique, sans inventer de texte.
  const reason = state.status === 'error' ? (state.reason ?? 'failed') : 'failed'
  switch (reason) {
    case 'timeout':
      return {
        text: tr('mcp.auth.reason.timeout', { minutes }),
        detail: tr('mcp.auth.reasonTip.timeout', { agent, minutes })
      }
    case 'unexpected-page':
      return {
        // Hôte refusé, donné par la sortie de l'agent : de longueur quelconque. Raccourci par le
        // début (la fin, le domaine, est ce qui se vérifie), en entier au survol et pour un
        // lecteur d'écran.
        text: (
          <Trans
            i18nKey="mcp.auth.reason.unexpectedPage"
            values={{ host: shortHost(state.host ?? '?') }}
            components={{ host: <HostName host={state.host ?? '?'} /> }}
          />
        ),
        detail: tr('mcp.auth.reasonTip.unexpectedPage', { expected: parts.expected })
      }
    case 'stopped':
      return {
        text: tr('mcp.auth.reason.stopped', { agent }),
        detail: tr('mcp.auth.reasonTip.stopped', { agent })
      }
    case 'failed':
      return {
        text: tr('mcp.auth.reason.failed'),
        detail: tr('mcp.auth.reasonTip.failed', { agent })
      }
  }
}

function lineOf(state: McpAuthState, parts: LineParts): Line {
  const { agent, minutes } = parts
  switch (state.status) {
    case 'to-connect':
      return {
        tone: '',
        icon: Info,
        text: tr('mcp.auth.toConnect'),
        tip: tr('mcp.auth.toConnectTip', { agent }),
        actions: [parts.signIn]
      }
    case 'connecting':
      return {
        tone: '',
        icon: LoaderCircle,
        spin: true,
        text: tr('mcp.auth.pending', { host: state.host ?? '' }),
        tip: tr('mcp.auth.pendingTip', { minutes }),
        actions: [parts.reopen, parts.cancel]
      }
    case 'connected':
      return {
        tone: 'ok',
        icon: Check,
        text: tr('mcp.auth.connected', { agent }),
        tip: tr('mcp.auth.connectedTip', { agent }),
        actions: [parts.disconnect]
      }
    case 'expired':
      return {
        tone: 'warn',
        icon: CircleAlert,
        text: tr('mcp.auth.expired'),
        tip: tr('mcp.auth.expiredTip', { agent }),
        actions: [parts.reconnect]
      }
    case 'refused':
    case 'error': {
      const { text, detail } = errorTexts(state, parts)
      return {
        tone: 'err',
        icon: X,
        text,
        tip: tr('mcp.auth.failedTip', { detail }),
        actions: [parts.retry, ...parts.terminal]
      }
    }
    case 'no-page':
      return {
        tone: '',
        icon: Info,
        text: tr('mcp.auth.noPage'),
        tip: tr('mcp.auth.noPageTip', { agent }),
        actions: [...parts.terminal, parts.retry]
      }
    case 'agent-missing':
      return { tone: '', icon: Info, text: tr('mcp.auth.agentMissing', { agent }), actions: [] }
    case 'unknown':
      return {
        tone: '',
        icon: Info,
        text: tr('mcp.auth.unknown'),
        tip: tr('mcp.auth.unknownTip', { agent }),
        actions: [parts.signIn]
      }
  }
}

/** Confirmation de « Se déconnecter », dans la ligne du serveur (fiche 126). */
export function McpAuthConfirm({
  view,
  server,
  model,
  onDone
}: {
  view: McpAgentView
  server: McpServerEntry
  model: McpAuthModel
  onDone: () => void
}) {
  const { t } = useTranslation()
  const preset = authPresetOf(server)
  return (
    <ConfirmRow
      message={t('mcp.auth.disconnectAsk', {
        name: preset ? t(`mcp.preset.${preset.id}.name`) : server.name,
        agent: view.label
      })}
      action={t('mcp.auth.disconnect')}
      onConfirm={() => {
        onDone()
        void model.disconnect(server.name)
      }}
      onCancel={onDone}
    />
  )
}

/** Préréglages dont l'adresse n'est déclarée nulle part chez cet agent (sous aucun nom). */
export function missingPresets(view: McpAgentView): McpPreset[] {
  if (!view.oauth) return []
  return MCP_PRESETS.filter(
    (preset) => !view.servers.some((s) => s.transport === 'http' && presetForUrl(s.url) === preset)
  )
}

/**
 * Ligne « <préréglage> » sous la liste (carte pleine, logo de 56 px, une phrase, « Connecter
 * <préréglage> ») tant que son adresse n'est déclarée nulle part. Agent absent : bouton grisé et sa
 * raison en clair dessous ; une connexion en cours : grisé, la raison au survol et au focus.
 */
export function McpPresetRows({
  view,
  model,
  onConnect
}: {
  view: McpAgentView
  model: McpAuthModel
  onConnect: (preset: McpPreset) => void
}) {
  const { t } = useTranslation()
  const presets = missingPresets(view)
  if (!presets.length) return null
  const agent = view.label
  const missing = model.agentFound === false ? t('mcp.auth.agentMissing', { agent }) : undefined
  return (
    <ul className="settings-list mcp-preset" data-testid="mcp-presets">
      {presets.map((preset) => {
        const name = t(`mcp.preset.${preset.id}.name`)
        return (
          <li key={preset.id} data-testid="mcp-preset" data-id={preset.id}>
            <span className="mcp-preset-icon">
              <PresetLogo preset={preset} size={56} />
            </span>
            <div className="mcp-preset-text">
              <div className="mcp-preset-name">{name}</div>
              <div className="mcp-preset-summary">
                {t(`mcp.preset.${preset.id}.summary`, { agent })}
              </div>
            </div>
            <ReasonButton
              className="btn small primary"
              reason={missing ?? (model.busy ? t('mcp.auth.busy') : undefined)}
              onClick={() => onConnect(preset)}
              data-testid="mcp-preset-connect"
            >
              {t('mcp.preset.connect', { name })}
            </ReasonButton>
            {missing && (
              <div className="mcp-preset-reason" data-testid="mcp-preset-reason">
                {missing}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Onglet d'un agent sans la capacité (fiche 293, Q3) : une ligne d'aide par préréglage, d'après les
 * profils (agents qui l'ont), jamais d'après un identifiant ; rien si aucun agent ne l'a.
 */
export function McpPresetHelp({ view, views }: { view: McpAgentView; views: McpAgentView[] }) {
  const { t } = useTranslation()
  if (view.oauth) return null
  const able = views.filter((v) => v.oauth).map((v) => v.label)
  if (!able.length) return null
  return (
    <>
      {MCP_PRESETS.map((preset) => {
        const name = t(`mcp.preset.${preset.id}.name`)
        return (
          <p
            key={preset.id}
            className="settings-row-hint mcp-preset-help"
            data-testid="mcp-preset-help"
            data-id={preset.id}
          >
            {t('mcp.preset.notOffered', {
              name,
              agent: view.label,
              agents: new Intl.ListFormat(currentLocale(), { type: 'disjunction' }).format(able)
            })}{' '}
            <button
              type="button"
              className="link"
              title={t('mcp.preset.listLinkTip', { name })}
              onClick={() => void window.api.mcp.openPresetList(preset.id)}
              data-testid="mcp-preset-list"
            >
              {t('mcp.preset.listLink', { name })}
              <ExternalLink size={11} aria-hidden="true" />
            </button>
          </p>
        )
      })}
    </>
  )
}
