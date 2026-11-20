import { ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BrowserCertificateProblem } from '@shared/browser'
import { ipcErrorText } from '../../ipc-errors'

/** Clé de la raison lisible d'un code de Chromium (`net::ERR_CERT_…`). */
function reasonKey(error: string) {
  if (/AUTHORITY_INVALID/.test(error)) return 'browser.certificate.reason.authority' as const
  if (/COMMON_NAME_INVALID/.test(error)) return 'browser.certificate.reason.name' as const
  if (/DATE_INVALID/.test(error)) return 'browser.certificate.reason.date' as const
  return 'browser.certificate.reason.other' as const
}

/**
 * Avertissement d'un certificat refusé (fiche 269, ADR-0063), dans l'interface de l'app, à la place
 * de la page (la vue native est masquée par le main). Sur le modèle de Chrome : la raison, « Retour »,
 * et derrière « Avancé » l'empreinte et « Continuer vers <hôte> (non sécurisé) », seulement pour une
 * adresse locale ou privée. « Continuer » n'envoie que le jeton de l'avertissement.
 */
export function CertificateWarning({
  conversationId,
  problem
}: {
  conversationId: string
  problem: BrowserCertificateProblem
}) {
  const { t } = useTranslation()
  const [advanced, setAdvanced] = useState(false)
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const site = problem.port === 443 ? problem.host : `${problem.host}:${problem.port}`
  const proceed = () => {
    setBusy(true)
    setError(null)
    window.api.browser
      .allowCertificate(conversationId, problem.token, remember)
      .catch((e: unknown) => setError(ipcErrorText(e)))
      .finally(() => setBusy(false))
  }
  return (
    <div className="certificate-warning" role="alert" data-testid="certificate-warning">
      <div className="certificate-warning-body">
        <ShieldAlert className="certificate-warning-icon" size={36} strokeWidth={1.6} />
        <h2>{t('browser.certificate.title')}</h2>
        <p>{t('browser.certificate.lead', { host: problem.host })}</p>
        <p className="certificate-warning-reason">{t(reasonKey(problem.error))}</p>
        <div className="certificate-warning-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => void window.api.browser.leaveCertificate(conversationId)}
            data-testid="certificate-back"
          >
            {t('browser.certificate.back')}
          </button>
          <button
            type="button"
            className="btn"
            aria-expanded={advanced}
            onClick={() => setAdvanced((open) => !open)}
            data-testid="certificate-advanced"
          >
            {t(advanced ? 'browser.certificate.hideAdvanced' : 'browser.certificate.advanced')}
          </button>
        </div>
        {advanced && (
          <div className="certificate-warning-advanced" data-testid="certificate-details">
            <dl>
              <dt>{t('browser.certificate.details.address')}</dt>
              <dd className="mono">{site}</dd>
              {problem.subject && (
                <>
                  <dt>{t('browser.certificate.details.subject')}</dt>
                  <dd>{problem.subject}</dd>
                </>
              )}
              {problem.issuer && (
                <>
                  <dt>{t('browser.certificate.details.issuer')}</dt>
                  <dd>{problem.issuer}</dd>
                </>
              )}
              <dt>{t('browser.certificate.details.fingerprint')}</dt>
              <dd className="mono certificate-fingerprint" data-testid="certificate-fingerprint">
                {problem.fingerprint || t('browser.certificate.details.unreadable')}
              </dd>
              <dt>{t('browser.certificate.details.error')}</dt>
              <dd className="mono">{problem.error}</dd>
            </dl>
            {problem.bypassable ? (
              <>
                <p>{t('browser.certificate.devHint', { site })}</p>
                <label className="certificate-remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    data-testid="certificate-remember"
                  />
                  <span>
                    {t('browser.certificate.remember')}
                    <small>{t('browser.certificate.rememberHint')}</small>
                  </span>
                </label>
                <button
                  type="button"
                  className="link-button certificate-proceed"
                  disabled={busy}
                  onClick={proceed}
                  data-testid="certificate-proceed"
                >
                  {t('browser.certificate.proceed', { host: problem.host })}
                </button>
              </>
            ) : (
              <p data-testid="certificate-not-allowed">
                {t(
                  problem.fingerprint
                    ? 'browser.certificate.notAllowed'
                    : 'browser.certificate.unreadable'
                )}
              </p>
            )}
            {error && <p className="certificate-warning-error">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
