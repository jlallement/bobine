import { ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react'
import { Fragment, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { BrowserCertificateProblem } from '@shared/browser'
import { ipcErrorText } from '../../ipc-errors'

/** Clé de la raison lisible d'un code de Chromium (`net::ERR_CERT_…`). */
function reasonKey(error: string, local: boolean) {
  if (/AUTHORITY_INVALID/.test(error)) {
    return local
      ? ('browser.certificate.reason.authority' as const)
      : ('browser.certificate.reason.authorityPublic' as const)
  }
  if (/COMMON_NAME_INVALID/.test(error)) return 'browser.certificate.reason.name' as const
  if (/DATE_INVALID/.test(error)) return 'browser.certificate.reason.date' as const
  return 'browser.certificate.reason.other' as const
}

/**
 * Texte coupé seulement après `breaks` (une empreinte après ses « : », un code après « :: » et
 * « _ »), jamais au milieu d'un octet ou d'un mot.
 */
function breakAfter(text: string, breaks: RegExp): ReactNode {
  const parts = text.split(breaks)
  return parts.map((part, index) => (
    <Fragment key={index}>
      {part}
      {index < parts.length - 1 && <wbr />}
    </Fragment>
  ))
}

/**
 * Avertissement d'un certificat refusé (fiche 269, ADR-0064), dans l'interface de l'app, à la place
 * de la page (la vue native est masquée par le main). Sur le modèle de Chrome : la raison,
 * « Revenir en lieu sûr », et derrière « Avancé » « Continuer vers <hôte> (non sécurisé) »,
 * seulement quand le main le permet (adresse locale ou privée, erreur d'un serveur de
 * développement). Sinon : pourquoi, « Ouvrir dans le navigateur », et « Détails ». « Continuer »
 * n'envoie que le jeton de l'avertissement.
 */
export function CertificateWarning({
  conversationId,
  problem
}: {
  conversationId: string
  problem: BrowserCertificateProblem
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const site = problem.port === 443 ? problem.host : `${problem.host}:${problem.port}`
  const local = problem.bypassable || !!problem.checking
  const report = (e: unknown) => setError(ipcErrorText(e))
  const proceed = () => {
    setBusy(true)
    setError(null)
    window.api.browser
      .allowCertificate(conversationId, problem.token, remember && problem.rememberable)
      .catch(report)
      .finally(() => setBusy(false))
  }
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <div className="certificate-warning" role="alert" data-testid="certificate-warning">
      <div className="certificate-warning-body">
        <ShieldAlert className="certificate-warning-icon" size={36} strokeWidth={1.6} />
        <h2>{t('browser.certificate.title')}</h2>
        <p>{t('browser.certificate.lead', { site })}</p>
        <p className={`certificate-warning-reason${local ? ' local' : ''}`}>
          {t(reasonKey(problem.error, local))}
        </p>
        {problem.refusal && (
          <p data-testid="certificate-not-allowed">
            {t(`browser.certificate.refusal.${problem.refusal}`, { host: problem.host })}
          </p>
        )}
        {problem.checking && (
          <p className="certificate-warning-reason" data-testid="certificate-checking">
            {t('browser.certificate.checking', { host: problem.host })}
          </p>
        )}
        <div className="certificate-warning-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => void window.api.browser.leaveCertificate(conversationId).catch(report)}
            data-testid="certificate-back"
          >
            {t('browser.certificate.back')}
          </button>
          {problem.refusal && (
            <button
              type="button"
              className="btn"
              onClick={() =>
                void window.api.browser
                  .openCertificateSite(conversationId, problem.token)
                  .catch(report)
              }
              data-testid="certificate-open-external"
            >
              {t('browser.certificate.openExternal')}
            </button>
          )}
          <button
            type="button"
            className="btn ghost certificate-toggle"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            data-testid="certificate-advanced"
          >
            <Chevron size={14} />
            {t(problem.bypassable ? 'browser.certificate.advanced' : 'browser.certificate.details')}
          </button>
        </div>
        {open && (
          <div className="certificate-warning-advanced" data-testid="certificate-details">
            {problem.bypassable && (
              <>
                <p>{t('browser.certificate.devHint', { site })}</p>
                <label className="certificate-remember">
                  <input
                    type="checkbox"
                    checked={remember && problem.rememberable}
                    disabled={!problem.rememberable}
                    onChange={(e) => setRemember(e.target.checked)}
                    data-testid="certificate-remember"
                  />
                  <span>
                    {t('browser.certificate.remember')}
                    <small>
                      {t(
                        problem.rememberable
                          ? 'browser.certificate.rememberHint'
                          : 'browser.certificate.rememberReadOnly'
                      )}
                    </small>
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
            )}
            <dl>
              <dt>{t('browser.certificate.field.address')}</dt>
              <dd className="mono">{site}</dd>
              {problem.subject && (
                <>
                  <dt>{t('browser.certificate.field.subject')}</dt>
                  <dd>{problem.subject}</dd>
                </>
              )}
              {problem.issuer && (
                <>
                  <dt>{t('browser.certificate.field.issuer')}</dt>
                  <dd>{problem.issuer}</dd>
                </>
              )}
              <dt>{t('browser.certificate.field.fingerprint')}</dt>
              <dd className="mono certificate-fingerprint" data-testid="certificate-fingerprint">
                {problem.fingerprint
                  ? breakAfter(problem.fingerprint, /(?<=:)/)
                  : t('browser.certificate.field.unreadable')}
              </dd>
              <dt>{t('browser.certificate.field.error')}</dt>
              <dd className="mono certificate-code">{breakAfter(problem.error, /(?<=::|_)/)}</dd>
            </dl>
          </div>
        )}
        {error && <p className="certificate-warning-error">{error}</p>}
      </div>
    </div>
  )
}
