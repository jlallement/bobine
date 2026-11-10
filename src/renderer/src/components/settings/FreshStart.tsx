import { FlaskConical, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ResetPlan } from '@shared/fresh-start'
import { sizeText } from '../../acp-view'
import { freshStartInfo, takeResetRequest, useFreshStart } from '../../fresh-start'
import { ipcErrorText } from '../../ipc-errors'
import { Row, SettingsCard, SettingsTitle } from './rows'

/**
 * Réglages › Données › « Recommencer à neuf » (fiche 148) : essayer Bobine comme neuve (seconde
 * Bobine sur un profil temporaire, agents comme sur un Mac neuf ou non), et la réinitialiser façon
 * désinstalleur. Rien ne part au premier clic (fiche 126) : la confirmation s'ouvre dans la carte et
 * dit ce qui part à la corbeille, avec les tailles, et ce qui reste. Absente d'un profil temporaire.
 */
export function FreshStartCard() {
  const { t } = useTranslation()
  const info = useFreshStart()
  const [freshAgents, setFreshAgents] = useState(false)
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  // `--reinitialiser` : la confirmation s'ouvre d'elle-même, une seule fois.
  useEffect(() => {
    let live = true
    void freshStartInfo().then((value) => {
      if (live && takeResetRequest(value)) setAsking(true)
    })
    return () => {
      live = false
    }
  }, [])
  if (!info || info.temporary) return null
  const open = () => {
    setNote(null)
    window.api.app.openTemporaryProfile(freshAgents).then(
      () => setNote(t('settings.data.fresh.tryDone')),
      (e: unknown) => setNote(ipcErrorText(e))
    )
  }
  return (
    <>
      <SettingsTitle>{t('settings.data.fresh.title')}</SettingsTitle>
      <SettingsCard testId="fresh-start-card">
        <Row label={t('settings.data.fresh.tryLabel')} hint={t('settings.data.fresh.tryHint')}>
          <button className="btn small" onClick={open} data-testid="fresh-start-open">
            <FlaskConical size={13} />
            {t('settings.data.fresh.tryAction')}
          </button>
        </Row>
        <Row
          sub
          label={t('settings.data.fresh.agentsLabel')}
          hint={t('settings.data.fresh.agentsHint')}
        >
          <label className="switch">
            <input
              type="checkbox"
              checked={freshAgents}
              onChange={(e) => setFreshAgents(e.target.checked)}
              data-testid="fresh-start-agents"
            />
            <span />
          </label>
        </Row>
        {note && (
          <div className="settings-note" data-testid="fresh-start-note">
            {note}
          </div>
        )}
        <Row label={t('settings.data.fresh.resetLabel')} hint={t('settings.data.fresh.resetHint')}>
          <button
            className="btn small danger"
            onClick={() => setAsking((a) => !a)}
            data-testid="fresh-start-reset"
          >
            {t('settings.data.fresh.resetAction')}
          </button>
        </Row>
        {asking && <ResetConfirm onCancel={() => setAsking(false)} />}
      </SettingsCard>
    </>
  )
}

/** Confirmation dans la carte : ce qui part, ce qui reste, la case « désinstaller ». */
function ResetConfirm({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation()
  const [plan, setPlan] = useState<ResetPlan | null>(null)
  const [uninstall, setUninstall] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    window.api.app.resetPlan().then(
      (value) => live && setPlan(value),
      (e: unknown) => live && setError(ipcErrorText(e))
    )
    return () => {
      live = false
    }
  }, [])
  const removing = uninstall && !!plan?.canUninstall
  const reset = () => {
    setError(null)
    window.api.app.reset(removing).catch((e: unknown) => setError(ipcErrorText(e)))
  }
  const lead = removing
    ? t('settings.data.fresh.leadUninstall')
    : plan?.canUninstall
      ? t('settings.data.fresh.lead')
      : t('settings.data.fresh.leadClose')
  const action = removing
    ? t('settings.data.fresh.confirmUninstall')
    : plan?.canUninstall
      ? t('settings.data.fresh.confirmAction')
      : t('settings.data.fresh.confirmClose')
  return (
    <div
      className="fresh-confirm"
      role="group"
      aria-label={t('settings.data.fresh.confirmTitle')}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        // Échap referme la confirmation, pas la fenêtre des réglages (comme `ConfirmRow`).
        event.stopPropagation()
        onCancel()
      }}
      data-testid="fresh-start-confirm"
    >
      <p className="fresh-confirm-lead">{lead}</p>
      {!plan && !error && <p className="fresh-confirm-lead">{t('settings.data.fresh.loading')}</p>}
      {plan && (
        <div className="fresh-confirm-cols">
          <div>
            <div className="fresh-confirm-head">
              <Trash2 size={13} />
              {t('settings.data.fresh.trashHead')}
            </div>
            <ul className="fresh-confirm-list" data-testid="fresh-start-trash">
              {plan.items.map((item) => (
                <li key={item.kind} data-kind={item.kind}>
                  <span>{t(`settings.data.fresh.kind.${item.kind}`)}</span>
                  <b>
                    {item.count === undefined
                      ? sizeText(item.bytes)
                      : t('settings.data.fresh.countSize', {
                          count: item.count,
                          size: sizeText(item.bytes)
                        })}
                  </b>
                </li>
              ))}
              {removing && (
                <li data-kind="app">
                  <span>{t('settings.data.fresh.app')}</span>
                </li>
              )}
            </ul>
            {plan.keychain && (
              <div className="fresh-confirm-note">{t('settings.data.fresh.keychain')}</div>
            )}
          </div>
          <div>
            <div className="fresh-confirm-head">
              <ShieldCheck size={13} />
              {t('settings.data.fresh.keepHead')}
            </div>
            <ul className="fresh-confirm-list" data-testid="fresh-start-keep">
              <li>
                <span>{t('settings.data.fresh.keepProjects')}</span>
              </li>
              <li>
                <span>{t('settings.data.fresh.keepAgents')}</span>
              </li>
              {!removing && (
                <li>
                  <span>{t('settings.data.fresh.app')}</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
      {plan?.canUninstall && (
        <label className="fresh-confirm-check">
          <input
            type="checkbox"
            checked={uninstall}
            onChange={(e) => setUninstall(e.target.checked)}
            data-testid="fresh-start-uninstall"
          />
          {t('settings.data.fresh.uninstall')}
        </label>
      )}
      {error && (
        <div className="settings-note error" role="alert">
          {error}
        </div>
      )}
      <div className="fresh-confirm-actions">
        <span className="grow" />
        <button
          className="btn small ghost"
          autoFocus
          onClick={onCancel}
          data-testid="confirm-row-keep"
        >
          {t('common.keep')}
        </button>
        <button
          className="btn small danger"
          onClick={reset}
          disabled={!plan}
          data-testid="fresh-start-confirm-reset"
        >
          {action}
        </button>
      </div>
    </div>
  )
}

/** Pastille de la barre de titre d'une seconde Bobine sur un profil temporaire. */
export function TemporaryProfileChip() {
  const { t } = useTranslation()
  const info = useFreshStart()
  if (!info?.temporary) return null
  return (
    <span
      className="temporary-chip no-drag"
      title={t('settings.data.fresh.chipTip')}
      data-testid="temporary-profile"
    >
      <FlaskConical size={13} />
      {t('settings.data.fresh.chip')}
    </span>
  )
}
