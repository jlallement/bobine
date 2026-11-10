import { KeyRound, LoaderCircle, RotateCw, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ApiKeyInfo } from '@shared/agent'
import { ConfirmRow } from './ConfirmRow'
import { KeychainWait, useKeySave } from './KeySave'

/**
 * Clé d'API d'un agent : état (jamais la valeur), saisie, suppression (fiche 022). Le trousseau
 * n'est vérifié qu'à l'enregistrement, où macOS le demande ; indisponible, le main le dit en erreur
 * (fiche 100).
 */
export function ApiKeyRow(props: {
  info: ApiKeyInfo
  onSave: (value: string) => Promise<void>
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const { info } = props
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const keySave = useKeySave(props.onSave)
  const { saving, error } = keySave
  const [removing, setRemoving] = useState(false)
  const state = info.unreadable
    ? t('settings.apiKeys.state.unreadable')
    : info.stored
      ? t('settings.apiKeys.state.stored')
      : info.fromEnvironment
        ? t('settings.apiKeys.state.fromEnv', { env: info.env })
        : t('settings.apiKeys.state.none')
  // Jamais silencieux (fiche 207) : en cours, trousseau attendu, délai dépassé (valeur gardée).
  const save = () => {
    if (!value.trim() || saving) return
    void keySave.run(value).then((saved) => {
      if (!saved) return
      setValue('')
      setEditing(false)
    })
  }
  return (
    <li
      className="api-key-row"
      data-testid={`api-key-${info.env}`}
      data-setting={`key:${info.env}`}
    >
      <div className="api-key-line">
        <KeyRound size={14} className="api-key-icon" />
        <span className="settings-list-main settings-row-label" title={info.help}>
          {info.label}
        </span>
        <span className="settings-list-side" data-testid="api-key-state">
          {state}
        </span>
        {!editing && (
          <button className="btn small" onClick={() => setEditing(true)} data-testid="api-key-edit">
            {info.stored ? t('settings.apiKeys.replace') : t('settings.apiKeys.set')}
          </button>
        )}
        {info.stored && !editing && (
          <button
            className="icon-button small"
            aria-label={t('settings.apiKeys.removeLabel', { name: info.label })}
            aria-expanded={removing}
            title={t('settings.apiKeys.remove')}
            onClick={() => setRemoving(!removing)}
            data-testid="api-key-remove"
          >
            <X size={13} />
          </button>
        )}
      </div>
      {removing && info.stored && (
        <ConfirmRow
          message={t('settings.apiKeys.removeAsk', { name: info.label })}
          action={t('settings.apiKeys.removeAction')}
          onConfirm={() => {
            setRemoving(false)
            props.onRemove()
          }}
          onCancel={() => setRemoving(false)}
        />
      )}
      {editing && (
        <form
          className="api-key-form"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            disabled={saving}
            value={value}
            placeholder={t('settings.apiKeys.placeholder')}
            onChange={(event) => setValue(event.target.value)}
            data-testid="api-key-value"
          />
          <button
            type="submit"
            className="btn small primary"
            disabled={!value.trim() || saving}
            data-testid="api-key-submit"
          >
            {saving ? (
              <>
                <LoaderCircle size={13} className="spin" /> {t('settings.apiKeys.saving')}
              </>
            ) : keySave.timedOut ? (
              <>
                <RotateCw size={13} /> {t('settings.apiKeys.retry')}
              </>
            ) : (
              t('common.save')
            )}
          </button>
          <button
            type="button"
            className="btn small ghost"
            onClick={() => {
              setEditing(false)
              setValue('')
              keySave.reset()
            }}
          >
            {t('common.cancel')}
          </button>
        </form>
      )}
      {editing && keySave.slow ? (
        <KeychainWait className="api-key-help" />
      ) : (
        editing && info.help && !keySave.timedOut && <div className="api-key-help">{info.help}</div>
      )}
      {error && (
        <div className="api-key-error" data-testid="api-key-error">
          {error}
        </div>
      )}
    </li>
  )
}
