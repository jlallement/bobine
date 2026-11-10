import { RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { OrphanWorktree } from '@shared/worktree-cycle'
import { ipcErrorText } from '../../ipc-errors'
import { ConfirmRow, useConfirm } from './ConfirmRow'

/**
 * Réglages › Données › Worktrees orphelins (fiches 110, 136) : les worktrees de Bobine dont
 * la conversation a été supprimée sans eux, avec « Nettoyer » (dossier et branche supprimés),
 * confirmé dans la ligne (fiche 126) : c'est une suppression, avec ce qu'ils contiennent.
 */
export function OrphanWorktrees() {
  const { t } = useTranslation()
  const [orphans, setOrphans] = useState<OrphanWorktree[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const confirm = useConfirm()
  const load = (promise: Promise<OrphanWorktree[]>) =>
    promise
      .then((found) => {
        setOrphans(found)
        setError(null)
      })
      .catch((e: unknown) => setError(ipcErrorText(e)))
      .finally(() => setBusy(null))
  useEffect(() => {
    void load(window.api.worktree.orphans())
  }, [])
  const detail = (orphan: OrphanWorktree) =>
    [
      orphan.dirty > 0 && t('settings.data.orphans.detail_dirty', { count: orphan.dirty }),
      orphan.ahead > 0 && t('settings.data.orphans.detail_ahead', { count: orphan.ahead })
    ]
      .filter(Boolean)
      .join(' · ')
  return (
    <>
      <h3 className="settings-h3 settings-heading-row">
        {t('settings.data.orphans.label')}
        <button
          className="icon-button small"
          aria-label={t('settings.data.orphans.refresh')}
          title={t('settings.data.orphans.refresh')}
          disabled={busy !== null}
          onClick={() => {
            setBusy('refresh')
            void load(window.api.worktree.orphans())
          }}
          data-testid="orphans-refresh"
        >
          <RefreshCw size={13} />
        </button>
      </h3>
      <p className="settings-row-hint">{t('settings.data.orphans.hint')}</p>
      {error && <p className="settings-row-hint confirm-warning">{error}</p>}
      {orphans && orphans.length === 0 ? (
        <ul className="settings-list">
          <li className="settings-list-empty" data-testid="orphans-none">
            {t('settings.data.orphans.none')}
          </li>
        </ul>
      ) : (
        <ul className="settings-list" data-testid="orphans">
          {(orphans ?? []).map((orphan) => (
            <li key={orphan.path}>
              <span className="settings-list-main" title={orphan.path}>
                <span className="mono">{orphan.branch || orphan.path}</span>
                {detail(orphan) && <span className="settings-row-hint"> · {detail(orphan)}</span>}
              </span>
              <button
                className="btn small"
                disabled={busy !== null}
                aria-label={t('settings.data.orphans.cleanLabel', { path: orphan.path })}
                aria-expanded={confirm.asking === orphan.path}
                onClick={() => confirm.ask(orphan.path)}
                data-testid="orphans-clean"
              >
                <Trash2 size={13} />
                {t('settings.data.orphans.clean')}
              </button>
              {confirm.asking === orphan.path && (
                <ConfirmRow
                  message={
                    detail(orphan)
                      ? t('settings.data.orphans.cleanAskLosing', {
                          branch: orphan.branch || orphan.path,
                          detail: detail(orphan)
                        })
                      : t('settings.data.orphans.cleanAsk', {
                          branch: orphan.branch || orphan.path
                        })
                  }
                  action={t('settings.data.orphans.clean')}
                  onConfirm={() => {
                    confirm.done()
                    setBusy(orphan.path)
                    void load(window.api.worktree.removeOrphan(orphan))
                  }}
                  onCancel={confirm.done}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
