import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { AlertTriangle, Bot, Check, ChevronDown, Download, Info, RefreshCw } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'
import type { ProfileSummary } from '@shared/agent'
import type {
  RoleExportError,
  RoleExportFormat,
  RoleExportRef,
  RoleExportStatus
} from '@shared/role-export'
import { ipcErrorText } from '../../ipc-errors'
import { ConfirmRow } from '../settings/ConfirmRow'
import { RoleExportSheet } from './RoleExportSheet'

/** Message d'un refus (rien n'a été changé), dans la langue de l'interface. */
export function roleExportErrorText(
  error: RoleExportError,
  format: RoleExportFormat | undefined,
  agent: string
): string {
  const params = {
    agent,
    id: error.detail ?? '',
    file: error.file ?? '',
    detail: error.detail ?? ''
  }
  if (error.code === 'foreign' && format) {
    return i18next.t(`roleExport.format.${format}.foreign`, params)
  }
  if (error.code === 'foreign') return i18next.t('roleExport.error.handEdited', params)
  return i18next.t(`roleExport.error.${error.code}`, params)
}

/** Refus montré, pour la version du rôle où il est arrivé (`saved`) : un rôle réenregistré l'efface. */
type Shown = {
  error: RoleExportError
  format?: RoleExportFormat
  agent: string
  saved: string
} | null

/**
 * « Installer dans… » sur la page d'un rôle (fiche 223, phase 4, maquettes 05-1 et 05-4) : le
 * bouton et son menu (agents installés dont le profil déclare `roleExport` ; aucun : pas de
 * bouton), la feuille, et les lignes d'état des installations de ce rôle (à jour, rôle changé,
 * modifié à la main, retiré du fichier) avec « Mettre à jour » et « Retirer ». Rend `button` et
 * `panel`, placés par la page.
 */
export function useRoleExport(props: {
  role: RoleExportRef & { icon: string; color: string }
  profiles: readonly ProfileSummary[]
  /** Modifications non enregistrées : le fichier du rôle n'est pas encore ce qui serait écrit. */
  dirty: boolean
  /** Empreinte du rôle enregistré : quand elle change, un refus montré n'est plus d'actualité. */
  saved: string
}): { button: ReactNode; panel: ReactNode; installed: number } {
  const { t } = useTranslation()
  const targets = props.profiles.filter((p) => p.roleExport && p.available)
  const [statuses, setStatuses] = useState<RoleExportStatus[]>([])
  const [sheet, setSheet] = useState<string | null>(null)
  const [shown, setShown] = useState<Shown>(null)
  const [confirm, setConfirm] = useState<{ key: string; action: 'replace' | 'remove' } | null>(null)
  const { scope, name, conversationId } = props.role
  const ref: RoleExportRef = { scope, name, ...(conversationId ? { conversationId } : {}) }
  // Relu à l'ouverture de la page, après un enregistrement (le rôle a pu changer) et après une action.
  const [revision, setRevision] = useState(0)
  const refresh = () => setRevision((n) => n + 1)
  const { dirty } = props
  useEffect(() => {
    let alive = true
    const target = { scope, name, ...(conversationId ? { conversationId } : {}) }
    window.api.roles.exportStatus(target).then(
      (found) => alive && setStatuses(found),
      () => alive && setStatuses([])
    )
    return () => {
      alive = false
    }
  }, [scope, name, conversationId, revision, dirty])

  const labelOf = (profileId: string) =>
    props.profiles.find((p) => p.id === profileId)?.label ?? profileId
  const act = async (status: RoleExportStatus, action: 'update' | 'replace' | 'remove') => {
    setConfirm(null)
    setShown(null)
    const failed = (error: RoleExportError) =>
      setShown({ error, format: status.format, agent: status.profileLabel, saved: props.saved })
    try {
      if (action === 'remove') {
        const result = await window.api.roles.exportRemove(
          status.key,
          status.state === 'handEdited'
        )
        if (!result.ok) failed(result.error)
      } else {
        const result = await window.api.roles.export(
          ref,
          { profileId: status.profileId, scope: status.scope },
          { useInBobine: status.useInBobine, ...(action === 'replace' ? { overwrite: true } : {}) }
        )
        if (!result.ok) failed(result.error)
      }
    } catch (e) {
      failed({ code: 'writeFailed', detail: ipcErrorText(e) })
    }
    refresh()
  }

  const button =
    targets.length === 0 ? null : (
      <Dropdown.Root modal={false}>
        <Dropdown.Trigger asChild disabled={props.dirty}>
          <button
            className="btn small"
            title={props.dirty ? t('roleExport.saveFirst') : undefined}
            data-testid="role-export-button"
          >
            <Download size={13} aria-hidden />
            {t('roleExport.button')}
            <ChevronDown size={13} aria-hidden />
          </button>
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content
            className="menu role-export-menu"
            align="end"
            sideOffset={6}
            collisionPadding={12}
            data-testid="role-export-menu"
          >
            {targets.map((p) => (
              <Dropdown.Item
                key={p.id}
                className="menu-item"
                onSelect={() => {
                  setShown(null)
                  setSheet(p.id)
                }}
                data-testid={`role-export-target-${p.id}`}
              >
                <Bot size={16} className="menu-icon" aria-hidden />
                <span className="menu-text">
                  <span className="menu-title">{p.label}</span>
                  {p.roleExport && (
                    <span className="menu-desc">{t(`roleExport.format.${p.roleExport}.menu`)}</span>
                  )}
                </span>
              </Dropdown.Item>
            ))}
            <Dropdown.Separator className="menu-separator" />
            <div className="menu-item role-export-menu-hint" aria-disabled>
              <Info size={16} className="menu-icon" aria-hidden />
              <span className="menu-desc">{t('roleExport.menuHint')}</span>
            </div>
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
    )

  const panel = (
    <>
      {statuses.length > 0 && (
        <div className="role-export-rows" data-testid="role-export-rows">
          {statuses.map((status) => (
            <div key={status.key}>
              <StatusRow
                status={status}
                agent={labelOf(status.profileId)}
                onAct={(action) =>
                  action !== 'update' && status.state === 'handEdited'
                    ? setConfirm({ key: status.key, action })
                    : void act(status, action)
                }
              />
              {confirm?.key === status.key && (
                <ConfirmRow
                  message={t(
                    confirm.action === 'replace'
                      ? 'roleExport.status.replaceConfirm'
                      : 'roleExport.status.removeConfirm',
                    { id: status.id }
                  )}
                  action={t(
                    confirm.action === 'replace'
                      ? 'roleExport.status.replace'
                      : 'roleExport.status.remove'
                  )}
                  onConfirm={() => void act(status, confirm.action)}
                  onCancel={() => setConfirm(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
      {shown && shown.saved === props.saved && (
        <p className="role-export-error" role="alert" data-testid="role-export-error">
          <Info size={15} aria-hidden />
          <span>{roleExportErrorText(shown.error, shown.format, shown.agent)}</span>
        </p>
      )}
      {sheet && (
        <RoleExportSheet
          role={props.role}
          profileId={sheet}
          onClose={() => setSheet(null)}
          onDone={(error) => {
            const profile = props.profiles.find((p) => p.id === sheet)
            setSheet(null)
            if (error) {
              setShown({
                error,
                ...(profile?.roleExport ? { format: profile.roleExport } : {}),
                agent: profile?.label ?? sheet,
                saved: props.saved
              })
            } else {
              setShown(null)
            }
            refresh()
          }}
        />
      )}
    </>
  )
  return { button, panel, installed: statuses.length }
}

const STATE_ICONS = {
  upToDate: Check,
  roleChanged: RefreshCw,
  handEdited: AlertTriangle,
  missing: AlertTriangle,
  unreadable: AlertTriangle
} as const

export function StatusRow({
  status,
  agent,
  onAct,
  orphan = false
}: {
  status: RoleExportStatus
  agent: string
  onAct: (action: 'update' | 'replace' | 'remove') => void
  /** Installation sans rôle : son identifiant en tête, seulement « Retirer ». */
  orphan?: boolean
}) {
  const { t } = useTranslation()
  const Icon = STATE_ICONS[status.state]
  const update = orphan
    ? null
    : status.state === 'roleChanged'
      ? t('roleExport.status.update')
      : status.state === 'missing'
        ? t('roleExport.status.reinstall')
        : status.state === 'handEdited'
          ? t('roleExport.status.replace')
          : null
  return (
    <div
      className={`role-export-row ${status.state}`}
      data-testid="role-export-row"
      data-state={status.state}
      data-profile={status.profileId}
      title={status.file}
    >
      <Icon size={15} aria-hidden className="role-export-row-icon" />
      <span className="role-export-row-text">
        {orphan && <code className="role-export-row-id">{status.id}</code>}
        {orphan && ' · '}
        {t('roleExport.status.installed', { agent })}
        <small>
          {' · '}
          {t(`roleExport.scopeShort.${status.scope}`)}
          {' · '}
          {t(`roleExport.status.${status.state}`)}
        </small>
      </span>
      {update && (
        <button
          className="btn small"
          onClick={() => onAct(status.state === 'handEdited' ? 'replace' : 'update')}
          data-testid="role-export-update"
        >
          {update}
        </button>
      )}
      {status.state !== 'unreadable' && (
        <button
          className="btn small link danger-link"
          onClick={() => onAct('remove')}
          data-testid="role-export-remove"
        >
          {t('roleExport.status.remove')}
        </button>
      )}
    </div>
  )
}
