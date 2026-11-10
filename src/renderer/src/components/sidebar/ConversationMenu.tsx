import * as Dialog from '@radix-ui/react-dialog'
import { useProfileStatus } from '../common/Profile'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import {
  Archive,
  ArchiveRestore,
  Columns2,
  FileDown,
  FileJson,
  Pencil,
  Pin,
  PinOff,
  Split,
  Trash2
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Tip } from '../common/Menus'
import type { ConversationSummary, WorktreeStatusView } from '@shared/agent'
import type { ChildCapacity } from '@shared/children'
import type { ExportFormat } from '@shared/export'
import { Trans, useTranslation } from 'react-i18next'

/** Ce qu'on peut faire d'une conversation (menu de la barre latérale et du titre, fiche 049). */
export interface ConversationActions {
  onPin: () => void
  /** Commencer le renommage en place (là où le menu a été ouvert). */
  onRename: () => void
  onExport: (format: ExportFormat) => void
  onArchive: () => void
  onDelete: () => void
  /** Ouvrir à côté de la conversation active (absent pour l'active elle-même). */
  onOpenBeside?: () => void
  /** « Lancer en parallèle… » : une conversation fille (fiche 097). */
  onLaunchChild?: () => void
}

/**
 * Éléments du menu d'une conversation, à placer dans un `Dropdown.Content` : épingler, ouvrir à
 * côté, renommer, exporter, archiver, supprimer. `testIdPrefix` distingue les deux menus dans les
 * essais (`history`, `title`).
 */
export function ConversationMenuItems({
  conversation,
  testIdPrefix,
  onPin,
  onRename,
  onExport,
  onArchive,
  onDelete,
  onOpenBeside,
  onLaunchChild
}: ConversationActions & { conversation: ConversationSummary; testIdPrefix: string }) {
  const { t } = useTranslation()
  const id = (name: string) => `${testIdPrefix}-${name}`
  // Profil en lecture seule (fiche 196) : désactivé, la raison en infobulle.
  const { readOnly } = useProfileStatus()
  const locked = readOnly ? { disabled: true, title: t('profile.readOnly.line') } : {}
  return (
    <>
      <Dropdown.Item className="menu-item" onSelect={onPin} data-testid={id('pin')} {...locked}>
        {conversation.pinned ? (
          <PinOff size={15} className="menu-icon" />
        ) : (
          <Pin size={15} className="menu-icon" />
        )}
        <span className="menu-text">
          {conversation.pinned ? t('conversationMenu.unpin') : t('conversationMenu.pin')}
        </span>
      </Dropdown.Item>
      {onOpenBeside && (
        <Dropdown.Item
          className="menu-item"
          onSelect={onOpenBeside}
          data-testid={id('open-beside')}
        >
          <Columns2 size={15} className="menu-icon" />
          <span className="menu-text">{t('conversationMenu.openBeside')}</span>
        </Dropdown.Item>
      )}
      {/* Une fille n'a pas de filles (un seul niveau) ; une mère est dans l'historique, active. */}
      {onLaunchChild &&
        !conversation.draft &&
        !conversation.archived &&
        !conversation.startedFrom && (
          <LaunchChildItem
            conversationId={conversation.id}
            onSelect={onLaunchChild}
            testId={id('launch-child')}
            readOnly={readOnly}
          />
        )}
      <Dropdown.Item
        className="menu-item"
        onSelect={onRename}
        data-testid={id('rename')}
        {...locked}
      >
        <Pencil size={15} className="menu-icon" />
        <span className="menu-text">{t('conversationMenu.rename')}</span>
      </Dropdown.Item>
      <Dropdown.Item
        className="menu-item"
        onSelect={() => onExport('markdown')}
        data-testid={id('export-markdown')}
      >
        <FileDown size={15} className="menu-icon" />
        <span className="menu-text">{t('conversationMenu.exportMarkdown')}</span>
      </Dropdown.Item>
      <Dropdown.Item
        className="menu-item"
        onSelect={() => onExport('json')}
        data-testid={id('export-json')}
      >
        <FileJson size={15} className="menu-icon" />
        <span className="menu-text">{t('conversationMenu.exportJson')}</span>
      </Dropdown.Item>
      <Dropdown.Item
        className="menu-item"
        onSelect={onArchive}
        data-testid={id('archive')}
        {...locked}
      >
        {conversation.archived ? (
          <ArchiveRestore size={15} className="menu-icon" />
        ) : (
          <Archive size={15} className="menu-icon" />
        )}
        <span className="menu-text">
          {conversation.archived ? t('conversationMenu.unarchive') : t('conversationMenu.archive')}
        </span>
      </Dropdown.Item>
      <Dropdown.Item
        className="menu-item danger"
        onSelect={onDelete}
        data-testid={id('delete')}
        {...locked}
      >
        <Trash2 size={15} className="menu-icon" />
        <span className="menu-text">{t('conversationMenu.delete')}</span>
      </Dropdown.Item>
    </>
  )
}

/**
 * « Lancer en parallèle… » (fiche 097) : une fille travaille dans un worktree, le dossier doit être
 * dans un dépôt git ; et pas plus de filles en cours que le plafond réglé (ADR-0020). Lu à
 * l'ouverture du menu ; sinon, l'élément est désactivé et dit pourquoi.
 */
function LaunchChildItem({
  conversationId,
  onSelect,
  testId,
  readOnly
}: {
  conversationId: string
  onSelect: () => void
  testId: string
  readOnly: boolean
}) {
  const { t } = useTranslation()
  const [capacity, setCapacity] = useState<ChildCapacity | null>(null)
  useEffect(() => {
    let alive = true
    window.api.conversations
      .childCapacity(conversationId)
      .then((value) => alive && setCapacity(value))
      .catch(() => alive && setCapacity({ inRepo: false, active: 0, max: 0 }))
    return () => {
      alive = false
    }
  }, [conversationId])
  const reason = readOnly
    ? t('profile.readOnly.line')
    : !capacity
      ? undefined
      : !capacity.inRepo
        ? t('children.notRepo')
        : capacity.active >= capacity.max
          ? t('children.limit', { count: capacity.max })
          : undefined
  const item = (
    <Dropdown.Item
      className="menu-item"
      disabled={!capacity || !!reason}
      onSelect={onSelect}
      data-testid={testId}
    >
      <Split size={15} className="menu-icon" />
      <span className="menu-text">{t('conversationMenu.launchChild')}</span>
    </Dropdown.Item>
  )
  // Toujours la même enveloppe : la remplacer après la lecture refermerait le menu.
  return (
    <Tip label={reason ?? ''} side="right">
      {item}
    </Tip>
  )
}

/**
 * Confirmation de suppression (fiche 026), à la place de la boîte du navigateur. Pour une
 * conversation en worktree (fiche 036) : ce qui serait perdu, et le choix de supprimer le worktree.
 */
export function DeleteDialog({
  conversation,
  onWorktreeStatus,
  onClose,
  onConfirm
}: {
  conversation: ConversationSummary
  onWorktreeStatus: (id: string) => Promise<WorktreeStatusView | null>
  onClose: () => void
  onConfirm: (options: { fromAgent: boolean; removeWorktree: boolean }) => void
}) {
  const { t } = useTranslation()
  // Jamais coché d'office (fiche 196) : c'est le seul geste définitif, la corbeille ne le rattrape pas.
  const [fromAgent, setFromAgent] = useState(false)
  const [worktree, setWorktree] = useState<WorktreeStatusView | null>(null)
  // Coché d'office seulement s'il n'y a rien à perdre ; sinon c'est à l'utilisateur de cocher.
  const [removeWorktree, setRemoveWorktree] = useState<boolean | null>(null)
  useEffect(() => {
    if (!conversation.branch) return
    let alive = true
    void onWorktreeStatus(conversation.id)
      .then((status) => alive && setWorktree(status))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [conversation.id, conversation.branch, onWorktreeStatus])
  const safe = !!worktree && (worktree.missing || (worktree.dirty === 0 && worktree.ahead === 0))
  const remove = removeWorktree ?? safe
  const losses = worktree
    ? [
        worktree.dirty > 0 && t('deleteDialog.loss.dirty', { count: worktree.dirty }),
        worktree.ahead > 0 && t('deleteDialog.loss.ahead', { count: worktree.ahead })
      ].filter(Boolean)
    : []
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog confirm-dialog" data-testid="delete-dialog">
          <Dialog.Title className="confirm-title">
            {t('deleteDialog.title', { title: conversation.title })}
          </Dialog.Title>
          <Dialog.Description className="confirm-text">
            {t('deleteDialog.description')}
          </Dialog.Description>
          {/* Seulement si l'agent sait supprimer une session (fiche 196). */}
          {conversation.agentDeletes && (
            <label className="confirm-option">
              <input
                type="checkbox"
                checked={fromAgent}
                onChange={(e) => setFromAgent(e.target.checked)}
                data-testid="delete-from-agent"
              />
              <span>
                <Trans
                  t={t}
                  i18nKey="deleteDialog.fromAgent"
                  values={{ agent: conversation.profileLabel }}
                  components={{ muted: <span className="muted" /> }}
                />
              </span>
            </label>
          )}
          {conversation.branch && (
            <label className="confirm-option">
              <input
                type="checkbox"
                checked={remove}
                disabled={!worktree}
                onChange={(e) => setRemoveWorktree(e.target.checked)}
                data-testid="delete-worktree"
              />
              <span>
                <Trans
                  t={t}
                  i18nKey="deleteDialog.worktree"
                  values={{ branch: conversation.branch }}
                  components={{ code: <code /> }}
                />
                {losses.length > 0 && (
                  <span className="confirm-warning" data-testid="delete-worktree-losses">
                    {' '}
                    {t('deleteDialog.losses', { losses: losses.join(', ') })}
                  </span>
                )}
              </span>
            </label>
          )}
          <div className="confirm-actions">
            <Dialog.Close className="btn ghost">{t('common.cancel')}</Dialog.Close>
            <button
              className="btn danger"
              autoFocus
              onClick={() =>
                onConfirm({
                  fromAgent: fromAgent && conversation.agentDeletes === true,
                  removeWorktree: !!conversation.branch && remove
                })
              }
              data-testid="delete-confirm"
            >
              {t('deleteDialog.confirm')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
