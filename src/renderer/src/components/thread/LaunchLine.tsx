import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LaunchFolderState } from '@shared/launch-folder'
import { ipcErrorText } from '../../ipc-errors'
import type { LaunchChoice } from '../../launch-choice'
import { ItemText, MenuContent } from '../common/Menus'
import { CommitChooser } from '../panel/CommitChooser'

/** Fichiers montrés par « Voir les N modifications », au plus ; les autres sont comptés. */
const MAX_SHOWN = 8

/** Qui partira : un rôle, plusieurs rôles, un travail, des travaux (accord des textes). */
export type LaunchWho = 'role' | 'roles' | 'work' | 'works'

/** Commit court affiché (« a3f2c1e »). */
const short = (head: string) => head.slice(0, 7)

/**
 * Où partira un travail qui écrit (fiche 262, maquette 260 écran B) : un segment discret de la
 * ligne sous la saisie (ou de la carte, du dialogue), jamais un encadré ni un blocage. En
 * worktree : « partira du dernier commit », en orange « sans vos N modifications » s'il en reste,
 * et le menu « Changer… » (committer d'abord, partir sans elles, juste un avis, voir les
 * modifications). Sans worktree possible (dépôt sans commit, hors dépôt) : le travail se fera dans
 * ce dossier, sans menu. Sous la ligne, sur demande : la liste des modifications, ou le choix de
 * commit (`CommitChooser`).
 */
export function LaunchLine({
  state,
  choice,
  onChoose,
  who,
  opinion,
  hideText = false,
  standalone = false,
  committing,
  onCommitting,
  focusCommit = 0,
  commit,
  disabled = false
}: {
  state: LaunchFolderState
  choice: LaunchChoice
  onChoose: (choice: LaunchChoice) => void
  who: LaunchWho
  /** « Juste un avis, en lecture seule » proposé (rôles cités avec `@`). */
  opinion: boolean
  /** Le texte est dit ailleurs (avis : la ligne du rôle le dit) : seul « Changer… » reste. */
  hideText?: boolean
  /** Seule sur sa ligne (carte, dialogue) : sans le « · » qui la relie à la ligne du rôle. */
  standalone?: boolean
  /** Choix de commit ouvert (« Committer d'abord »). */
  committing: boolean
  onCommitting: (on: boolean) => void
  /** Change à chaque Entrée pendant le choix de commit : son bouton prend le focus. */
  focusCommit?: number
  commit: {
    /** Conversation dont l'agent rédige le message (fiche 246). */
    conversationId: string
    confirmLabel: string
    /** Committe ces fichiers dans le dépôt de la mère. */
    run: (message: string, files: string[]) => Promise<unknown>
    /** Commit fait ; `left` : fichiers décochés, restés non commités. */
    onCommitted: (left: number) => void
  }
  /** Envoi en cours : le menu ne s'ouvre pas. */
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const [showFiles, setShowFiles] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const commitBox = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focusCommit > 0) {
      commitBox.current
        ?.querySelector<HTMLButtonElement>('[data-testid=launch-line-commit-confirm]')
        ?.focus()
    }
  }, [focusCommit])
  if (state.place === 'here') {
    return (
      <span
        className="launch-line-text"
        data-testid="launch-line"
        data-place="here"
        data-reason={state.reason}
      >
        {standalone ? '' : '· '}
        {t(`launchLine.${state.reason}.${who}`)}
      </span>
    )
  }
  const dirty = state.dirty
  const count = dirty?.count ?? 0
  const commitShort = short(state.head)
  const doCommit = async (message: string, files: string[], left: number) => {
    setBusy(true)
    setError(null)
    try {
      await commit.run(message, files)
      onCommitting(false)
      setShowFiles(false)
      commit.onCommitted(left)
    } catch (e) {
      setError(ipcErrorText(e))
    } finally {
      setBusy(false)
    }
  }
  const shown = dirty?.files.slice(0, MAX_SHOWN) ?? []
  return (
    <>
      {!hideText && (
        <span
          className={`launch-line-text${dirty && choice === 'without' ? ' warn' : ''}`}
          data-testid="launch-line"
          data-place="worktree"
          data-choice={choice}
          data-count={count}
        >
          {standalone ? '' : '· '}
          {dirty
            ? t('launchLine.without', { count, commit: commitShort })
            : t('launchLine.fromCommit', { commit: commitShort })}
        </span>
      )}
      <Dropdown.Root modal={false}>
        <Dropdown.Trigger
          className="link-button launch-line-change"
          disabled={disabled || committing}
          data-testid="launch-line-change"
        >
          {t('launchLine.change')}
          <ChevronDown size={12} aria-hidden />
        </Dropdown.Trigger>
        <MenuContent testId="launch-line-menu">
          {dirty && (
            <Dropdown.Item
              className="menu-item"
              onSelect={() => onCommitting(true)}
              data-testid="launch-line-commit"
            >
              <ItemText
                title={t('launchLine.menu.commit')}
                description={t('launchLine.menu.commitDesc')}
              />
            </Dropdown.Item>
          )}
          <Dropdown.RadioGroup
            value={choice}
            onValueChange={(value) => onChoose(value === 'readOnly' ? 'readOnly' : 'without')}
          >
            <Dropdown.RadioItem
              value="without"
              className="menu-item"
              data-testid="launch-line-without"
            >
              <ItemText
                title={t(dirty ? 'launchLine.menu.without' : 'launchLine.menu.worktree')}
                description={
                  dirty
                    ? t('launchLine.menu.withoutDesc', { count, commit: commitShort })
                    : t('launchLine.menu.worktreeDesc', { commit: commitShort })
                }
              />
              <Dropdown.ItemIndicator>
                <Check size={16} className="menu-check" />
              </Dropdown.ItemIndicator>
            </Dropdown.RadioItem>
            {opinion && (
              <Dropdown.RadioItem
                value="readOnly"
                className="menu-item"
                data-testid="launch-line-opinion"
              >
                <ItemText
                  title={t('launchLine.menu.opinion')}
                  description={t('launchLine.menu.opinionDesc')}
                />
                <Dropdown.ItemIndicator>
                  <Check size={16} className="menu-check" />
                </Dropdown.ItemIndicator>
              </Dropdown.RadioItem>
            )}
          </Dropdown.RadioGroup>
          {dirty && (
            <>
              <Dropdown.Separator className="menu-separator" />
              <Dropdown.Item
                className="menu-item"
                onSelect={() => setShowFiles((on) => !on)}
                data-testid="launch-line-show"
              >
                <ItemText
                  title={
                    showFiles ? t('launchLine.menu.hide') : t('launchLine.menu.show', { count })
                  }
                />
              </Dropdown.Item>
            </>
          )}
        </MenuContent>
      </Dropdown.Root>
      {dirty && showFiles && !committing && (
        <ul
          className="launch-line-files"
          aria-label={t('launchLine.files')}
          data-testid="launch-line-files"
        >
          {shown.map((file) => (
            <li key={file.path} data-testid="launch-line-file">
              {file.path}
            </li>
          ))}
          {count > shown.length && (
            <li className="muted">
              {t('worktreeCycle.mainDirty.more', { count: count - shown.length })}
            </li>
          )}
        </ul>
      )}
      {dirty && committing && (
        <div className="launch-line-commit" ref={commitBox} data-testid="launch-line-commit-box">
          <CommitChooser
            conversationId={commit.conversationId}
            files={dirty.files}
            busy={busy}
            testid="launch-line-commit"
            confirmLabel={commit.confirmLabel}
            leftNote={(left) => t('launchLine.left', { count: left })}
            onCommit={(message, files, left) => void doCommit(message, files, left)}
            onCancel={() => onCommitting(false)}
          />
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </>
  )
}

/**
 * Où partirait un travail qui écrit, depuis le dossier d'une mère (fiche 262) : lu quand un
 * lancement se prépare (`wanted`) et relu au retour du focus (un commit fait dans un terminal).
 * `null` : pas de dossier ; `undefined` : pas encore lu. `read()` relit et rend le résultat (un
 * envoi qui attend la réponse, après un commit).
 */
export function useLaunchFolder(
  motherId: string | undefined,
  wanted: boolean
): {
  state: LaunchFolderState | null | undefined
  read: () => Promise<LaunchFolderState | null>
} {
  const [read, setRead] = useState<{ id: string; state: LaunchFolderState | null }>()
  const reread = useCallback(async (): Promise<LaunchFolderState | null> => {
    if (!motherId) return null
    const state = await window.api.conversations.childFolder(motherId).catch(() => null)
    setRead({ id: motherId, state })
    return state
  }, [motherId])
  useEffect(() => {
    if (!wanted || !motherId) return
    let live = true
    const fetch = () =>
      window.api.conversations
        .childFolder(motherId)
        .catch(() => null)
        .then((state) => {
          if (live) setRead({ id: motherId, state })
        })
    void fetch()
    const onFocus = () => void fetch()
    window.addEventListener('focus', onFocus)
    return () => {
      live = false
      window.removeEventListener('focus', onFocus)
    }
  }, [wanted, motherId])
  return { state: read && read.id === motherId ? read.state : undefined, read: reread }
}
