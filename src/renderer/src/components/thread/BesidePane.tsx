import { X } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { AgentSnapshot, ConversationSummary } from '@shared/agent'
import type { TranscriptState } from '@shared/transcript'
import type { useConversations } from '../../useConversations'
import { ComposerInbox, useFileDrop } from '../../useFileDrop'
import { excludedIn } from '../../useAttachments'
import { DropOverlay } from '../composer/DropOverlay'
import { WorkingIndicator } from './WorkingIndicator'
import { Composer } from '../composer/Composer'
import { PinnedPlan } from './PinnedPlan'
import { pinnedPlanOf } from './PlanList'
import { Tip } from '../common/Menus'
import { Transcript } from './Transcript'
import { useTranslation } from 'react-i18next'

type Actions = ReturnType<ReturnType<typeof useConversations>['actionsFor']>

/**
 * Conversation ouverte à côté de l'active (fiche 036), comme la vue côte à côte de Claude Code
 * Desktop : son fil et sa zone de saisie ; son agent continue de travailler. Le panneau latéral,
 * l'agent et le dossier restent ceux de la conversation principale.
 */
export function BesidePane({
  summary,
  snapshot,
  transcript,
  actions,
  onWarn,
  onFocus,
  onClose,
  inert
}: {
  summary: ConversationSummary
  snapshot: AgentSnapshot | null
  transcript: TranscriptState
  actions: Actions
  onWarn: (message: string) => void
  /** En faire la conversation principale. */
  onFocus: () => void
  onClose: () => void
  /** Panneau de droite agrandi par-dessus (fiche 082) : hors d'atteinte du clavier. */
  inert?: boolean
}) {
  const { t } = useTranslation()
  const scroller = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [transcript.items])

  // Fichiers déposés sur cette conversation : joints à son message.
  const [composerInbox] = useState(() => new ComposerInbox())
  const drop = useFileDrop(composerInbox)
  const pinnedPlan = pinnedPlanOf(transcript.items, snapshot?.status === 'busy')
  return (
    <section
      className={`beside file-drop${drop.dragging ? ' dragging' : ''}`}
      {...drop.handlers}
      inert={inert}
      data-testid="beside"
      data-id={summary.id}
    >
      {drop.dragging && <DropOverlay />}
      <header className="beside-head drag">
        <button className="beside-title no-drag" onClick={onFocus} title={t('beside.makeMain')}>
          {summary.title}
        </button>
        <span className="beside-agent">{summary.profileLabel}</span>
        <Tip label={t('beside.close')}>
          <button
            className="icon-button small no-drag"
            aria-label={t('beside.close')}
            onClick={onClose}
            data-testid="beside-close"
          >
            <X size={15} />
          </button>
        </Tip>
      </header>
      <div
        className="scroll"
        ref={scroller}
        onScroll={() => {
          const el = scroller.current
          if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
        }}
      >
        <div className="column">
          <Transcript
            key={summary.id}
            items={transcript.items}
            terminals={transcript.terminals}
            onRespondPermission={actions.respondPermission}
            onRespondElicitation={actions.respondElicitation}
            {...(pinnedPlan ? { hiddenPlanId: pinnedPlan.id } : {})}
            workspace={summary.workspace}
            {...(snapshot
              ? {
                  agent: {
                    name: snapshot.info.agentName,
                    alwaysScope: snapshot.info.alwaysScope
                  }
                }
              : {})}
            streaming={snapshot?.status === 'busy'}
          />
          {snapshot?.status === 'busy' && (
            <WorkingIndicator
              key={summary.id}
              conversationId={summary.id}
              workspace={summary.workspace}
              items={transcript.items}
            />
          )}
        </div>
      </div>
      <div className="column" style={{ width: '100%' }}>
        {pinnedPlan && <PinnedPlan key={`tasks-${summary.id}`} entries={pinnedPlan.entries} />}
        <Composer
          key={summary.id}
          composerInbox={composerInbox}
          draftKey={summary.id}
          fresh={transcript.items.length === 0}
          snapshot={snapshot}
          settings={null}
          {...(transcript.usage ? { usage: transcript.usage } : {})}
          onSend={actions.send}
          onSearchFiles={actions.searchFiles}
          onPickFiles={actions.pickFiles}
          onCheckExcluded={excludedIn(summary.id)}
          onWarn={onWarn}
          onCancel={actions.cancel}
          onUnqueue={actions.unqueue}
          onSendNow={actions.sendNow}
          onAppCommand={() => onWarn(t('beside.appCommandsWarning'))}
          onRestart={actions.restart}
          onConfigure={() => {}}
          onChooseWorkspace={() => {}}
          onSetControl={actions.setControl}
          onAuthenticate={actions.authenticate}
          onRetry={actions.retrySession}
          onUseApiKey={actions.useApiKey}
          onRunStep={actions.runStep}
          onTrustForSession={actions.trustForSession}
          onOpenTerminal={actions.openTerminal}
          onContinueInNew={onFocus}
        />
      </div>
    </section>
  )
}
