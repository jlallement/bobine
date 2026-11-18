import { Info } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { splitPath } from '@shared/changes'
import { looksSecret, proposeCommitMessage, type CommitFile } from '@shared/worktree-cycle'
import { CommitForm } from './CommitForm'
import { GIT_BADGES } from './ChangesList'

/** Au-delà, la liste défile dans un cadre de hauteur bornée (« Tout afficher » la déplie). */
const SCROLL_FROM = 8

/**
 * « Committer d'abord » avec la liste complète des fichiers (fiche 244) : une case par fichier,
 * toutes cochées au départ, comme la vue Git d'un worktree (fiche 110) ; seuls les cochés partent,
 * et le message proposé ne cite qu'eux. Commun à « Fusion refusée » (fiche 123) et à
 * l'avertissement avant le lancement d'une fille en worktree (fiche 240). `leftNote` dit ce que
 * deviennent les décochés, propre à chaque carte ; `onCommit` reçoit leur nombre.
 */
export function CommitChooser({
  files,
  title,
  busy,
  testid,
  confirmLabel,
  leftNote,
  onCommit,
  onCancel
}: {
  files: readonly CommitFile[]
  /** Titre d'où proposer le message (la mère) ; neutre sans. */
  title: string
  busy: boolean
  testid: string
  confirmLabel: string
  /** Phrase pour `count` fichiers décochés. */
  leftNote: (count: number) => string
  /** Ces fichiers (les cochés), avec ce message ; `left` : combien restent décochés. */
  onCommit: (message: string, files: string[], left: number) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set())
  const [expanded, setExpanded] = useState(false)
  const head = useRef<HTMLInputElement>(null)
  const chosen = files.filter((file) => !unchecked.has(file.path))
  const left = files.length - chosen.length
  const all = left === 0
  const none = chosen.length === 0
  useEffect(() => {
    if (head.current) head.current.indeterminate = !all && !none
  }, [all, none])
  const check = (path: string, on: boolean) =>
    setUnchecked((before) => {
      const next = new Set(before)
      if (on) next.delete(path)
      else next.add(path)
      return next
    })
  const long = files.length > SCROLL_FROM
  const state = all
    ? t('worktreeCycle.choose.allChecked', { count: files.length })
    : none
      ? t('worktreeCycle.choose.noneChecked')
      : t('worktreeCycle.choose.someChecked', { checked: chosen.length, count: files.length })
  return (
    <>
      <div className="commit-chooser" data-testid={`${testid}-chooser`}>
        <div className="commit-chooser-head">
          <input
            ref={head}
            type="checkbox"
            className="changes-check"
            checked={all}
            onChange={() => setUnchecked(all ? new Set(files.map((f) => f.path)) : new Set())}
            aria-label={t('worktreeCycle.choose.toggleAll')}
            data-testid={`${testid}-check-all`}
          />
          <span data-testid={`${testid}-count`}>
            {t('worktreeCycle.choose.total', { count: files.length })} · <strong>{state}</strong>
          </span>
          <span className="grow" />
          {long && (
            <button
              type="button"
              className="link-button"
              onClick={() => setExpanded((on) => !on)}
              aria-expanded={expanded}
              data-testid={`${testid}-expand`}
            >
              {t(expanded ? 'worktreeCycle.choose.collapse' : 'worktreeCycle.choose.expand')}
            </button>
          )}
        </div>
        <ul
          className={`commit-chooser-list${long && !expanded ? ' scroll' : ''}`}
          aria-label={t('worktreeCycle.choose.files')}
        >
          {files.map((file) => {
            const { dir, name } = splitPath(file.path)
            const on = !unchecked.has(file.path)
            const badge = GIT_BADGES[file.status]
            return (
              <li
                key={file.path}
                className={on ? undefined : 'off'}
                title={file.path}
                data-testid={`${testid}-file`}
                data-path={file.path}
              >
                <input
                  type="checkbox"
                  className="changes-check"
                  checked={on}
                  onChange={(e) => check(file.path, e.target.checked)}
                  aria-label={t('worktreeCycle.commit.select', { path: file.path })}
                  data-testid={`${testid}-check`}
                />
                <span
                  className={`changes-badge ${badge.tone}`}
                  title={t(`changes.badge.${file.status}`)}
                >
                  {badge.letter}
                </span>
                <span className="changes-name">{name}</span>
                <span className="changes-dir">{dir}</span>
                {looksSecret(file.path) && (
                  <span
                    className="commit-chooser-tag"
                    title={t('worktreeCycle.choose.secretHint')}
                    data-testid={`${testid}-secret`}
                  >
                    {t('worktreeCycle.choose.secret')}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
      {left > 0 && !none && (
        <div className="commit-chooser-left" data-testid={`${testid}-left`}>
          <Info size={13} aria-hidden />
          <span>{leftNote(left)}</span>
        </div>
      )}
      <CommitForm
        proposed={none ? '' : proposeCommitMessage(title, chosen)}
        busy={busy}
        testid={testid}
        confirmLabel={confirmLabel}
        {...(none ? { blocked: t('worktreeCycle.choose.none') } : {})}
        onCommit={(message) =>
          onCommit(
            message,
            chosen.map((f) => f.path),
            left
          )
        }
        onCancel={onCancel}
      />
    </>
  )
}
