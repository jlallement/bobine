import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { ConversationSummary, DeleteOptions, WorktreeStatusView } from '@shared/agent'
import type { FamilyMember } from '@shared/children'
import { focusComposer } from '../../useAside'
import { agentsOf, familyRows } from './delete-family'

/**
 * Confirmation de suppression (fiche 026), à la place de la boîte du navigateur. Pour une
 * conversation en worktree (fiche 036) : ce qui serait perdu, et le choix de supprimer le worktree.
 * Pour une mère (fiche 228) : ses filles nommées, et « Supprimer aussi ses N filles », coché.
 */
export function DeleteDialog({
  conversation,
  onWorktreeStatus,
  onFamily,
  participant,
  onClose,
  onConfirm
}: {
  conversation: ConversationSummary
  onWorktreeStatus: (id: string) => Promise<WorktreeStatusView | null>
  /** Descendance de la conversation (fiche 228) ; absente : aucune. */
  onFamily?: (id: string) => Promise<FamilyMember[]>
  /** Participant d'un tour de table (`summary.roundtable`, fiche 285) : il n'a pas de worktree. */
  participant?: (id: string) => boolean
  onClose: () => void
  onConfirm: (options: DeleteOptions & { fromAgent: boolean; removeWorktree: boolean }) => void
}) {
  const { t, i18n } = useTranslation()
  // Jamais coché d'office (fiche 196) : c'est le seul geste définitif, la corbeille ne le rattrape pas.
  const [fromAgent, setFromAgent] = useState(false)
  const [worktree, setWorktree] = useState<WorktreeStatusView | null>(null)
  // Coché d'office seulement s'il n'y a rien à perdre ; sinon c'est à l'utilisateur de cocher.
  const [removeWorktree, setRemoveWorktree] = useState<boolean | null>(null)
  const [family, setFamily] = useState<FamilyMember[]>([])
  // Coché d'office (fiche 228) : la famille part avec la mère.
  const [withChildren, setWithChildren] = useState(true)
  // Confirmée : la ligne qui a ouvert la boîte va disparaître (recette rc.4).
  const confirmed = useRef(false)
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
  useEffect(() => {
    if (!onFamily) return
    let alive = true
    void onFamily(conversation.id)
      .then((members) => alive && setFamily(members))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [conversation.id, onFamily])
  const safe = !!worktree && (worktree.missing || (worktree.dirty === 0 && worktree.ahead === 0))
  const remove = removeWorktree ?? safe
  const losses = worktree
    ? [
        worktree.dirty > 0 && t('deleteDialog.loss.dirty', { count: worktree.dirty }),
        worktree.ahead > 0 && t('deleteDialog.loss.ahead', { count: worktree.ahead })
      ].filter(Boolean)
    : []
  // Chaque conversation supprimée l'est chez son propre agent (fiche 228).
  const deleted = [conversation, ...(withChildren ? family : [])]
  const agents = agentsOf(deleted)
  const list = (labels: string[]) =>
    new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(labels)
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog confirm-dialog"
          data-testid="delete-dialog"
          // Après « Mettre à la corbeille », Radix rendrait le focus au bouton qui a ouvert la boîte,
          // dans la ligne supprimée juste après : il tombait sur la page (recette rc.4). Il va à la
          // zone de saisie. Annuler le rend au bouton, qui reste.
          onCloseAutoFocus={(event) => {
            if (!confirmed.current) return
            event.preventDefault()
            focusComposer()
          }}
        >
          <Dialog.Title className="confirm-title">
            {t('deleteDialog.title', { title: conversation.title })}
          </Dialog.Title>
          <Dialog.Description className="confirm-text">
            {t('deleteDialog.description')}
          </Dialog.Description>
          {family.length > 0 && (
            <FamilyOption
              rootId={conversation.id}
              family={family}
              participants={!!participant && family.every((m) => participant(m.id))}
              checked={withChildren}
              onChange={setWithChildren}
            />
          )}
          {/* Seulement si un agent concerné sait supprimer une session (fiche 196). */}
          {agents.deleting.length > 0 && (
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
                  i18nKey={
                    deleted.length > 1 ? 'deleteDialog.fromAgents' : 'deleteDialog.fromAgent'
                  }
                  values={{ agent: list(agents.deleting) }}
                  components={{ muted: <span className="muted" /> }}
                />
                {agents.keeping.length > 0 && (
                  <span className="family-note" data-testid="delete-from-agent-keeping">
                    {t('deleteDialog.fromAgentKeeping', {
                      count: agents.keeping.length,
                      agents: list(agents.keeping)
                    })}
                  </span>
                )}
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
              onClick={() => {
                confirmed.current = true
                onConfirm({
                  fromAgent: fromAgent && agents.deleting.length > 0,
                  removeWorktree: !!conversation.branch && remove,
                  ...(family.length > 0 ? { children: withChildren ? 'delete' : 'keep' } : {})
                })
              }}
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

/** « Supprimer aussi ses N filles » (fiche 228) : la descendance nommée, sous ses mères. */
function FamilyOption({
  rootId,
  family,
  checked,
  onChange,
  participants
}: {
  rootId: string
  family: FamilyMember[]
  /** Que des participants d'un tour de table : rien à dire d'un worktree (M8). */
  participants: boolean
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const { t } = useTranslation()
  const count = family.length
  return (
    <label className="confirm-option">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        data-testid="delete-children"
      />
      <span>
        {t('deleteDialog.children', { count })}
        <ul className="family-list" data-testid="delete-children-list">
          {familyRows(family, rootId).map(({ member, depth }) => (
            <li
              key={member.id}
              className={depth > 0 ? 'nested' : undefined}
              style={depth > 1 ? { paddingLeft: depth * 16 } : undefined}
            >
              {depth > 0 && (
                <span className="elbow" aria-hidden>
                  ↳
                </span>
              )}
              <span className="title">{member.title}</span>
              {member.busy && (
                <span className="busy" data-testid="delete-child-busy">
                  {t(checked ? 'deleteDialog.childBusyStop' : 'deleteDialog.childBusy')}
                </span>
              )}
            </li>
          ))}
        </ul>
        <span className="family-note" data-testid="delete-children-note">
          {t(
            checked
              ? participants
                ? 'deleteDialog.childrenTrash'
                : 'deleteDialog.childrenDelete'
              : 'deleteDialog.childrenKeep',
            { count }
          )}
        </span>
      </span>
    </label>
  )
}
