import { Check, KeyRound, LoaderCircle, Pencil, PlugZap, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import i18next from 'i18next'
import { Trans, useTranslation } from 'react-i18next'
import { numberFormat } from '@shared/i18n/format'
import {
  modelLines,
  parseModelLines,
  type ModelProvider,
  type ProviderEntry,
  type ProvidersView,
  type ProviderTestResult
} from '@shared/providers'
import { ipcErrorText } from '../../ipc-errors'
import { ConfirmRow, useConfirm } from './ConfirmRow'
import { SettingsTitle } from './rows'

const seconds = (ms: number) => `${numberFormat({ maximumFractionDigits: 1 }).format(ms / 1000)} s`

type TestStatus = ProviderTestResult | 'testing'

/**
 * Page d'un agent › Fournisseurs de modèles (fiches 104, 136) : pour chaque agent qui en déclare le
 * format (OpenCode), les points d'accès compatibles OpenAI de son fichier, à ajouter, modifier,
 * activer, tester ; la clé chiffrée dans le trousseau. Rien n'est affiché pour un agent sans
 * fournisseurs modifiables, ni pour un agent qui n'est pas installé.
 */
export function ProvidersSection({ installed }: { installed: readonly string[] }) {
  const { t } = useTranslation()
  const [all, setViews] = useState<ProvidersView[] | null>(null)
  // Seulement les agents installés : un fichier partagé (essais) ne s'affiche pas deux fois.
  const views = all?.filter((v) => installed.includes(v.profileId))
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    window.api.providers
      .list()
      .then((list) => alive && setViews(list))
      .catch((e: unknown) => alive && setError(ipcErrorText(e)))
    return () => {
      alive = false
    }
  }, [])
  if (!error && (!views || views.length === 0)) return null
  return (
    <>
      <SettingsTitle>{t('settings.providers.label')}</SettingsTitle>
      {error && (
        <div className="settings-note error" role="alert">
          {error}
        </div>
      )}
      {views?.map((view) => (
        <AgentProviders key={view.profileId} view={view} onViews={setViews} />
      ))}
      <p className="settings-row-hint">{t('settings.providers.hint')}</p>
    </>
  )
}

/** Formulaire d'un fournisseur : champs texte, convertis à l'enregistrement. */
interface Draft {
  previousId?: string
  id: string
  name: string
  baseURL: string
  /** `identifiant = libellé` par ligne. */
  models: string
  enabled: boolean
}

const toDraft = (entry?: ProviderEntry): Draft =>
  entry
    ? {
        previousId: entry.id,
        id: entry.id,
        name: entry.name === entry.id ? '' : entry.name,
        baseURL: entry.baseURL,
        models: modelLines(entry.models),
        enabled: entry.enabled
      }
    : { id: '', name: '', baseURL: '', models: '', enabled: true }

const fromDraft = (draft: Draft): ModelProvider => ({
  id: draft.id.trim(),
  name: draft.name.trim() || draft.id.trim(),
  baseURL: draft.baseURL.trim(),
  models: parseModelLines(draft.models),
  enabled: draft.enabled
})

function AgentProviders({
  view,
  onViews
}: {
  view: ProvidersView
  onViews: (views: ProvidersView[]) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()
  const [tests, setTests] = useState<Record<string, TestStatus>>({})
  const api = window.api.providers

  const run = (action: Promise<ProvidersView[]>, after?: () => void) => {
    setError(null)
    return action
      .then((list) => {
        onViews(list)
        after?.()
      })
      .catch((e: unknown) => {
        setError(ipcErrorText(e))
        throw e
      })
  }
  const test = async (provider: ProviderEntry) => {
    setTests((prev) => ({ ...prev, [provider.id]: 'testing' }))
    const result = await api
      .test(view.profileId, provider.id)
      .catch((e: unknown): ProviderTestResult => ({
        ok: false,
        cause: 'other',
        error: ipcErrorText(e),
        ms: 0
      }))
    setTests((prev) => ({ ...prev, [provider.id]: result }))
  }

  return (
    <div className="providers-agent" data-testid={`providers-${view.profileId}`}>
      <p className="settings-row-hint">
        <Trans
          t={t}
          i18nKey="settings.providers.file"
          values={{ agent: view.label, file: view.file }}
          components={{ code: <code /> }}
        />
      </p>
      {view.error && (
        <div className="settings-note error" data-testid="providers-file-error">
          {view.error}
        </div>
      )}
      {error && (
        <div className="settings-note error" role="alert" data-testid="providers-error">
          {error}
        </div>
      )}
      {view.providers.length === 0 && !draft ? (
        <p className="settings-row-hint" data-testid="providers-none">
          {t('settings.providers.none', { agent: view.label })}
        </p>
      ) : (
        <ul className="settings-list mcp-list" data-testid="providers-list">
          {view.providers.map((provider) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              status={tests[provider.id]}
              confirming={confirm.asking === provider.id}
              onEnabled={(enabled) =>
                void run(api.setEnabled(view.profileId, provider.id, enabled)).catch(() => {})
              }
              onTest={() => void test(provider)}
              onEdit={() => setDraft(toDraft(provider))}
              onRemove={() => confirm.ask(provider.id)}
              onConfirmRemove={() => {
                confirm.done()
                void run(api.remove(view.profileId, provider.id)).catch(() => {})
              }}
              onCancelRemove={confirm.done}
              onSetKey={(value) => run(api.setKey(view.profileId, provider.id, value))}
              onRemoveKey={() =>
                void run(api.removeKey(view.profileId, provider.id)).catch(() => {})
              }
            />
          ))}
        </ul>
      )}
      {view.providers.length > 0 && (
        <label className="providers-only">
          <input
            type="checkbox"
            checked={view.only}
            onChange={(e) =>
              void run(api.setOnly(view.profileId, e.target.checked)).catch(() => {})
            }
            data-testid="providers-only"
          />
          <span>
            {t('settings.providers.only.label')}
            <small>{t('settings.providers.only.hint', { agent: view.label })}</small>
          </span>
        </label>
      )}
      {draft ? (
        <ProviderForm
          draft={draft}
          agent={view.label}
          onChange={setDraft}
          onCancel={() => {
            setDraft(null)
            setError(null)
          }}
          onSave={() =>
            void run(api.save(view.profileId, fromDraft(draft), draft.previousId), () =>
              setDraft(null)
            ).catch(() => {})
          }
        />
      ) : (
        <div className="mcp-actions">
          <button
            className="btn small"
            onClick={() => setDraft(toDraft())}
            data-testid="providers-add"
          >
            <Plus size={13} /> {t('settings.providers.add')}
          </button>
        </div>
      )}
    </div>
  )
}

/** État de la clé d'un fournisseur, en un mot. */
function keyState(provider: ProviderEntry): string {
  const t = i18next.t
  if (provider.keyUnreadable) return t('settings.providers.key.unreadable')
  if (provider.keyStored) return t('settings.providers.key.stored')
  switch (provider.key.kind) {
    case 'env':
      return provider.keyFromEnvironment
        ? t('settings.providers.key.fromEnv', { env: provider.key.env })
        : t('settings.providers.key.none', { env: provider.key.env })
    case 'plain':
      return t('settings.providers.key.plain')
    case 'file':
      return t('settings.providers.key.file', { path: provider.key.path })
    default:
      return t('settings.providers.key.missing')
  }
}

function ProviderRow({
  provider,
  status,
  confirming,
  onEnabled,
  onTest,
  onEdit,
  onRemove,
  onConfirmRemove,
  onCancelRemove,
  onSetKey,
  onRemoveKey
}: {
  provider: ProviderEntry
  status: TestStatus | undefined
  confirming: boolean
  onEnabled: (enabled: boolean) => void
  onTest: () => void
  onEdit: () => void
  onRemove: () => void
  onConfirmRemove: () => void
  onCancelRemove: () => void
  onSetKey: (value: string) => Promise<void>
  onRemoveKey: () => void
}) {
  const { t } = useTranslation()
  const [editingKey, setEditingKey] = useState(false)
  const [keyValue, setKeyValue] = useState('')
  const [keyError, setKeyError] = useState<string | null>(null)
  const [removingKey, setRemovingKey] = useState(false)
  const dotState = !provider.enabled
    ? 'off'
    : status === undefined
      ? 'unknown'
      : status === 'testing'
        ? 'testing'
        : status.ok
          ? 'ok'
          : 'error'
  const saveKey = () => {
    if (!keyValue.trim()) return
    setKeyError(null)
    onSetKey(keyValue).then(
      () => {
        setKeyValue('')
        setEditingKey(false)
      },
      (e: unknown) => setKeyError(ipcErrorText(e))
    )
  }
  return (
    <li className="provider-row" data-testid="provider" data-id={provider.id}>
      <div className="provider-line">
        <label
          className="switch"
          title={
            provider.enabled ? t('settings.providers.disable') : t('settings.providers.enable')
          }
        >
          <input
            type="checkbox"
            checked={provider.enabled}
            onChange={(e) => onEnabled(e.target.checked)}
            aria-label={t('settings.providers.enabledLabel', { name: provider.name })}
            data-testid="provider-enabled"
          />
          <span />
        </label>
        <div className="mcp-server-text">
          <div className="mcp-server-name">
            <span
              className={`mcp-dot ${dotState}`}
              role="img"
              aria-label={t(`mcp.state.${dotState}`)}
              title={t(`mcp.state.${dotState}`)}
              data-testid="provider-dot"
              data-state={dotState}
            />
            {provider.name}
            <span className="mcp-badge mono">{provider.id}</span>
            {provider.npm && (
              <span className="mcp-badge" title={provider.npm}>
                {t('settings.providers.npm')}
              </span>
            )}
          </div>
          <div className="mcp-server-detail" title={provider.baseURL}>
            <span className="mono">{provider.baseURL}</span>
            {` · ${t('settings.providers.models', { count: provider.models.length })}`}
            {` · ${t('settings.providers.key.label')} : `}
            <span data-testid="provider-key-state">{keyState(provider)}</span>
          </div>
          <ProviderTestLine result={status} />
        </div>
        <button
          className="icon-button small"
          aria-label={t('settings.providers.testLabel', { name: provider.name })}
          title={t('settings.providers.test')}
          disabled={status === 'testing'}
          onClick={onTest}
          data-testid="provider-test"
        >
          <PlugZap size={13} />
        </button>
        <button
          className="icon-button small"
          aria-label={t('settings.providers.key.setLabel', { name: provider.name })}
          title={
            provider.keyStored
              ? t('settings.providers.key.replace')
              : t('settings.providers.key.set')
          }
          onClick={() => setEditingKey((v) => !v)}
          data-testid="provider-key"
        >
          <KeyRound size={13} />
        </button>
        <button
          className="icon-button small"
          aria-label={t('settings.providers.editLabel', { name: provider.name })}
          title={t('settings.providers.edit')}
          onClick={onEdit}
          data-testid="provider-edit"
        >
          <Pencil size={13} />
        </button>
        <button
          className="icon-button small"
          aria-label={t('settings.providers.removeLabel', { name: provider.name })}
          aria-expanded={confirming}
          title={t('settings.providers.remove')}
          onClick={onRemove}
          data-testid="provider-remove"
        >
          <Trash2 size={13} />
        </button>
      </div>
      {confirming && (
        <ConfirmRow
          message={t('settings.providers.removeAsk', { name: provider.name })}
          action={t('settings.providers.remove')}
          onConfirm={onConfirmRemove}
          onCancel={onCancelRemove}
        />
      )}
      {editingKey && (
        <form
          className="api-key-form"
          onSubmit={(event) => {
            event.preventDefault()
            saveKey()
          }}
          data-testid="provider-key-form"
        >
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            value={keyValue}
            placeholder={t('settings.apiKeys.placeholder')}
            onChange={(event) => setKeyValue(event.target.value)}
            data-testid="provider-key-value"
          />
          <button type="submit" className="btn small primary" disabled={!keyValue.trim()}>
            {t('common.save')}
          </button>
          {provider.keyStored && (
            <button
              type="button"
              className="btn small"
              onClick={() => {
                setEditingKey(false)
                setRemovingKey(true)
              }}
              data-testid="provider-key-remove"
            >
              {t('settings.providers.key.remove')}
            </button>
          )}
          <button
            type="button"
            className="btn small ghost"
            onClick={() => {
              setEditingKey(false)
              setKeyValue('')
              setKeyError(null)
            }}
          >
            {t('common.cancel')}
          </button>
        </form>
      )}
      {editingKey && provider.key.kind === 'env' && (
        <div className="api-key-help">
          {t('settings.providers.key.help', { env: provider.key.env })}
        </div>
      )}
      {keyError && <div className="api-key-error">{keyError}</div>}
      {removingKey && (
        <ConfirmRow
          message={t('settings.apiKeys.removeAsk', { name: provider.name })}
          action={t('settings.apiKeys.removeAction')}
          onConfirm={() => {
            setRemovingKey(false)
            onRemoveKey()
          }}
          onCancel={() => setRemovingKey(false)}
        />
      )}
    </li>
  )
}

/** Résultat de « Tester » : répond avec N modèles, ou l'erreur et la marche à suivre. */
export function ProviderTestLine({ result }: { result: TestStatus | undefined }) {
  const { t } = useTranslation()
  if (!result) return null
  if (result === 'testing') {
    return (
      <div className="mcp-test" data-testid="provider-test-result" data-state="testing">
        <LoaderCircle size={12} className="spin" /> {t('settings.providers.testing')}
      </div>
    )
  }
  if (!result.ok) {
    return (
      <div
        className="mcp-test error"
        data-testid="provider-test-result"
        data-state="error"
        data-cause={result.cause}
      >
        <X size={12} />
        <span>
          {result.error}
          <small className="provider-fix">{t(`providers.fix.${result.cause}`)}</small>
        </span>
      </div>
    )
  }
  return (
    <div className="mcp-test ok" data-testid="provider-test-result" data-state="ok">
      <Check size={12} />{' '}
      {t('settings.providers.reachable', {
        models: t('settings.providers.models', { count: result.models }),
        seconds: seconds(result.ms)
      })}
    </div>
  )
}

function ProviderForm({
  draft,
  agent,
  onChange,
  onCancel,
  onSave
}: {
  draft: Draft
  agent: string
  onChange: (draft: Draft) => void
  onCancel: () => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  const set = (change: Partial<Draft>) => onChange({ ...draft, ...change })
  return (
    <form
      className="mcp-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSave()
      }}
      data-testid="provider-form"
    >
      <div className="mcp-form-title">
        {draft.previousId
          ? t('settings.providers.form.editTitle', { name: draft.previousId })
          : t('settings.providers.form.newTitle', { agent })}
      </div>
      <label>
        <span>{t('settings.providers.form.id')}</span>
        <input
          className="mono"
          autoFocus={!draft.previousId}
          value={draft.id}
          placeholder={t('settings.providers.form.idPlaceholder')}
          onChange={(e) => set({ id: e.target.value })}
          data-testid="provider-id"
        />
        <small>{t('settings.providers.form.idHint')}</small>
      </label>
      <label>
        <span>{t('settings.providers.form.name')}</span>
        <input
          value={draft.name}
          placeholder={t('settings.providers.form.namePlaceholder')}
          onChange={(e) => set({ name: e.target.value })}
          data-testid="provider-name"
        />
      </label>
      <label>
        <span>{t('settings.providers.form.url')}</span>
        <input
          className="mono"
          value={draft.baseURL}
          placeholder={t('settings.providers.form.urlPlaceholder')}
          onChange={(e) => set({ baseURL: e.target.value })}
          data-testid="provider-url"
        />
        <small>{t('settings.providers.form.urlHint')}</small>
      </label>
      <label>
        <span>{t('settings.providers.form.models')}</span>
        <textarea
          className="mono"
          rows={3}
          value={draft.models}
          placeholder={t('settings.providers.form.modelsPlaceholder')}
          onChange={(e) => set({ models: e.target.value })}
          data-testid="provider-models"
        />
        <small>{t('settings.providers.form.modelsHint')}</small>
      </label>
      <div className="mcp-form-actions">
        <button type="button" className="btn small ghost" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn small primary" data-testid="provider-save">
          {t('common.save')}
        </button>
      </div>
    </form>
  )
}
