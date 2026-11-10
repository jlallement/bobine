import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Lock,
  Pencil,
  Plus,
  RotateCw,
  Trash2
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProfileSummary } from '@shared/agent'
import {
  normalizeCommandPrefix,
  type ApprovalGroup,
  type ApprovalGroupView,
  type ApprovalRulesChange,
  type ApprovalRulesRead,
  type ApprovalRulesView,
  type CommandList
} from '@shared/approval-rules'
import { approvalRulesErrorText, OneWordWarning } from '../thread/GlobalRuleSection'
import { ConfirmRow } from './ConfirmRow'
import { SettingsCard, SettingsTitle } from './rows'
import '../../approval-rules.css'

/** Groupes dans l'ordre de Bob IDE ; ceux qui ont une aide la nomment. */
const GROUPS: { id: ApprovalGroup; hint?: boolean; outside?: boolean }[] = [
  { id: 'read', hint: true, outside: true },
  { id: 'edit', hint: true, outside: true },
  { id: 'execute', hint: true },
  { id: 'mcp', hint: true },
  { id: 'mode' },
  { id: 'subtask' },
  { id: 'subagent' },
  { id: 'skill' },
  { id: 'todo' }
]

/** Lignes montrées avant « Tout afficher ». */
const SHOWN = 7

/**
 * Réglages › Agents › <agent> › Approbations (fiche 215, ADR-0044) : les règles de l'agent pour
 * tous les projets, lues dans son fichier par le main. Chaque changement est un clic explicite ; un
 * fichier illisible n'est ni montré ni écrit.
 */
export function ApprovalRulesPage({ profile }: { profile: ProfileSummary }) {
  const { t } = useTranslation()
  const [read, setRead] = useState<ApprovalRulesRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(
    () =>
      window.api.approvalRules
        .get(profile.id)
        .then((next) => {
          setError(null)
          setRead(next)
        })
        .catch((e: Error) => setError(t('approvalRules.error.failed', { message: e.message }))),
    [profile.id, t]
  )
  const reload = () => void load()
  useEffect(() => {
    void load()
  }, [load])
  const openFile = () =>
    window.api.approvalRules
      .open(profile.id)
      .catch((e: Error) => setError(t('approvalRules.error.failed', { message: e.message })))
  /** Applique des changements dans l'ordre ; s'arrête au premier refus, qui est dit. */
  const apply = async (...changes: ApprovalRulesChange[]): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      for (const change of changes) {
        const result = await window.api.approvalRules.change(profile.id, change)
        if (!result.ok) {
          setError(
            `${approvalRulesErrorText(t, result.error)} ${t('approvalRules.error.nothingWritten')}`
          )
          reload()
          return false
        }
        setRead({ ok: true, rules: result.rules })
      }
      return true
    } catch (e) {
      setError(t('approvalRules.error.failed', { message: (e as Error).message }))
      return false
    } finally {
      setBusy(false)
    }
  }
  return (
    <section data-testid="approval-rules-page" data-agent={profile.id}>
      {read?.ok !== false && (
        <p className="settings-row-hint settings-before-card">{t('approvalRules.page.intro')}</p>
      )}
      {error && (
        <div className="settings-note error" role="alert" data-testid="approval-rules-error">
          {error}
        </div>
      )}
      {read && !read.ok ? (
        <>
          <div
            className="settings-banner approvals-banner"
            role="status"
            data-testid="approval-rules-unreadable"
          >
            <AlertTriangle size={16} aria-hidden />
            <span className="approvals-banner-text">
              <strong>{approvalRulesErrorText(t, { code: read.error.code })}</strong>
              <span>{t('approvalRules.page.unreadableHint')}</span>
              {read.error.file && (
                <span>
                  <code>{read.error.file}</code>
                  {read.error.line
                    ? ` · ${t('approvalRules.error.line', { line: read.error.line })}`
                    : ''}
                  {read.error.code === 'unexpected-format' && read.error.detail
                    ? ` : ${read.error.detail}`
                    : ''}
                </span>
              )}
              <span className="approvals-banner-actions">
                {read.error.code !== 'unsupported' && (
                  <button className="btn small" onClick={() => void openFile()}>
                    <ExternalLink size={13} aria-hidden /> {t('approvalRules.page.openFile')}
                  </button>
                )}
                <button className="btn small" onClick={reload} data-testid="approval-rules-reload">
                  <RotateCw size={13} aria-hidden /> {t('approvalRules.page.reload')}
                </button>
              </span>
            </span>
          </div>
          <p className="settings-row-hint">{t('approvalRules.page.cardsHidden')}</p>
        </>
      ) : (
        read?.ok && (
          <Rules rules={read.rules} busy={busy} apply={apply} onOpenFile={() => void openFile()} />
        )
      )}
    </section>
  )
}

function Rules({
  rules,
  busy,
  apply,
  onOpenFile
}: {
  rules: ApprovalRulesView
  busy: boolean
  apply: (...changes: ApprovalRulesChange[]) => Promise<boolean>
  onOpenFile: () => void
}) {
  const { t } = useTranslation()
  const group = (id: ApprovalGroup) => rules.groups.find((g) => g.id === id)
  return (
    <>
      <SettingsCard testId="approval-rules-file">
        <div className="approvals-file">
          <FileText size={15} aria-hidden />
          <code data-testid="approval-rules-path">{rules.file}</code>
          {rules.exists && (
            <button className="btn small" onClick={onOpenFile} data-testid="approval-rules-open">
              <ExternalLink size={13} aria-hidden /> {t('approvalRules.page.openFile')}
            </button>
          )}
        </div>
      </SettingsCard>
      {!rules.autoApprovalEnabled && (
        <div className="settings-note warn" data-testid="approval-rules-auto-off">
          {t('approvalRules.page.autoOff')}
        </div>
      )}
      <SettingsTitle>{t('approvalRules.page.groups')}</SettingsTitle>
      <SettingsCard testId="approval-rules-groups">
        {GROUPS.map(({ id, hint, outside }) => {
          const view = group(id)
          if (!view) return null
          return (
            <GroupRows
              key={id}
              view={view}
              hint={
                hint
                  ? t(`approvalRules.page.group.${id}Hint` as 'approvalRules.page.group.readHint')
                  : undefined
              }
              outside={outside === true}
              outsideAllowed={rules.outsideWorkspaceAllowed}
              busy={busy}
              onGroup={(enabled) => void apply({ type: 'setGroup', group: id, enabled })}
              onOutside={(enabled) =>
                void apply(
                  // Bob bloque tout outil hors du dossier tant que `outsideWorkspaceAllowed` est
                  // faux : l'option du groupe l'active aussi (comme Bob IDE), jamais l'inverse.
                  ...(enabled && !rules.outsideWorkspaceAllowed
                    ? [{ type: 'setOutsideWorkspaceAllowed', enabled: true } as const]
                    : []),
                  { type: 'setGroupOutsideWorkspace', group: id, enabled }
                )
              }
            />
          )
        })}
        {/* Le global reste allumé une fois les options des groupes éteintes : on le dit (fiche 215). */}
        {rules.outsideWorkspaceAllowed && !rules.groups.some((g) => g.outsideWorkspace) && (
          <div
            className="settings-note approvals-card-note"
            data-testid="approval-outside-still-on"
          >
            {t('approvalRules.page.outsideStillOn')}{' '}
            <button
              className="link-button"
              disabled={busy}
              onClick={() => void apply({ type: 'setOutsideWorkspaceAllowed', enabled: false })}
              data-testid="approval-outside-turn-off"
            >
              {t('approvalRules.page.outsideTurnOff')}
            </button>
          </div>
        )}
      </SettingsCard>
      <CommandsCard rules={rules} list="allowed" busy={busy} apply={apply} />
      <CommandsCard rules={rules} list="denied" busy={busy} apply={apply} />
      <p className="settings-row-hint settings-after-card">{t('approvalRules.page.deniedHint')}</p>
    </>
  )
}

function GroupRows({
  view,
  hint,
  outside,
  outsideAllowed,
  busy,
  onGroup,
  onOutside
}: {
  view: ApprovalGroupView
  hint: string | undefined
  outside: boolean
  /** `outsideWorkspaceAllowed` : faux, activer l'option du groupe l'allume aussi (dit ici). */
  outsideAllowed: boolean
  busy: boolean
  onGroup: (enabled: boolean) => void
  onOutside: (enabled: boolean) => void
}) {
  const { t } = useTranslation()
  const label = t(`approvalRules.page.group.${view.id}`)
  // Groupe interdit par l'administration : jamais permis par Bobine ; le couper reste possible.
  const locked = view.forbidden && !view.enabled
  return (
    <>
      <div className="settings-row" data-testid="approval-group" data-group={view.id}>
        <div className="settings-row-text">
          <div className="settings-row-label">{label}</div>
          {hint && <div className="settings-row-hint">{hint}</div>}
          {view.forbidden && (
            <div
              className="settings-row-hint approvals-lock"
              data-testid="approval-group-forbidden"
            >
              <Lock size={12} aria-hidden /> {t('approvalRules.page.forbidden')}
            </div>
          )}
        </div>
        <div className="settings-row-control">
          <label className="switch">
            <input
              type="checkbox"
              checked={view.enabled}
              disabled={busy || locked}
              onChange={(e) => onGroup(e.target.checked)}
              aria-label={label}
              data-testid="approval-group-switch"
            />
            <span />
          </label>
        </div>
      </div>
      {outside && (
        <div className="settings-row sub">
          <div className="settings-row-text">
            <div className="settings-row-label">{t('approvalRules.page.outside')}</div>
            {!outsideAllowed && !view.outsideWorkspace && !locked && (
              <div className="settings-row-hint" data-testid="approval-outside-effect">
                {t('approvalRules.page.outsideEffect')}
              </div>
            )}
          </div>
          <div className="settings-row-control">
            <label className="switch">
              <input
                type="checkbox"
                checked={view.outsideWorkspace}
                disabled={busy || locked}
                onChange={(e) => onOutside(e.target.checked)}
                aria-label={t('approvalRules.page.outsideLabel', { group: label })}
                data-testid="approval-group-outside"
              />
              <span />
            </label>
          </div>
        </div>
      )}
    </>
  )
}

function CommandsCard({
  rules,
  list,
  busy,
  apply
}: {
  rules: ApprovalRulesView
  list: CommandList
  busy: boolean
  apply: (...changes: ApprovalRulesChange[]) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const [all, setAll] = useState(false)
  const [editing, setEditing] = useState<{ command: string; text: string } | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  // Préfixe d'un seul mot à autoriser : avertissement et confirmation explicite (recette QA).
  const [oneWord, setOneWord] = useState<{ word: string; run: () => Promise<void> } | null>(null)
  /** Autoriser un seul mot (`git`) partout se confirme ; refuser, non. */
  const confirmed = (text: string, run: () => Promise<void>) => {
    const normalized = normalizeCommandPrefix(text)
    if (list === 'allowed' && normalized?.singleWord) {
      setOneWord({ word: normalized.prefix, run })
      return
    }
    void run()
  }
  // Les plus récentes en tête (ajoutées en fin de liste par Bob IDE comme par Bobine).
  const commands = [...rules.commands[list]].reverse()
  const shown = all ? commands : commands.slice(0, SHOWN)
  const title = t(list === 'allowed' ? 'approvalRules.page.allowed' : 'approvalRules.page.denied')
  const defaultList = list === 'allowed' && rules.commands.defaultList
  const add = async () => {
    if (await apply({ type: 'addCommand', prefix: draft, list })) setDraft('')
  }
  const confirmOneWord = oneWord && (
    <div className="approvals-one-word" data-testid="approval-rules-one-word">
      <OneWordWarning word={oneWord.word} />
      <ConfirmRow
        message={t('approvalRules.page.oneWordConfirm', { word: oneWord.word })}
        action={t('approvalRules.card.confirmOneWord')}
        onConfirm={() => {
          const { run } = oneWord
          setOneWord(null)
          void run()
        }}
        onCancel={() => setOneWord(null)}
      />
    </div>
  )
  const save = async () => {
    if (!editing) return
    // Vérifié avant de retirer l'ancienne : jamais une commande perdue sur une saisie vide.
    if (!normalizeCommandPrefix(editing.text)) {
      setInvalid(true)
      return
    }
    const done = await apply(
      { type: 'removeCommand', prefix: editing.command, list },
      { type: 'addCommand', prefix: editing.text, list }
    )
    if (done) setEditing(null)
  }
  return (
    <>
      <SettingsTitle>
        {title}
        {defaultList && (
          <span className="approvals-badge" data-testid="approval-rules-default-badge">
            {t('approvalRules.page.defaultBadge')}
          </span>
        )}
      </SettingsTitle>
      <SettingsCard testId={`approval-rules-${list}`}>
        <form
          className="approvals-add"
          onSubmit={(e) => {
            e.preventDefault()
            confirmed(draft, add)
          }}
        >
          <input
            className="settings-input"
            value={draft}
            spellCheck={false}
            placeholder={t('approvalRules.page.placeholder')}
            aria-label={t('approvalRules.page.addLabel', { list: title })}
            onChange={(e) => {
              setOneWord(null)
              setDraft(e.target.value)
            }}
            data-testid="approval-rules-add-input"
          />
          <button
            type="submit"
            className="btn small"
            disabled={busy || !draft.trim()}
            data-testid="approval-rules-add"
          >
            <Plus size={13} aria-hidden /> {t('approvalRules.page.add')}
          </button>
        </form>
        {!editing && confirmOneWord}
        {defaultList && (
          <div
            className="settings-note approvals-card-note"
            data-testid="approval-rules-default-note"
          >
            {t('approvalRules.page.defaultNote')}
          </div>
        )}
        <ul className="approvals-list">
          {commands.length === 0 && (
            <li className="approvals-command settings-row-hint">{t('approvalRules.page.none')}</li>
          )}
          {shown.map((command) =>
            editing?.command === command ? (
              <li key={command} className="approvals-command">
                <form
                  className="approvals-edit"
                  onSubmit={(e) => {
                    e.preventDefault()
                    confirmed(editing.text, save)
                  }}
                >
                  <input
                    className="settings-input"
                    autoFocus
                    value={editing.text}
                    spellCheck={false}
                    aria-label={t('approvalRules.page.editLabel', { command })}
                    onChange={(e) => {
                      setInvalid(false)
                      setEditing({ command, text: e.target.value })
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Escape') return
                      e.stopPropagation()
                      setEditing(null)
                    }}
                    data-testid="approval-rules-edit-input"
                  />
                  <button type="submit" className="btn small" disabled={busy}>
                    {t('common.save')}
                  </button>
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={() => setEditing(null)}
                  >
                    {t('common.cancel')}
                  </button>
                  {invalid && (
                    <span className="global-rule-error" role="alert">
                      {t('approvalRules.error.invalid-command')}
                    </span>
                  )}
                </form>
                {confirmOneWord}
              </li>
            ) : (
              <li key={command} data-testid="approval-rules-command" data-command={command}>
                <div className="approvals-command">
                  <code>{command}</code>
                  <button
                    className="icon-button"
                    disabled={busy}
                    onClick={() => setEditing({ command, text: command })}
                    aria-label={t('approvalRules.page.editLabel', { command })}
                    title={t('approvalRules.page.editLabel', { command })}
                    data-testid="approval-rules-edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={busy}
                    onClick={() => setRemoving(command)}
                    aria-label={t('approvalRules.page.removeLabel', { command })}
                    title={t('approvalRules.page.removeLabel', { command })}
                    data-testid="approval-rules-remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {removing === command && (
                  <ConfirmRow
                    message={t('approvalRules.page.removeConfirm', { command })}
                    action={t('approvalRules.page.remove')}
                    onConfirm={() => {
                      setRemoving(null)
                      void apply({ type: 'removeCommand', prefix: command, list })
                    }}
                    onCancel={() => setRemoving(null)}
                  />
                )}
              </li>
            )
          )}
        </ul>
        {commands.length > SHOWN && (
          <div className="approvals-list-foot">
            <span data-testid="approval-rules-count">
              {t('approvalRules.page.count', { count: commands.length })}
            </span>
            {!all && (
              <button
                className="link-button"
                onClick={() => setAll(true)}
                data-testid="approval-rules-show-all"
              >
                {t('approvalRules.page.showAll')}
              </button>
            )}
          </div>
        )}
        {list === 'allowed' && (
          <div className="settings-note approvals-card-note" data-testid="approval-rules-security">
            {t('approvalRules.page.securityNote')}
          </div>
        )}
      </SettingsCard>
    </>
  )
}
