import { GitBranch, TriangleExclamationPoint } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { currentLocale } from '@shared/i18n/format'
import type { TranscriptItem } from '@shared/transcript'
import { shortHash } from '@shared/worktree-cycle'

/**
 * Départ d'un worktree en tête de son fil (fiches 110, 117) : une carte alignée à gauche, de quelle
 * branche et de quel commit il part, le sujet du commit, et les modifications non commitées du
 * dossier d'origine qui ne sont pas ici. « Vue Git » ouvre l'onglet Modifications.
 */
export function WorktreeStart({
  item,
  onOpenGit
}: {
  item: Extract<TranscriptItem, { kind: 'worktree-start' }>
  onOpenGit?: (() => void) | undefined
}) {
  const { t } = useTranslation()
  const date = item.date ? new Date(item.date) : undefined
  const when =
    date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat(currentLocale(), {
          dateStyle: 'medium',
          timeStyle: 'short'
        }).format(date)
      : undefined
  return (
    <div className="worktree-origin" data-testid="worktree-origin">
      <div className="worktree-origin-line">
        <GitBranch size={14} className="worktree-origin-icon" />
        <span className="worktree-origin-from" data-testid="worktree-origin-from">
          <Trans
            t={t}
            i18nKey={item.branch ? 'worktrees.start.from' : 'worktrees.start.fromDetached'}
            values={{ branch: item.branch ?? '', hash: shortHash(item.commit) }}
            components={{ code: <code /> }}
          />
          {when && <span className="worktree-origin-date"> · {when}</span>}
        </span>
        {onOpenGit && (
          <button
            className="link-button worktree-origin-git"
            title={t('worktrees.start.gitViewTitle')}
            onClick={onOpenGit}
            data-testid="worktree-origin-git"
          >
            {t('worktrees.start.gitView')}
          </button>
        )}
      </div>
      {item.subject && (
        <div className="worktree-origin-subject" data-testid="worktree-origin-subject">
          {t('worktrees.start.subject', { subject: item.subject })}
        </div>
      )}
      {item.dirty ? (
        <div className="worktree-origin-dirty" data-testid="worktree-origin-dirty">
          <TriangleExclamationPoint size={14} />
          <span>{t('worktrees.start.dirty', { count: item.dirty })}</span>
        </div>
      ) : null}
    </div>
  )
}
