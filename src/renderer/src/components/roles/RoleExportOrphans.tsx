import { Unlink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProfileSummary } from '@shared/agent'
import type { RoleExportStatus } from '@shared/role-export'
import { ipcErrorText } from '../../ipc-errors'
import { ConfirmRow } from '../settings/ConfirmRow'
import { roleExportErrorText, StatusRow } from './RoleExportStatus'

/**
 * « Installations sans rôle » (relecture de la phase 4, fiche 223) : un rôle renommé ou supprimé
 * laisse son mode ou son agent dans l'agent ; il reste visible ici et se retire, avec les mêmes
 * règles (confirmation s'il a été modifié à la main). `listing` : relu quand les rôles changent.
 */
export function RoleExportOrphans(props: {
  conversationId?: string | undefined
  profiles: readonly ProfileSummary[]
  listing: unknown
}) {
  const { t } = useTranslation()
  const [orphans, setOrphans] = useState<RoleExportStatus[]>([])
  const [revision, setRevision] = useState(0)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { conversationId, listing } = props
  useEffect(() => {
    let alive = true
    window.api.roles.exportOrphans(conversationId).then(
      (found) => alive && setOrphans(found),
      () => alive && setOrphans([])
    )
    return () => {
      alive = false
    }
  }, [conversationId, listing, revision])
  if (orphans.length === 0) return null
  const remove = async (status: RoleExportStatus) => {
    setConfirm(null)
    setError(null)
    try {
      const result = await window.api.roles.exportRemove(status.key, status.state === 'handEdited')
      if (!result.ok)
        setError(roleExportErrorText(result.error, status.format, status.profileLabel))
    } catch (e) {
      setError(ipcErrorText(e))
    }
    setRevision((n) => n + 1)
  }
  const label = (id: string) => props.profiles.find((p) => p.id === id)?.label ?? id
  return (
    <div className="roles-group" data-testid="roles-group-orphans">
      <h3 className="roles-group-head">
        <Unlink size={15} aria-hidden />
        <span>{t('roleExport.orphans.title')}</span>
      </h3>
      <p className="settings-row-hint role-export-orphans-hint">{t('roleExport.orphans.hint')}</p>
      <div className="role-export-rows">
        {orphans.map((status) => (
          <div key={status.key}>
            <StatusRow
              status={status}
              agent={label(status.profileId)}
              orphan
              onAct={() =>
                status.state === 'handEdited' ? setConfirm(status.key) : void remove(status)
              }
            />
            {confirm === status.key && (
              <ConfirmRow
                message={t('roleExport.status.removeConfirm', { id: status.id })}
                action={t('roleExport.status.remove')}
                onConfirm={() => void remove(status)}
                onCancel={() => setConfirm(null)}
              />
            )}
          </div>
        ))}
      </div>
      {error && (
        <p className="role-export-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
