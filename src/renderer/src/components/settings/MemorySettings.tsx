import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FolderOpen, Link, TriangleAlert } from 'lucide-react'
import type { AgentSettingsView } from '@shared/agent'
import type {
  MemoryEntryView,
  MemoryKeyState,
  MemoryPlace,
  MemoryProjectView
} from '@shared/memory'
import type { Preferences } from '@shared/preferences'
import { ipcErrorText } from '../../ipc-errors'
import { takeMemoryFocus } from '../../memory-focus'
import { ConfirmRow } from './ConfirmRow'
import { MemoryEntryRow } from './MemoryEntryRow'
import { Row, SettingsCard, SettingsTitle } from './rows'
import '../../memory.css'

/** Mémoire d'une clé du sélecteur : `user`, ou l'identifiant du projet. */
const placeOf = (key: string): MemoryPlace =>
  key === 'user' ? { scope: 'user' } : { scope: 'project', projectId: key }

/** Nom lisible d'un projet : le dernier dossier de son chemin, sinon son identifiant. */
const projectName = (project: MemoryProjectView) =>
  project.paths[0]?.split('/').filter(Boolean).at(-1) ?? project.id

/**
 * Réglages › Mémoire (fiche 182, ADR-0040) : le réglage, puis les souvenirs d'une mémoire (« Vous »
 * ou un projet). L'utilisateur lit, modifie, déplace, supprime, exporte, sans autre accord ;
 * confirmation seulement pour Supprimer et Tout effacer. Désactivée : tout reste lisible.
 */
export function MemorySettings({
  settings,
  onPreferences
}: {
  settings: AgentSettingsView
  onPreferences: (change: Partial<Preferences>) => void
}) {
  const { t } = useTranslation()
  const enabled = settings.preferences.memoryEnabled
  const [projects, setProjects] = useState<MemoryProjectView[]>([])
  const [current, setCurrent] = useState<string>()
  const [keyState, setKeyState] = useState<MemoryKeyState>('ok')
  const [key, setKey] = useState<string>()
  const [entries, setEntries] = useState<MemoryEntryView[]>([])
  const [broken, setBroken] = useState<string[]>([])
  const [open, setOpen] = useState<string | undefined>(() => takeMemoryFocus())
  const [note, setNote] = useState<string>()
  const [clearing, setClearing] = useState(false)
  const fail = (e: unknown) => setNote(ipcErrorText(e))

  const loadProjects = useCallback(() => {
    window.api.memory
      .projects(settings.workspace)
      .then((result) => {
        setProjects(result.projects)
        setCurrent(result.current)
        setKeyState(result.keyState)
        // Ouvert sur le projet de la conversation en cours, sinon sur « Vous ».
        setKey((key) => key ?? result.current ?? 'user')
      })
      .catch(fail)
  }, [settings.workspace])

  const load = useCallback(() => {
    if (!key) return
    window.api.memory
      .list(placeOf(key))
      .then((list) => {
        setEntries(list.entries)
        setBroken(list.broken)
      })
      .catch(fail)
  }, [key])

  useEffect(loadProjects, [loadProjects])
  useEffect(load, [load])

  const refresh = () => {
    load()
    loadProjects()
  }
  const place = key ? placeOf(key) : undefined
  const project = projects.find((p) => p.id === key)
  const userCount = key === 'user' ? entries.length : undefined
  const missing = projects.filter((p) => p.missing)
  const found = projects.filter((p) => !p.missing)
  // Le projet de la conversation en cours, s'il n'a pas encore de mémoire : choisissable quand même.
  const currentShown = current && !projects.some((p) => p.id === current)

  return (
    <section data-testid="memory-settings">
      <SettingsCard>
        <Row
          label={t('settings.memory.enabled.label')}
          hint={t(enabled ? 'settings.memory.enabled.hint' : 'settings.memory.enabled.hintOff')}
        >
          <label className="switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onPreferences({ memoryEnabled: e.target.checked })}
              data-testid="settings-memory-enabled"
            />
            <span />
          </label>
        </Row>
      </SettingsCard>
      <p className="memory-note">{t('settings.memory.where')}</p>
      {(keyState === 'locked' || keyState === 'recreated') && (
        // La vraie cause, une fois : sinon chaque souvenir paraîtrait « Modifié hors de Bobine ».
        <div
          className="notice notice-warning memory-key-notice"
          role="status"
          data-testid="memory-key-notice"
        >
          <TriangleAlert size={15} aria-hidden />
          <span>
            {t(
              keyState === 'locked' ? 'settings.memory.keyLocked' : 'settings.memory.keyRecreated'
            )}
          </span>
        </div>
      )}

      <SettingsTitle help="memory">{t('settings.memory.entries')}</SettingsTitle>
      <div className="memory-picker">
        <select
          className="settings-input settings-input-wide"
          value={key ?? 'user'}
          onChange={(e) => {
            setKey(e.target.value)
            setOpen(undefined)
            setNote(undefined)
          }}
          aria-label={t('settings.memory.picker')}
          data-testid="memory-picker"
        >
          <option value="user">
            {t('settings.memory.you')}
            {userCount !== undefined ? ` (${userCount})` : ''}
          </option>
          <optgroup label={t('settings.memory.projects')}>
            {currentShown && <option value={current}>{t('settings.memory.thisProject')}</option>}
            {found.map((p) => (
              <option key={p.id} value={p.id}>
                {`${projectName(p)} (${p.count})`}
              </option>
            ))}
          </optgroup>
          {missing.length > 0 && (
            <optgroup label={t('settings.memory.missing')}>
              {missing.map((p) => (
                <option key={p.id} value={p.id}>
                  {`${projectName(p)} (${p.count})`}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {project && <span className="memory-picker-path">{project.paths.join(', ')}</span>}
      </div>

      {project?.missing && (
        <div className="memory-missing" data-testid="memory-missing">
          <span>{t('settings.memory.missingHint')}</span>
          <button
            type="button"
            className="btn small"
            onClick={() =>
              window.api.memory
                .attach(project.id)
                .then((count) => {
                  if (count === null) return
                  setNote(t('settings.memory.attached', { count }))
                  setKey(undefined)
                  loadProjects()
                })
                .catch(fail)
            }
            data-testid="memory-attach"
          >
            <Link size={13} aria-hidden />
            {t('settings.memory.attach')}
          </button>
        </div>
      )}

      <div className="settings-card memory-list" data-testid="memory-list">
        {entries.length === 0 && broken.length === 0 && (
          <div className="memory-empty">{t('settings.memory.empty')}</div>
        )}
        {place &&
          entries.map((entry) => (
            <MemoryEntryRow
              key={entry.name}
              entry={entry}
              place={place}
              open={open === entry.name}
              onToggle={() => setOpen((name) => (name === entry.name ? undefined : entry.name))}
              moveTo={
                place.scope === 'user'
                  ? current
                    ? { scope: 'project', projectId: current }
                    : undefined
                  : { scope: 'user' }
              }
              onChanged={refresh}
            />
          ))}
        {broken.map((file) => (
          <div key={file} className="memory-broken">
            {t('settings.memory.broken', { file: file.replace(/\.broken-.*$/, '') })}
          </div>
        ))}
      </div>

      {place && (
        <div className="memory-actions">
          <button
            type="button"
            className="btn small"
            disabled={entries.length === 0}
            onClick={() =>
              window.api.memory
                .exportTo(place)
                .then((file) => file && setNote(t('settings.memory.exported', { file })))
                .catch(fail)
            }
            data-testid="memory-export"
          >
            <Download size={13} aria-hidden />
            {t('settings.memory.export')}
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() => window.api.memory.reveal(place).catch(fail)}
          >
            <FolderOpen size={13} aria-hidden />
            {t('settings.memory.reveal')}
          </button>
          <span className="grow" />
          <button
            type="button"
            className="btn small"
            disabled={entries.length + broken.length === 0}
            onClick={() => setClearing((on) => !on)}
            data-testid="memory-clear"
          >
            {t('settings.memory.clear')}
          </button>
        </div>
      )}
      {clearing && place && (
        <ConfirmRow
          message={t('settings.memory.clearConfirm', { count: entries.length })}
          action={t('settings.memory.clearAction')}
          onConfirm={() => {
            setClearing(false)
            window.api.memory.clear(place).then(refresh).catch(fail)
          }}
          onCancel={() => setClearing(false)}
        />
      )}
      {note && <p className="memory-note">{note}</p>}
    </section>
  )
}
