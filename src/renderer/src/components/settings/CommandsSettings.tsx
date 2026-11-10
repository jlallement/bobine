import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  ARGUMENTS_PLACEHOLDER,
  PROJECT_COMMANDS_DIR,
  USER_COMMAND_NAME,
  type UserCommand
} from '@shared/user-commands'
import { Trans, useTranslation } from 'react-i18next'
import { useDisplayPath } from '../../presentation'
import { ConfirmRow, useConfirm } from './ConfirmRow'

interface Draft {
  previousName?: string
  name: string
  description: string
  hint: string
  prompt: string
}

const empty: Draft = { name: '', description: '', hint: '', prompt: '' }

/**
 * Réglages › Commandes (fiche 045) : commandes « / » personnelles (tous les dossiers), et celles
 * du projet de la conversation (lecture seule : ce sont des fichiers du dossier).
 */
export function CommandsSettings({
  commands,
  projectCommands,
  workspace,
  onChange
}: {
  commands: UserCommand[]
  projectCommands: UserCommand[]
  workspace: string
  onChange: (commands: UserCommand[]) => void
}) {
  const { t } = useTranslation()
  const displayPath = useDisplayPath()
  const [draft, setDraft] = useState<Draft | null>(null)
  const confirm = useConfirm()
  const name = draft?.name.trim().toLowerCase() ?? ''
  const nameOk = USER_COMMAND_NAME.test(name)
  const taken = !!draft && name !== draft.previousName && commands.some((c) => c.name === name)
  const canSave = !!draft && nameOk && !taken && draft.prompt.trim().length > 0

  const save = () => {
    if (!draft || !canSave) return
    const next: UserCommand = {
      name,
      description: draft.description.trim(),
      ...(draft.hint.trim() ? { hint: draft.hint.trim() } : {}),
      prompt: draft.prompt.trim(),
      scope: 'global'
    }
    const others = commands.filter((c) => c.name !== draft.previousName && c.name !== name)
    onChange([...others, next].sort((a, b) => a.name.localeCompare(b.name)))
    setDraft(null)
  }

  return (
    <div className="mcp-settings commands-settings" data-testid="commands-settings">
      <p className="settings-row-hint">
        <Trans
          t={t}
          i18nKey="settings.commands.intro"
          values={{ placeholder: ARGUMENTS_PLACEHOLDER }}
          components={{ code: <code /> }}
        />
      </p>
      {commands.length === 0 && !draft ? (
        <p className="settings-row-hint">{t('settings.commands.none')}</p>
      ) : (
        <ul className="settings-list mcp-list" data-testid="commands-list">
          {commands.map((command) => (
            <li key={command.name} data-testid="command-item" data-name={command.name}>
              <div className="mcp-server-text">
                <div className="mcp-server-name">
                  /{command.name}
                  {command.hint && <span className="mcp-badge">{command.hint}</span>}
                </div>
                <div className="mcp-server-detail" title={command.prompt}>
                  {command.description || command.prompt}
                </div>
              </div>
              <button
                className="icon-button small"
                aria-label={t('settings.commands.editLabel', { name: command.name })}
                title={t('settings.commands.edit')}
                onClick={() =>
                  setDraft({
                    previousName: command.name,
                    name: command.name,
                    description: command.description,
                    hint: command.hint ?? '',
                    prompt: command.prompt
                  })
                }
                data-testid="command-edit"
              >
                <Pencil size={13} />
              </button>
              <button
                className="icon-button small"
                aria-label={t('settings.commands.removeLabel', { name: command.name })}
                aria-expanded={confirm.asking === command.name}
                title={t('settings.commands.remove')}
                onClick={() => confirm.ask(command.name)}
                data-testid="command-remove"
              >
                <Trash2 size={13} />
              </button>
              {confirm.asking === command.name && (
                <ConfirmRow
                  message={t('settings.commands.removeAsk', { name: command.name })}
                  action={t('settings.commands.remove')}
                  onConfirm={() => {
                    confirm.done()
                    onChange(commands.filter((c) => c.name !== command.name))
                  }}
                  onCancel={confirm.done}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {draft ? (
        <form
          className="mcp-form commands-form"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
          data-testid="command-form"
        >
          <div className="mcp-form-title">
            {draft.previousName
              ? t('settings.commands.form.editTitle', { name: draft.previousName })
              : t('settings.commands.form.newTitle')}
          </div>
          <label>
            <span>{t('settings.commands.form.name')}</span>
            <input
              autoFocus
              value={draft.name}
              placeholder={t('settings.commands.form.namePlaceholder')}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              data-testid="command-name"
            />
          </label>
          {draft.name && !nameOk && (
            <p className="settings-row-hint">{t('settings.commands.form.nameRule')}</p>
          )}
          {taken && (
            <p className="settings-row-hint">{t('settings.commands.form.taken', { name })}</p>
          )}
          <label>
            <span>{t('settings.commands.form.description')}</span>
            <input
              value={draft.description}
              placeholder={t('settings.commands.form.descriptionPlaceholder')}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              data-testid="command-description"
            />
          </label>
          <label>
            <span>{t('settings.commands.form.hint')}</span>
            <input
              value={draft.hint}
              placeholder={t('settings.commands.form.hintPlaceholder')}
              onChange={(e) => setDraft({ ...draft, hint: e.target.value })}
              data-testid="command-hint"
            />
          </label>
          <label>
            <span>{t('settings.commands.form.prompt')}</span>
            <textarea
              value={draft.prompt}
              rows={4}
              placeholder={t('settings.commands.form.promptPlaceholder', {
                placeholder: ARGUMENTS_PLACEHOLDER
              })}
              onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
              data-testid="command-prompt"
            />
          </label>
          <div className="mcp-form-actions">
            <button type="button" className="btn small ghost" onClick={() => setDraft(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn small primary"
              disabled={!canSave}
              data-testid="command-save"
            >
              {t('common.save')}
            </button>
          </div>
        </form>
      ) : (
        <button className="btn small" onClick={() => setDraft(empty)} data-testid="command-add">
          <Plus size={13} /> {t('settings.commands.add')}
        </button>
      )}
      <h3 className="commands-project-title">{t('settings.commands.project.title')}</h3>
      <p className="settings-row-hint">
        <Trans
          t={t}
          i18nKey="settings.commands.project.intro"
          values={{ dir: `${displayPath(workspace.replace(/\/$/, ''))}/${PROJECT_COMMANDS_DIR}/` }}
          components={{ code: <code /> }}
        />
      </p>
      {projectCommands.length === 0 ? (
        <p className="settings-row-hint">{t('settings.commands.project.none')}</p>
      ) : (
        <ul className="settings-list mcp-list" data-testid="project-commands-list">
          {projectCommands.map((command) => (
            <li key={command.name} data-testid="project-command" data-name={command.name}>
              <div className="mcp-server-text">
                <div className="mcp-server-name">
                  /{command.name}
                  {command.hint && <span className="mcp-badge">{command.hint}</span>}
                  <span className="mcp-badge">{t('settings.commands.project.badge')}</span>
                </div>
                <div className="mcp-server-detail" title={command.file ?? ''}>
                  {command.description}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
