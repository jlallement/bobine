import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { BellOff, BellRing, Check, Folder, History, ListFilter, Settings } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/** Regroupement de la liste : « Récents » ou « Dossiers » (fiche 131). */
export type Grouping = 'recent' | 'folder'

/**
 * Cloche en alerte : macOS refuse les notifications de l'app (signée « ad hoc », fiche 024). Le menu
 * l'explique, ouvre les réglages du système ou coupe les notifications.
 */
export function NotificationsBlocked({
  reason,
  onOpenSettings,
  onDisable
}: {
  reason: string
  onOpenSettings: () => void
  onDisable: () => void
}) {
  const { t } = useTranslation()
  return (
    // Non modal : « Réglages » ouvre une fenêtre (voir ConversationTitle).
    <Dropdown.Root modal={false}>
      <Dropdown.Trigger
        className="icon-button small notifications-blocked"
        aria-label={t('sidebar.notifications.blocked')}
        data-testid="notifications-blocked"
      >
        <BellRing size={15} />
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="menu notifications-menu" side="top" align="end" sideOffset={6}>
          <div className="menu-label">{t('sidebar.notifications.blocked')}</div>
          <div className="menu-note" title={reason}>
            {t('sidebar.notifications.blockedHint')}
          </div>
          <Dropdown.Item className="menu-item" onSelect={onOpenSettings}>
            <Settings size={15} className="menu-icon" />
            <span className="menu-text">{t('sidebar.notifications.openSettings')}</span>
          </Dropdown.Item>
          <Dropdown.Item className="menu-item" onSelect={onDisable}>
            <BellOff size={15} className="menu-icon" />
            <span className="menu-text">{t('sidebar.notifications.turnOff')}</span>
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}

export function GroupingMenu({
  grouping,
  onChoose,
  onResumeSession,
  onHold
}: {
  grouping: Grouping
  onChoose: (grouping: Grouping) => void
  onResumeSession: () => void
  onHold: () => () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  useEffect(() => (open ? onHold() : undefined), [open, onHold])
  const option = (value: Grouping, label: string, icon: ReactNode) => (
    <Dropdown.Item
      className="menu-item"
      onSelect={() => onChoose(value)}
      data-testid={`grouping-${value}`}
    >
      {icon}
      <span className="menu-text">{label}</span>
      {grouping === value && <Check size={14} className="menu-check" />}
    </Dropdown.Item>
  )
  return (
    // Non modal : « Reprendre une session… » ouvre une fenêtre.
    <Dropdown.Root modal={false} open={open} onOpenChange={setOpen}>
      <Dropdown.Trigger
        className="icon-button small section-action"
        aria-label={t('sidebar.grouping.label')}
        data-testid="history-grouping"
      >
        <ListFilter size={14} />
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="menu" side="right" align="start" sideOffset={6}>
          <div className="menu-label">{t('sidebar.grouping.title')}</div>
          {option(
            'recent',
            t('sidebar.grouping.recent'),
            <ListFilter size={15} className="menu-icon" />
          )}
          {option(
            'folder',
            t('sidebar.grouping.folder'),
            <Folder size={15} className="menu-icon" />
          )}
          <Dropdown.Separator className="menu-separator" />
          <Dropdown.Item
            className="menu-item"
            onSelect={onResumeSession}
            data-testid="history-resume-session"
          >
            <History size={15} className="menu-icon" />
            <span className="menu-text">{t('sidebar.resumeSession')}</span>
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}
