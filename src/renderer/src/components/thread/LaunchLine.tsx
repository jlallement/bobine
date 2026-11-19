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
/** Fichiers nommés en aperçu sous « Voir les N modifications », dans le menu. */
const PREVIEW = 3

/** Qui partira : un rôle, plusieurs rôles, un travail, des travaux (accord des textes). */
export type LaunchWho = 'role' | 'roles' | 'work' | 'works'

/** Commit court affiché (« a3f2c1e »). */
const short = (head: string) => head.slice(0, 7)

/**
 * Où partira un travail qui écrit (fiche 262, maquette 260 écran B) : un segment discret de la
 * ligne sous la saisie (ou de la carte, du dialogue), jamais un encadré ni un blocage. En
 * worktree : « partira du dernier commit », en orange « sans vos N modifications » s'il en reste,
 * et le menu « Changer… » (committer d'abord, partir sans elles, juste un avis, voir les
 * modifications). Dépôt sans commit : en orange, le travail se fera dans ce dossier, en même temps
 * que l'agent ; hors dépôt : il ne peut pas partir. Pas de menu dans ces deux cas. La liste des
 * modifications et le choix de commit sont à part (`LaunchDetails`), hors de la région annoncée
 * aux lecteurs d'écran.
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
  showFiles,
  onShowFiles,
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
  /** Choix de commit ouvert (« Committer d'abord ») : le menu attend. */
  committing: boolean
  onCommitting: (on: boolean) => void
  /** Liste des modifications ouverte (« Voir les N modifications »). */
  showFiles: boolean
  onShowFiles: (on: boolean) => void
  /** Envoi en cours : le menu ne s'ouvre pas. */
  disabled?: boolean
}) {
  const { t } = useTranslation()
  // Le « · » s'accroche à la fin du segment d'avant (espace insécable) : jamais en tête de ligne.
  const lead = standalone ? '' : ' · '
  if (state.place === 'here') {
    return (
      <span
        className="launch-line-text warn"
        data-testid="launch-line"
        data-place="here"
        data-reason={state.reason}
      >
        {lead}
        {t(`launchLine.${state.reason}.${who}`)}
      </span>
    )
  }
  const dirty = state.dirty
  const count = dirty?.count ?? 0
  const commitShort = short(state.head)
  const plural = who === 'roles' || who === 'works'
  const text = committing
    ? t('launchLine.committing')
    : dirty
      ? standalone
        ? t(`launchLine.withoutAlone.${plural ? 'works' : 'work'}`, { count })
        : t('launchLine.without', { count })
      : t('launchLine.fromCommit', { commit: commitShort })
  const names =
    dirty?.files
      .slice(0, PREVIEW)
      .map((f) => f.path)
      .join(', ') ?? ''
  return (
    <>
      {!hideText && (
        <span
          className={`launch-line-text${dirty && choice === 'without' && !committing ? ' warn' : ''}`}
          data-testid="launch-line"
          data-place="worktree"
          data-choice={committing ? 'commit' : choice}
          data-count={count}
        >
          {lead}
          {text}
        </span>
      )}{' '}
      <Dropdown.Root modal={false}>
        <Dropdown.Trigger
          className="link-button launch-line-change"
          disabled={disabled || committing}
          aria-label={t(`launchLine.changeLabel.${who}`)}
          data-testid="launch-line-change"
        >
          {t('launchLine.change')}
          <ChevronDown size={12} aria-hidden />
        </Dropdown.Trigger>
        <MenuContent testId="launch-line-menu">
          <Dropdown.RadioGroup
            value={committing ? 'commit' : choice}
            onValueChange={(value) => {
              if (value === 'commit') {
                onShowFiles(false)
                onCommitting(true)
              } else onChoose(value === 'readOnly' ? 'readOnly' : 'without')
            }}
          >
            {dirty && (
              <Dropdown.RadioItem
                value="commit"
                className="menu-item"
                data-testid="launch-line-commit"
              >
                <ItemText
                  title={t('launchLine.menu.commit')}
                  description={t('launchLine.menu.commitDesc')}
                />
                <Dropdown.ItemIndicator>
                  <Check size={16} className="menu-check" />
                </Dropdown.ItemIndicator>
              </Dropdown.RadioItem>
            )}
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
            {opinion && <Dropdown.Separator className="menu-separator" />}
            {opinion && (
              <Dropdown.RadioItem
                value="readOnly"
                className="menu-item"
                data-testid="launch-line-opinion"
              >
                <ItemText
                  title={t('launchLine.menu.opinion')}
                  description={t(`launchLine.menu.opinionDesc.${plural ? 'roles' : 'role'}`)}
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
                onSelect={() => onShowFiles(!showFiles)}
                data-testid="launch-line-show"
              >
                <ItemText
                  title={
                    showFiles
                      ? t('launchLine.menu.hide', { count })
                      : t('launchLine.menu.show', { count })
                  }
                  {...(showFiles
                    ? {}
                    : {
                        description: t(
                          count > PREVIEW
                            ? 'launchLine.menu.previewMore'
                            : 'launchLine.menu.preview',
                          { names }
                        )
                      })}
                />
              </Dropdown.Item>
            </>
          )}
        </MenuContent>
      </Dropdown.Root>
    </>
  )
}

/**
 * Sous la ligne, sur demande (fiche 262) : la liste des modifications, ou le choix de commit
 * (`CommitChooser`). Hors de la région `aria-live` de la ligne : un formulaire n'y est pas relu à
 * chaque frappe. `focusCommit` change à chaque Entrée pendant le choix de commit : son bouton prend
 * le focus ; désactivé (message en cours de rédaction, aucun fichier coché), le message, sinon le
 * bloc lui-même — Entrée a toujours un effet visible.
 */
export function LaunchDetails({
  state,
  committing,
  onCommitting,
  showFiles,
  onShowFiles,
  focusCommit = 0,
  commit
}: {
  state: LaunchFolderState | null | undefined
  committing: boolean
  onCommitting: (on: boolean) => void
  showFiles: boolean
  onShowFiles: (on: boolean) => void
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
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const commitBox = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focusCommit === 0) return
    const box = commitBox.current
    if (!box) return
    const usable = (testid: string) => {
      const found = box.querySelector<HTMLButtonElement | HTMLTextAreaElement>(
        `[data-testid=${testid}]`
      )
      return found && !found.disabled ? found : null
    }
    const target = usable('launch-line-commit-confirm') ?? usable('launch-line-commit-message')
    box.scrollIntoView?.({ block: 'nearest' })
    ;(target ?? box).focus()
  }, [focusCommit])
  const dirty = state?.place === 'worktree' ? state.dirty : undefined
  if (!dirty) return null
  const count = dirty.count
  const shown = dirty.files.slice(0, MAX_SHOWN)
  const doCommit = async (message: string, files: string[], left: number) => {
    setBusy(true)
    setError(null)
    try {
      await commit.run(message, files)
      onCommitting(false)
      onShowFiles(false)
      commit.onCommitted(left)
    } catch (e) {
      setError(ipcErrorText(e))
    } finally {
      setBusy(false)
    }
  }
  if (committing) {
    return (
      <div
        className="launch-line-commit"
        ref={commitBox}
        tabIndex={-1}
        data-testid="launch-line-commit-box"
      >
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
          <p className="field-error" role="alert" data-testid="launch-line-commit-error">
            {error}
          </p>
        )}
      </div>
    )
  }
  if (!showFiles) return null
  return (
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
