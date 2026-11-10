import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Pencil, Trash, TriangleAlert } from 'lucide-react'
import { currentLocale } from '@shared/i18n/format'
import {
  commandPassages,
  MEMORY_LIMITS,
  MEMORY_TYPES,
  type MemoryEntryView,
  type MemoryPlace,
  type MemoryType
} from '@shared/memory'
import { ipcErrorText } from '../../ipc-errors'
import { Highlighted } from '../common/Highlighted'
import { Markdown } from '../thread/Markdown'
import { ConfirmRow } from './ConfirmRow'

/**
 * Qui l'a proposé : l'agent (« OpenCode, conversation 1a2b3c4d » → « OpenCode »), vous, ou
 * inconnu (fichier posé hors de Bobine, sans en-tête `by`).
 */
const author = (entry: MemoryEntryView, you: string, unknown: string) =>
  // Non validé : l'en-tête `by` a pu être écrit par n'importe qui, il ne prouve rien.
  !entry.approved || !entry.by
    ? unknown
    : entry.by === 'user'
      ? you
      : (entry.by.split(',')[0] ?? entry.by)

const dateText = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(currentLocale(), {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      })
}

/**
 * Un souvenir de Réglages › Mémoire (fiche 182) : une ligne qui se déplie sur place (lecture, puis
 * Modifier), un seul à la fois, Échap la replie. Mêmes validations que l'outil de l'agent ; une
 * version changée entre-temps n'est pas écrasée.
 */
export function MemoryEntryRow({
  entry,
  place,
  open,
  onToggle,
  moveTo,
  onChanged
}: {
  entry: MemoryEntryView
  place: MemoryPlace
  open: boolean
  onToggle: () => void
  /** Autre mémoire où le déplacer (« Vous » ↔ ce projet), si elle existe. */
  moveTo: MemoryPlace | undefined
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string>()
  const fail = (e: unknown) => setError(ipcErrorText(e))
  return (
    <div
      className={`memory-entry${open ? ' open' : ''}`}
      data-testid="memory-entry"
      data-name={entry.name}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return
        // Échap replie le souvenir, pas la fenêtre des réglages.
        event.stopPropagation()
        setEditing(false)
        onToggle()
      }}
    >
      <button
        type="button"
        className="memory-entry-head"
        aria-expanded={open}
        onClick={() => {
          setEditing(false)
          onToggle()
        }}
      >
        <ChevronRight size={13} className="memory-entry-chevron" aria-hidden />
        <span className="memory-entry-text">
          <span className="memory-entry-description">
            {entry.approved ? (
              entry.description
            ) : (
              <Highlighted text={entry.description} passages={commandPassages(entry.description)} />
            )}
          </span>
          <span className="memory-entry-meta">
            <span className="memory-chip">{t(`memory.type.${entry.type}`)}</span>
            {!entry.approved && (
              <span className="memory-chip warn" data-testid="memory-outside">
                <TriangleAlert size={11} aria-hidden />
                {t('settings.memory.outside')}
              </span>
            )}
            {entry.source === 'external' && (
              <span className="memory-chip warn">
                <TriangleAlert size={11} aria-hidden />
                {t('settings.memory.external')}
              </span>
            )}
            <span>{`${dateText(entry.updated)} · ${author(entry, t('settings.memory.byYou'), t('settings.memory.byUnknown'))}`}</span>
          </span>
        </span>
      </button>
      {open && !editing && (
        <div className="memory-entry-detail">
          {!entry.approved && (
            <OutsideBanner
              onKeep={() =>
                window.api.memory
                  .approve(place, entry.name, entry.version)
                  .then((result) =>
                    result.ok
                      ? onChanged()
                      : setError(
                          t(
                            result.reason === 'secret'
                              ? 'settings.memory.secret'
                              : result.reason === 'locked'
                                ? 'settings.memory.keyLocked'
                                : 'settings.memory.changedAside'
                          )
                        )
                  )
                  .catch(fail)
              }
            />
          )}
          <MemoryText entry={entry} />
          <dl className="memory-provenance">
            <dt>{t('settings.memory.proposedBy')}</dt>
            <dd>{author(entry, t('settings.memory.byYou'), t('settings.memory.byUnknown'))}</dd>
            <dt>{t('settings.memory.updated')}</dt>
            <dd>{dateText(entry.updated)}</dd>
            <dt>{t('settings.memory.file')}</dt>
            <dd className="mono">{`${entry.name}.md`}</dd>
          </dl>
          <div className="memory-actions">
            <button
              type="button"
              className="btn small"
              onClick={() => setEditing(true)}
              data-testid="memory-edit"
            >
              <Pencil size={13} aria-hidden />
              {t('settings.memory.edit')}
            </button>
            {moveTo && entry.approved && (
              <button
                type="button"
                className="btn small"
                onClick={() =>
                  window.api.memory
                    .move(place, moveTo, entry.name, entry.version)
                    .then((result) =>
                      result.ok
                        ? onChanged()
                        : setError(t(`settings.memory.moveError.${result.reason}`))
                    )
                    .catch(fail)
                }
                data-testid="memory-move"
              >
                {t(
                  moveTo.scope === 'user'
                    ? 'settings.memory.moveToYou'
                    : 'settings.memory.moveToProject'
                )}
              </button>
            )}
            <span className="grow" />
            <button
              type="button"
              className="btn small"
              onClick={() => setDeleting((on) => !on)}
              data-testid="memory-delete"
            >
              <Trash size={13} aria-hidden />
              {t('settings.memory.delete')}
            </button>
          </div>
          {deleting && (
            <ConfirmRow
              message={t('settings.memory.deleteConfirm', { description: entry.description })}
              action={t('settings.memory.delete')}
              onConfirm={() => {
                setDeleting(false)
                window.api.memory
                  .remove(place, entry.name, entry.version)
                  .then((ok) => (ok ? onChanged() : setError(t('settings.memory.changedAside'))))
                  .catch(fail)
              }}
              onCancel={() => setDeleting(false)}
            />
          )}
          {error && <div className="memory-error">{error}</div>}
        </div>
      )}
      {open && editing && !entry.approved && (
        <div className="memory-entry-detail memory-editor-outside">
          <OutsideBanner />
        </div>
      )}
      {open && editing && (
        <MemoryEditor
          entry={entry}
          place={place}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

/**
 * Souvenir modifié hors de Bobine : plus donné aux agents tant qu'il n'est pas relu ; « Garder
 * ces modifications » le valide (absent pendant la modification : enregistrer valide aussi).
 */
function OutsideBanner({ onKeep }: { onKeep?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="memory-banner memory-outside" data-testid="memory-outside-banner">
      <TriangleAlert size={14} aria-hidden />
      <span>
        {t('settings.memory.outsideNotice')}
        {onKeep && (
          <>
            {' '}
            <button
              type="button"
              className="link-button"
              onClick={onKeep}
              data-testid="memory-approve"
            >
              {t('settings.memory.keepChanges')}
            </button>
          </>
        )}
      </span>
    </div>
  )
}

/**
 * Texte d'un souvenir : Markdown rendu ; non validé, en texte brut avec les commandes repérées
 * surlignées, pour relire ce qu'on va garder.
 */
function MemoryText({ entry }: { entry: MemoryEntryView }) {
  const passages = commandPassages(entry.body)
  if (entry.approved || passages.length === 0) {
    return (
      <div className="memory-body">
        <Markdown text={entry.body} />
      </div>
    )
  }
  return (
    <div className="memory-body memory-body-plain">
      <Highlighted text={entry.body} passages={passages} />
    </div>
  )
}

/** Modification sur place : description, type, texte ; refus (format, secret) sous le champ. */
function MemoryEditor({
  entry,
  place,
  onCancel,
  onSaved
}: {
  entry: MemoryEntryView
  place: MemoryPlace
  onCancel: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [description, setDescription] = useState(entry.description)
  const [type, setType] = useState<MemoryType>(entry.type)
  const [body, setBody] = useState(entry.body)
  const [error, setError] = useState<{ field?: 'description' | 'body'; text: string }>()
  const [changed, setChanged] = useState(false)
  const save = () => {
    window.api.memory
      .save(place, { name: entry.name, description, type, body }, entry.version)
      .then((result) => {
        if (result.ok) return onSaved()
        if ('changed' in result) return setChanged(true)
        const code = result.error.code
        setError({
          ...(code === 'description' ? { field: 'description' as const } : {}),
          ...(code === 'body' || code === 'secret' ? { field: 'body' as const } : {}),
          text:
            code === 'secret'
              ? t('settings.memory.secret')
              : code === 'locked'
                ? t('settings.memory.keyLocked')
                : t(
                    `settings.memory.invalid.${code === 'description' ? 'description' : code === 'body' ? 'body' : 'other'}`,
                    {
                      description: MEMORY_LIMITS.description,
                      body: MEMORY_LIMITS.body
                    }
                  )
        })
      })
      .catch((e: unknown) => setError({ text: ipcErrorText(e) }))
  }
  return (
    <div className="memory-entry-detail memory-editor" data-testid="memory-editor">
      <label className="memory-field">
        <span>{t('settings.memory.description')}</span>
        <input
          className={`settings-input${error?.field === 'description' ? ' invalid' : ''}`}
          value={description}
          maxLength={MEMORY_LIMITS.description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label className="memory-field">
        <span>{t('settings.memory.type')}</span>
        <select
          className="settings-input"
          value={type}
          onChange={(e) => setType(e.target.value as MemoryType)}
        >
          {MEMORY_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(`memory.type.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="memory-field">
        <span>{t('settings.memory.text')}</span>
        <textarea
          className={`settings-input${error?.field === 'body' ? ' invalid' : ''}`}
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          data-testid="memory-editor-body"
        />
      </label>
      {error && (
        <div className="memory-error" data-testid="memory-editor-error">
          {error.text}
        </div>
      )}
      {changed && (
        <div className="memory-banner" data-testid="memory-editor-changed">
          <TriangleAlert size={14} aria-hidden />
          <span>
            {t('settings.memory.changedWhileEditing')}{' '}
            <button type="button" className="link-button" onClick={onSaved}>
              {t('settings.memory.reload')}
            </button>
          </span>
        </div>
      )}
      <div className="memory-actions memory-actions-end">
        <button type="button" className="btn small ghost" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn small primary"
          disabled={changed}
          onClick={save}
          data-testid="memory-editor-save"
        >
          {t('settings.memory.save')}
        </button>
      </div>
    </div>
  )
}
