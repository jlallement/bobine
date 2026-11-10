import { FileDiff } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { changesSummary, conversationChanges } from '@shared/changes'
import { countText } from '@shared/i18n/format'
import type { TranscriptItem } from '@shared/transcript'
import { Tip } from '../common/Menus'

type Summary = ReturnType<typeof changesSummary>

/**
 * « Modifications » de l'onglet Session (fiche 207, proposition A validée) : deux lignes qui ne se
 * confondent plus — ce que la conversation a modifié (comme Modifications › Conversation), et ce
 * qui n'est pas commité dans le dossier (comme Modifications › Git), laissé ou non par elle.
 * `folder` : `undefined` hors dépôt git (ou pas encore lu) : pas de ligne « Dossier ».
 */
export function SessionChanges(props: {
  items: readonly TranscriptItem[]
  folder: Summary | undefined
  onOpenConversation: () => void
  onOpenGit: () => void
}) {
  const { t } = useTranslation()
  const { items } = props
  const conversation = useMemo(() => changesSummary(conversationChanges(items)), [items])
  return (
    <section className="session-section" data-testid="session-changes">
      <h3 className="session-title">{t('sessionTab.changes')}</h3>
      <ChangesRow
        label={t('sessionTab.changesConversation')}
        summary={conversation}
        text={t('sessionTab.changesFiles', { count: conversation.files })}
        tip={t('sessionTab.changesConversationTip')}
        onOpen={props.onOpenConversation}
        testId="session-changes-conversation"
      />
      {props.folder && (
        <ChangesRow
          label={t('sessionTab.changesFolder')}
          summary={props.folder}
          text={t('sessionTab.changesUncommitted', { count: props.folder.files })}
          tip={t('sessionTab.changesTip')}
          onOpen={props.onOpenGit}
          testId="session-changes-line"
        />
      )}
    </section>
  )
}

function ChangesRow(props: {
  label: string
  summary: Summary
  text: string
  tip: string
  onOpen: () => void
  testId: string
}) {
  const { t } = useTranslation()
  const { summary } = props
  return (
    <div className="session-row">
      <span className="session-row-label">{props.label}</span>
      <span className="session-row-value">
        {summary.files === 0 ? (
          <span className="session-value session-none" data-testid={props.testId}>
            {t('sessionTab.changesNone')}
          </span>
        ) : (
          <Tip label={props.tip}>
            <button
              type="button"
              className="session-link session-changes"
              onClick={props.onOpen}
              data-testid={props.testId}
            >
              <FileDiff size={13} />
              {props.text}
              <span className="diff-added">+{countText(summary.added)}</span>
              <span className="diff-removed">−{countText(summary.removed)}</span>
            </button>
          </Tip>
        )}
      </span>
    </div>
  )
}
