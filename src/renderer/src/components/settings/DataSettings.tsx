import { X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { pathParts } from '@shared/presentation'
import { ipcErrorText } from '../../ipc-errors'
import { FreshStartCard } from './FreshStart'
import { OrphanWorktrees } from './OrphanWorktrees'
import { RestoreRow, TrashList } from './ProfileData'
import { useProfileStatus } from '../common/Profile'
import { ResetCard } from './UsageReset'
import { Row, SettingsCard, SettingsTitle } from './rows'

/**
 * Réglages › Données (fiche 136) : la sauvegarde du profil et sa restauration (fiche 197), la
 * corbeille des conversations (fiche 196), les dossiers récents à oublier,
 * les worktrees orphelins à nettoyer, la remise à zéro de la consommation (fiche 144), et
 * « Recommencer à neuf » (fiche 148).
 */
export function DataSettings({
  recentWorkspaces,
  onBackupHistory,
  onForgetWorkspace
}: {
  recentWorkspaces: readonly string[]
  onBackupHistory: () => Promise<string | null>
  onForgetWorkspace: (workspace: string) => void
}) {
  const { t } = useTranslation()
  const { readOnly } = useProfileStatus()
  return (
    <section>
      <SettingsTitle help="settingsData">{t('settings.data.backupTitle')}</SettingsTitle>
      <SettingsCard>
        <BackupRow onBackup={onBackupHistory} />
        <RestoreRow readOnly={readOnly} />
      </SettingsCard>
      <TrashList readOnly={readOnly} />
      <SettingsTitle>{t('settings.data.recentFolders.label')}</SettingsTitle>
      <ul className="settings-list" data-testid="settings-recents">
        {recentWorkspaces.length === 0 ? (
          <li className="settings-list-empty">{t('settings.data.recentFolders.none')}</li>
        ) : (
          recentWorkspaces.map((w) => (
            <li key={w}>
              <MiddlePath path={w} />
              <button
                className="icon-button small"
                aria-label={t('settings.data.recentFolders.forget', { folder: w })}
                onClick={() => onForgetWorkspace(w)}
              >
                <X size={13} />
              </button>
            </li>
          ))
        )}
      </ul>
      <OrphanWorktrees />
      <ResetCard />
      <FreshStartCard />
    </section>
  )
}

/** Sauvegarde de l'historique (fiche 043) : copie datée dans un dossier choisi. */
function BackupRow({ onBackup }: { onBackup: () => Promise<string | null> }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const backup = () => {
    setBusy(true)
    setNote(null)
    onBackup()
      .then((folder) => setNote(folder ? t('settings.data.backup.done', { folder }) : null))
      .catch((e: unknown) => setNote(ipcErrorText(e)))
      .finally(() => setBusy(false))
  }
  return (
    <>
      <Row label={t('settings.data.backup.label')} hint={t('settings.data.backup.hint')}>
        <button
          className="btn small"
          onClick={backup}
          disabled={busy}
          data-testid="settings-backup"
        >
          {busy ? t('settings.data.backup.running') : t('settings.data.backup.action')}
        </button>
      </Row>
      {note && (
        <div className="settings-note" data-testid="settings-backup-note">
          {note}
        </div>
      )}
    </>
  )
}

/**
 * Chemin coupé au milieu (recette 0.11, C2) : le début cède sa place (« … »), le nom du dossier
 * reste entier ; le chemin complet en infobulle.
 */
function MiddlePath({ path }: { path: string }) {
  const { dir, name } = pathParts(path)
  return (
    <span className="settings-list-main mono middle-path" title={path} data-testid="middle-path">
      {dir && <span className="middle-path-dir">{dir}</span>}
      <span className="middle-path-name">{name}</span>
    </span>
  )
}
