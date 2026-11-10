import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ipcErrorText } from '../../ipc-errors'
import { ConfirmRow } from './ConfirmRow'
import { Row, SettingsCard, SettingsTitle } from './rows'

/**
 * « Historique » : « Remettre à zéro… » efface le journal de consommation de Bobine, après une
 * confirmation dans la ligne (fiche 126). Le quota des agents, tenu par leur serveur, n'est pas
 * concerné ; la collecte continue. Dans Réglages › Données depuis la fiche 144.
 */
export function ResetCard({ onReset }: { onReset?: () => void }) {
  const { t } = useTranslation()
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const reset = () => {
    setAsking(false)
    window.api.usage
      .reset()
      .then(() => {
        setNote(t('usage.board.reset.done'))
        onReset?.()
      })
      .catch((e: unknown) => setNote(ipcErrorText(e)))
  }
  return (
    <>
      <SettingsTitle>{t('usage.board.reset.title')}</SettingsTitle>
      <SettingsCard testId="usage-reset-card">
        <Row label={t('usage.board.reset.label')} hint={t('usage.board.reset.hint')}>
          <button
            className="btn small danger"
            onClick={() => {
              setNote(null)
              setAsking((a) => !a)
            }}
            data-testid="usage-reset"
          >
            {t('usage.board.reset.action')}
          </button>
        </Row>
        {asking && (
          <ConfirmRow
            message={t('usage.board.reset.confirm')}
            action={t('usage.board.reset.confirmAction')}
            onConfirm={reset}
            onCancel={() => setAsking(false)}
          />
        )}
        {note && (
          <div className="settings-note" data-testid="usage-reset-note">
            {note}
          </div>
        )}
      </SettingsCard>
    </>
  )
}
