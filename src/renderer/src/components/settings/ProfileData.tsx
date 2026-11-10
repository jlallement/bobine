import { Trash2, Undo2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BackupCheck, TrashEntry } from '@shared/profile'
import { ipcErrorText } from '../../ipc-errors'
import { ConfirmRow, useConfirm } from './ConfirmRow'
import { Row, SettingsTitle } from './rows'

const DAY_MS = 24 * 60 * 60 * 1000

const longDate = (iso: string, language: string) =>
  new Date(iso).toLocaleString(language, { dateStyle: 'long', timeStyle: 'short' })

/**
 * Réglages › Données › « Restaurer une sauvegarde » (fiche 197) : choix du dossier, puis une
 * confirmation dans la carte qui dit ce qui sera remplacé et que l'état actuel est gardé à côté ;
 * jamais sans elle. Bobine redémarre pour la faire.
 */
export function RestoreRow({ readOnly }: { readOnly: boolean }) {
  const { t, i18n } = useTranslation()
  const [check, setCheck] = useState<BackupCheck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const choose = () => {
    setError(null)
    window.api.profile
      .chooseBackup()
      .then(setCheck)
      .catch((e: unknown) => setError(ipcErrorText(e)))
  }
  const restore = (folder: string) => {
    setError(null)
    window.api.profile.restoreBackup(folder).catch((e: unknown) => setError(ipcErrorText(e)))
  }
  return (
    <>
      <Row label={t('settings.data.restore.label')} hint={t('settings.data.restore.hint')}>
        <button
          className="btn small"
          onClick={choose}
          disabled={readOnly}
          data-testid="settings-restore"
        >
          {t('settings.data.restore.action')}
        </button>
      </Row>
      {check && !check.ok && (
        <div className="settings-note" data-testid="settings-restore-refused">
          {t(`settings.data.restore.${check.reason}`)}
        </div>
      )}
      {check?.ok && (
        <div
          className="restore-confirm"
          role="group"
          aria-label={t('settings.data.restore.label')}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            // Échap referme la confirmation, pas la fenêtre des réglages.
            event.stopPropagation()
            setCheck(null)
          }}
          data-testid="settings-restore-confirm"
        >
          <p className="restore-confirm-title">
            {t('settings.data.restore.confirmTitle', {
              date: longDate(check.createdAt, i18n.language),
              count: check.conversations
            })}
          </p>
          <p className="restore-confirm-text">
            {t('settings.data.restore.confirmText', { count: check.currentConversations })}
          </p>
          <p className="restore-confirm-text">{t('settings.data.restore.keys')}</p>
          <div className="restore-confirm-actions">
            <button className="btn small ghost" autoFocus onClick={() => setCheck(null)}>
              {t('common.cancel')}
            </button>
            <button
              className="btn small primary"
              onClick={() => restore(check.folder)}
              data-testid="settings-restore-go"
            >
              {t('settings.data.restore.confirm')}
            </button>
          </div>
        </div>
      )}
      {error && <div className="settings-note confirm-warning">{error}</div>}
    </>
  )
}

/**
 * Corbeille des conversations (fiche 196) : chaque ligne dit quand elle sera effacée, se restaure,
 * ou s'efface tout de suite (confirmé dans la ligne). Pas de « Vider » : une action à la fois.
 */
export function TrashList({ readOnly }: { readOnly: boolean }) {
  const { t, i18n } = useTranslation()
  const [entries, setEntries] = useState<TrashEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()
  // Heure de l'ouverture de la page : les jours restants ne bougent pas pendant qu'on lit.
  const [now] = useState(() => Date.now())
  const load = (promise: Promise<TrashEntry[]>) =>
    promise.then(setEntries, (e: unknown) => setError(ipcErrorText(e)))
  useEffect(() => {
    void load(window.api.profile.trash())
  }, [])
  const erasedIn = (entry: TrashEntry) => {
    const days = Math.ceil((Date.parse(entry.erasedAt) - now) / DAY_MS)
    return days <= 0
      ? t('settings.data.trash.erasedToday')
      : t('settings.data.trash.erasedIn', { count: days })
  }
  const deletedOn = (entry: TrashEntry) =>
    t('settings.data.trash.deletedOn', {
      date: new Date(entry.deletedAt).toLocaleDateString(i18n.language, {
        day: 'numeric',
        month: 'long'
      })
    })
  const folder = (entry: TrashEntry) =>
    entry.workspace.split('/').filter(Boolean).at(-1) ?? t('settings.data.trash.noFolder')
  return (
    <>
      <SettingsTitle help="settingsTrash">{t('settings.data.trash.title')}</SettingsTitle>
      <p className="settings-row-hint">{t('settings.data.trash.hint')}</p>
      {error && <p className="settings-row-hint confirm-warning">{error}</p>}
      <ul className="settings-list trash-list" data-testid="trash">
        {entries?.length === 0 && (
          <li className="settings-list-empty" data-testid="trash-empty">
            {t('settings.data.trash.empty')}
          </li>
        )}
        {(entries ?? []).map((entry) => (
          <li key={entry.id} data-testid="trash-item">
            <span className="settings-list-main trash-item-main">
              <span className="trash-item-title" title={entry.title}>
                {entry.title}
              </span>
              <span className="settings-row-hint">
                {[folder(entry), deletedOn(entry), erasedIn(entry)].join(' · ')}
              </span>
            </span>
            <button
              className="btn small"
              disabled={readOnly}
              onClick={() => void load(window.api.profile.restoreFromTrash(entry.id))}
              data-testid="trash-restore"
            >
              <Undo2 size={13} />
              {t('settings.data.trash.restore')}
            </button>
            <button
              className="icon-button small"
              disabled={readOnly}
              aria-label={t('settings.data.trash.erase')}
              title={t('settings.data.trash.erase')}
              aria-expanded={confirm.asking === entry.id}
              onClick={() => confirm.ask(entry.id)}
              data-testid="trash-erase"
            >
              <Trash2 size={13} />
            </button>
            {confirm.asking === entry.id && (
              <ConfirmRow
                message={t('settings.data.trash.eraseConfirm')}
                action={t('settings.data.trash.eraseAction')}
                onConfirm={() => {
                  confirm.done()
                  void load(window.api.profile.eraseFromTrash(entry.id))
                }}
                onCancel={confirm.done}
              />
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
