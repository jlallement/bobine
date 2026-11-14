import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { CalendarClock, Ellipsis, GitFork, Bookmark } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary } from '@shared/agent'
import type { AttentionDetail, AttentionKind } from '@shared/attention'
import { branchBase } from '@shared/branch'
import type { ExportFormat } from '@shared/export'
import { ConversationStateIcon } from '../common/ConversationState'
import { Tip } from '../common/Menus'
import { conversationState } from './conversation-state'
import { ConversationMenuItems } from './ConversationMenu'
import { rowDay } from '../../time'
import { RoleAvatar } from '../roles/RoleAvatar'
import '../../memory.css'

/** Place d'une fille sous sa mère : le lien part sous la mère, s'arrête au coude sous la dernière. */
export interface ChildLinkPlace {
  first: boolean
  last: boolean
}

/**
 * Une ligne de la liste des conversations (fiches 125, 131) : le titre part du bord, à droite ce
 * qui change (état propre en icône, sinon le jour), et les détails en infobulle (fiche 149).
 * Seule une fille sous sa mère a une colonne à gauche,
 * avec le lien qui l'y rattache. Le menu « … » vient au survol par-dessus la droite.
 */
export function HistoryItem({
  conversation,
  link,
  preparing = false,
  branchOf,
  onHold,
  active,
  attention,
  attentionDetail,
  onSelect,
  onRename,
  onPin,
  onArchive,
  onExport,
  onOpenBeside,
  onDelete,
  onLaunchChild
}: {
  conversation: ConversationSummary
  /** Fille affichée sous sa mère (fiches 097, 131) : sa place dans le lien. */
  link?: ChildLinkPlace
  /** Ligne provisoire pendant la création du worktree : aucune commande de conversation. */
  preparing?: boolean
  /** Titre de l'original, pour une branche (fiche 023). */
  branchOf?: string
  /** Fige l'ordre de la liste ; rend de quoi le libérer. */
  onHold: () => () => void
  active: boolean
  attention?: AttentionKind
  attentionDetail?: AttentionDetail
  onSelect: () => void
  onRename: (title: string) => void
  onPin: () => void
  onArchive: () => void
  onExport: (format: ExportFormat) => void
  onOpenBeside?: () => void
  onDelete: () => void
  onLaunchChild?: () => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(conversation.title)
  const [menuOpen, setMenuOpen] = useState(false)
  // La liste ne bouge pas pendant qu'on choisit dans le menu ou qu'on renomme.
  useEffect(() => (menuOpen || editing ? onHold() : undefined), [menuOpen, editing, onHold])

  const finish = (save: boolean) => {
    setEditing(false)
    if (save && draft.trim() && draft.trim() !== conversation.title) onRename(draft.trim())
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') finish(true)
    if (event.key === 'Escape') finish(false)
  }

  if (editing) {
    return (
      <div className="sidebar-item active">
        <input
          className="rename-input"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => finish(true)}
          data-testid="rename-input"
        />
      </div>
    )
  }

  const mother = conversation.startedFrom
  // Exécution d'une tâche planifiée (fiche 178) : un repère comme celui d'une branche.
  const scheduled = conversation.scheduled
  const activity = conversationState(conversation, attention, attentionDetail, preparing)
  // Branche : le titre sans sa marque, la marque en repère qui ne se coupe pas (fiche 125).
  const isBranch = branchOf !== undefined
  const label = isBranch
    ? branchBase(conversation.title, t('conversations.branchSuffix'))
    : conversation.title
  // Infobulle : le titre entier, d'où vient la conversation (et l'état d'une fille, que la coche
  // dit à droite), sa branche de worktree, son dossier (fiche 131).
  const tip = [
    conversation.title,
    ...(isBranch ? [t('sidebar.branchOf', { title: branchOf })] : []),
    ...(scheduled ? [t('sidebar.scheduledTip', { name: scheduled.name })] : []),
    ...(conversation.role ? [t('team.roleTip', { label: conversation.role.label })] : []),
    ...(mother
      ? [
          t('sidebar.childOf', {
            title: mother.title,
            state: activity?.label ?? t('children.state.done')
          })
        ]
      : []),
    ...(!mother && activity ? [activity.label] : []),
    ...(conversation.branch ? [t('sidebar.worktree', { branch: conversation.branch })] : []),
    conversation.workspace
  ].join('\n')
  // Une conversation qui attend est « non lue » : son titre en gras, seul signal (fiche 125).
  const unread = !!attention

  return (
    <div
      className={`history-item sidebar-item${active ? ' active' : ''}${link ? ' nested' : ''}${unread ? ' unread' : ''}`}
      data-testid="history-item"
      data-id={conversation.id}
      data-mother={mother?.id}
      data-branch={conversation.branch}
      {...(preparing ? { 'data-preparing': true, 'aria-busy': true } : {})}
    >
      <Tip label={tip} side="right" className="history-tooltip">
        <button
          className="history-open"
          onClick={preparing ? undefined : onSelect}
          aria-disabled={preparing || undefined}
        >
          {link && (
            <span className="row-slot">
              <ChildLink {...link} />
            </span>
          )}
          <span className="row-main">
            <span className="row-title">
              {conversation.role && (
                <RoleAvatar
                  role={conversation.role}
                  size="xs"
                  className="history-role"
                  testId="history-role"
                />
              )}
              <span className="label">{label}</span>
              {isBranch && (
                <span
                  className="history-fork"
                  data-testid="history-branch-tag"
                  aria-label={t('sidebar.branchOf', { title: branchOf })}
                >
                  <GitFork size={13} />
                </span>
              )}
              {scheduled && (
                <span
                  className="history-fork"
                  data-testid="history-scheduled-tag"
                  aria-label={t('sidebar.scheduledTip', { name: scheduled.name })}
                >
                  <CalendarClock size={13} />
                </span>
              )}
              {conversation.memoryPending ? (
                <span className="memory-pill" data-testid="memory-pill">
                  <Bookmark size={11} aria-hidden />
                  {conversation.memoryPending > 1
                    ? t('memory.pillCount', { count: conversation.memoryPending })
                    : t('memory.pill')}
                </span>
              ) : null}
              <RowMeta conversation={conversation} activity={activity} />
            </span>
          </span>
        </button>
      </Tip>
      {/* Non modal : voir ConversationTitle (la boîte « Supprimer » bloquait la page). */}
      {!preparing && (
        <Dropdown.Root modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
          <Dropdown.Trigger
            className="history-more"
            aria-label={t('sidebar.options')}
            data-testid="history-more"
          >
            <Ellipsis size={15} />
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content className="menu" side="right" align="start" sideOffset={6}>
              <ConversationMenuItems
                conversation={conversation}
                testIdPrefix="history"
                onPin={onPin}
                onRename={() => {
                  setDraft(conversation.title)
                  setEditing(true)
                }}
                onExport={onExport}
                onArchive={onArchive}
                onDelete={onDelete}
                {...(onOpenBeside ? { onOpenBeside } : {})}
                {...(onLaunchChild ? { onLaunchChild } : {})}
              />
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      )}
    </div>
  )
}

/**
 * Lien d'une fille à sa mère (fiche 131), dans la colonne de la fille : un trait fin qui part un
 * peu sous la mère (première fille) ou continue celui du dessus, puis un coude arrondi et une petite
 * flèche vers le titre. Sous la dernière fille, le trait s'arrête au coude. Le dessin couvre la
 * hauteur de la ligne (32 px), d'un bord à l'autre, pour que les traits se raccordent.
 */
function ChildLink({ first, last }: ChildLinkPlace) {
  const top = first ? 4 : 0
  const trunk = last ? `M8 ${top} L8 10` : `M8 ${top} L8 32`
  const branch = last ? 'Q8 16 14 16 L17.5 16' : 'M8 10 Q8 16 14 16 L17.5 16'
  return (
    <svg
      className="child-link"
      width="20"
      height="32"
      viewBox="0 0 20 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-testid="child-link"
    >
      <path d={`${trunk} ${branch}`} />
      <path d="M15 13.5 L17.5 16 L15 18.5" />
    </svg>
  )
}

/**
 * À droite du titre : l'état d'une fille (roue, coche verte quand elle est finie…), le travail en
 * cours, une action attendue ; sinon le jour, pour une conversation d'avant aujourd'hui.
 */
function RowMeta({
  conversation,
  activity
}: {
  conversation: ConversationSummary
  activity: ReturnType<typeof conversationState>
}): ReactNode {
  const { t } = useTranslation()
  if (activity) {
    return (
      <span className="row-meta">
        <ConversationStateIcon {...activity} />
      </span>
    )
  }
  const day = rowDay(conversation.updatedAt, t('sidebar.yesterday'))
  return day ? (
    <span className="row-meta row-day" data-testid="history-day">
      {day}
    </span>
  ) : null
}
