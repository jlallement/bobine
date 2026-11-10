import { ArrowUp, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RuleFileView } from '@shared/rules'
import type { ConversationAppTools, McpAgentView } from '@shared/mcp'
import type {
  AgentConfigureRequest,
  AgentSettingsView,
  AgentStatus,
  ControlValue,
  SessionControl
} from '@shared/agent'
import type { ConversationUsage } from '@shared/usage'
import type { UsageActions } from '../../useTurnGuards'
import { ComposerFocus, ModeChip, SessionSettingsMenu, Tip } from '../common/Menus'
import { AgentMenu } from './AgentMenu'
import { ModelChip } from '../common/ModelMenu'
import { ChipPlaceholder, useRememberChipWidths, useReservedWidths } from './chip-slots'
import { AttachButton } from './AttachButton'
import { UsageMeter } from './UsageMeter'
import { useBarFold } from './useBarFold'

interface Props {
  settings: AgentSettingsView | null
  /** Profil de l'agent de la conversation, connu dès le premier instant (puces réservées, F11). */
  profileId: string | undefined
  /** Pas encore d'état de l'agent (conversation qui s'ouvre). */
  pending: boolean
  status: AgentStatus
  /** Action requise par l'agent : pièces jointes et capture désactivées. */
  blocked: boolean
  /** Réponse ou démarrage en cours : pas d'agent à changer. */
  locked: boolean
  canSend: boolean
  /** Texte ou pièces jointes : le bouton d'envoi reste pendant une réponse (file d'attente). */
  hasContent: boolean
  controls: SessionControl[]
  modeControl: SessionControl | undefined
  modelControl: SessionControl | undefined
  agentLabel: string
  usage: ConversationUsage | undefined
  /** Compaction en un clic, plafond de coût (fiche 157). */
  usageActions?: UsageActions
  conversationId: string | undefined
  /** Conversation encore vide : rien à transmettre, pas de « Continuer avec » (fiche 108). */
  fresh: boolean
  onPickFiles: () => void
  /** Capture d'une zone de l'écran (fiche 062), si l'app la propose. */
  onCaptureScreen: (() => void) | undefined
  onCancel: () => void
  onConfigure: (request: AgentConfigureRequest) => void
  /** Rend le focus à la zone de saisie, après un choix dans un menu de la barre (fiche 092). */
  onFocusInput: () => void
  onSetControl: (id: string, value: ControlValue) => void
  onLoadRules: (() => Promise<RuleFileView[]>) | undefined
  onOpenRule: ((rule: RuleFileView) => void) | undefined
  onLoadMcp: (() => Promise<McpAgentView | undefined>) | undefined
  onLoadAppTools: (() => Promise<ConversationAppTools>) | undefined
  onOpenMcpSettings: ((tab?: string) => void) | undefined
  /** Réglages › Consommation (fiche 137), depuis le détail de la puce de consommation. */
  onOpenUsage: (() => void) | undefined
  onRestart: () => void
}

/**
 * Barre sous la zone de saisie (sortie de `Composer`, fiche 089) : joindre, capturer, mode,
 * réglages de la session, consommation, modèle, agent, puis arrêter ou envoyer. Le dossier et la
 * branche sont sous la zone de saisie (`ComposerContext`) ; faute de place, la barre se replie une
 * étape après l'autre (`useBarFold`, fiche 092).
 */
export function ComposerBar(props: Props) {
  const { t } = useTranslation()
  const { settings, status, agentLabel } = props
  const busy = status === 'busy'
  const [bar, fold] = useBarFold()
  // Agent qui démarre (ou pas encore d'état) : la place de ses puces est gardée (fiche 185, F11).
  const reserved = useReservedWidths(props.profileId, props.pending || status === 'starting')
  useRememberChipWidths(
    bar,
    props.profileId,
    status === 'ready',
    `${String(props.modeControl?.currentValue)}|${String(props.modelControl?.currentValue)}`
  )
  return (
    <ComposerFocus.Provider value={props.onFocusInput}>
      <div className="composer-bar" ref={bar} data-fold={fold} data-testid="composer-bar">
        <AttachButton
          folded={fold >= 1}
          disabled={props.blocked}
          onPickFiles={props.onPickFiles}
          onCaptureScreen={props.onCaptureScreen}
        />
        {props.modeControl ? (
          <ModeChip
            control={props.modeControl}
            disabled={status !== 'ready'}
            onSetControl={props.onSetControl}
          />
        ) : (
          <ChipPlaceholder width={reserved.mode} />
        )}
        <SessionSettingsMenu
          controls={props.controls}
          agentLabel={agentLabel}
          disabled={status !== 'ready'}
          onSetControl={props.onSetControl}
          {...(props.onLoadRules ? { onLoadRules: props.onLoadRules } : {})}
          {...(props.onOpenRule ? { onOpenRule: props.onOpenRule } : {})}
          {...(props.onLoadMcp ? { onLoadMcp: props.onLoadMcp } : {})}
          {...(props.onLoadAppTools ? { onLoadAppTools: props.onLoadAppTools } : {})}
          {...(props.onOpenMcpSettings ? { onOpenMcpSettings: props.onOpenMcpSettings } : {})}
          onRestartAgent={props.onRestart}
        />
        <span className="grow" />
        {/* D'un tenant : sur deux lignes (niveau 4), ce bloc forme la seconde. */}
        <div className="composer-bar-end">
          <UsageMeter
            usage={props.usage}
            agentLabel={agentLabel}
            compact={fold >= 2}
            {...(props.usageActions ? { actions: props.usageActions } : {})}
            {...(props.onOpenUsage ? { onOpenUsage: props.onOpenUsage } : {})}
          />
          {props.modelControl ? (
            <ModelChip
              control={props.modelControl}
              disabled={status !== 'ready'}
              onSetControl={props.onSetControl}
            />
          ) : (
            <ChipPlaceholder width={reserved.model} />
          )}
          {settings && (
            <AgentMenu
              settings={settings}
              label={agentLabel}
              disabled={props.locked}
              {...(props.conversationId && !props.fresh
                ? { conversationId: props.conversationId }
                : {})}
              onConfigure={props.onConfigure}
            />
          )}
          {busy && (
            <Tip label={t('composer.stop')} command="stop">
              <button
                type="button"
                className="send-button stop"
                // Nom accessible : l'icône seule n'en donne pas (computer use, fiche 206).
                aria-label={t('shortcuts.menu.stop')}
                onClick={props.onCancel}
                data-testid="stop"
              >
                <Square size={13} fill="currentColor" />
              </button>
            </Tip>
          )}
          {(!busy || props.hasContent) && (
            <Tip label={busy ? t('composer.send.queued') : t('composer.send.now')}>
              <button
                type="submit"
                className="send-button"
                disabled={!props.canSend}
                data-testid="send"
              >
                <ArrowUp size={18} strokeWidth={2.4} />
              </button>
            </Tip>
          )}
        </div>
      </div>
    </ComposerFocus.Provider>
  )
}
