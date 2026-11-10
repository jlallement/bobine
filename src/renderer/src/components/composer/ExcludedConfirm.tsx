import { useTranslation } from 'react-i18next'
import { basename } from '@shared/attachments'
import type { PendingExclusion } from '../../useAttachments'

/**
 * Fichiers à joindre que l'agent exclut (`.bobignore`…, fiche 155) : Bobine les mettrait dans le
 * message alors que l'agent ne les ouvrirait pas lui-même. On demande avant.
 */
export function ExcludedConfirm(props: {
  pending: PendingExclusion
  agentLabel: string
  onResolve: (attach: boolean) => void
}) {
  const { t } = useTranslation()
  const { paths, files } = props.pending
  const names = paths.map(basename).join(', ')
  const values = { names, files: files.join(', '), agent: props.agentLabel, count: paths.length }
  return (
    <div
      className="capture-problem composer-capture-problem excluded-confirm"
      role="alert"
      data-testid="excluded-confirm"
    >
      <span className="capture-problem-text">
        {files.length === 0
          ? t('composer.excluded.unchecked', values)
          : paths.length === 1
            ? t('composer.excluded.one', values)
            : t('composer.excluded.many', values)}
      </span>
      <button
        type="button"
        className="link-button"
        onClick={() => props.onResolve(true)}
        data-testid="excluded-attach"
      >
        {t('composer.excluded.attach')}
      </button>
      <button
        type="button"
        className="link-button"
        onClick={() => props.onResolve(false)}
        data-testid="excluded-skip"
      >
        {t('composer.excluded.skip')}
      </button>
    </div>
  )
}
