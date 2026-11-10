import {
  CircleCheck,
  CircleExclamationPoint,
  Info,
  TriangleExclamationPoint,
  X
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { translate } from '@shared/i18n/message'
import type { ProfileNotice, ProfileStatus } from '@shared/profile'
import { platformFeatures } from '../../platform-features'

const EMPTY: ProfileStatus = { readOnly: false, notices: [] }

/** État du profil (fiches 196, 197) : lecture seule et avis du lancement, suivis en direct. */
export function useProfileStatus(): ProfileStatus {
  const [status, setStatus] = useState<ProfileStatus>(EMPTY)
  useEffect(() => {
    // Fenêtre sans ces canaux (essais de composants) : rien à dire.
    const api = window.api.profile as typeof window.api.profile | undefined
    if (!api) return
    let alive = true
    void api
      .status()
      .then((s) => alive && setStatus(s))
      .catch(() => {})
    const off = api.onChanged((s) => setStatus(s))
    return () => {
      alive = false
      off()
    }
  }, [])
  return status
}

const ICONS = {
  info: Info,
  success: CircleCheck,
  warning: TriangleExclamationPoint,
  error: CircleExclamationPoint
} as const

/**
 * Avis du profil, en tête de la fenêtre, avec le composant d'avis commun (`.notice`, sa couleur
 * selon la gravité) : la lecture seule, tant qu'elle dure (fiche 196) ; puis les évènements du
 * lancement — un fichier mis de côté, la liste refaite, une restauration — sans chemin ni code
 * (« Afficher dans le Finder », détail replié), chacun fermé par ×.
 */
export function ProfileNotices() {
  const { t } = useTranslation()
  const { readOnly, readOnlyReason, notices } = useProfileStatus()
  if (!readOnly && notices.length === 0) return null
  return (
    <div className="profile-notices column" data-testid="profile-notices">
      {readOnly && (
        <div
          className="notice notice-warning profile-notice"
          data-testid="profile-readonly"
          role="status"
        >
          <TriangleExclamationPoint size={15} aria-hidden />
          <div className="profile-notice-body">
            <span>
              {t(
                readOnlyReason === 'unreadable'
                  ? 'profile.readOnly.noticeUnreadable'
                  : 'profile.readOnly.notice'
              )}
            </span>
            <span className="profile-notice-actions">
              <button
                className="link-button"
                onClick={() => void window.api.profile.openReleases()}
              >
                {t('profile.readOnly.update')}
              </button>
            </span>
          </div>
        </div>
      )}
      {notices.map((notice) => (
        <ProfileNoticeRow key={notice.id} notice={notice} />
      ))}
    </div>
  )
}

function ProfileNoticeRow({ notice }: { notice: ProfileNotice }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const Icon = ICONS[notice.level]
  const finder = platformFeatures().finder
  return (
    <div
      className={`notice notice-${notice.level} profile-notice`}
      data-testid="profile-notice"
      data-level={notice.level}
      role={notice.level === 'error' ? 'alert' : 'status'}
    >
      <Icon size={15} aria-hidden />
      <div className="profile-notice-body">
        <span>{translate(notice.message)}</span>
        <span className="profile-notice-actions">
          {notice.reveal && (
            <button
              className="link-button"
              onClick={() => void window.api.profile.reveal(notice.id)}
              data-testid="profile-notice-reveal"
            >
              {t(finder ? 'workspaceMenu.revealFinder' : 'workspaceMenu.revealFiles')}
            </button>
          )}
          {notice.detail && (
            <button
              className="link-button"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              data-testid="profile-notice-details"
            >
              {t('profile.notice.details')}
            </button>
          )}
        </span>
        {open && notice.detail && <code className="profile-notice-detail">{notice.detail}</code>}
      </div>
      <button
        className="icon-button small"
        aria-label={t('profile.notice.dismiss')}
        onClick={() => void window.api.profile.dismiss(notice.id)}
        data-testid="profile-notice-dismiss"
      >
        <X size={13} />
      </button>
    </div>
  )
}

/** « Lecture seule : … Mettre à jour Bobine » : la phrase et le lien, au point d'action. */
export function ReadOnlyLine({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <p className={`readonly-line ${className}`} data-testid="readonly-line">
      {t('profile.readOnly.line')}{' '}
      <button className="link-button" onClick={() => void window.api.profile.openReleases()}>
        {t('profile.readOnly.update')}
      </button>
    </p>
  )
}

/**
 * Saisie d'un profil en lecture seule (fiche 196) : visible mais inerte (le fil garde sa forme), la
 * phrase et le lien dessous. Un message n'y part jamais : il serait perdu. Sinon, la saisie telle
 * quelle.
 */
export function ReadOnlyGate({ children }: { children: ReactNode }) {
  const { readOnly } = useProfileStatus()
  if (!readOnly) return children
  return (
    <div className="composer-readonly" data-testid="composer-readonly">
      <div className="composer-readonly-inner" inert>
        {children}
      </div>
      <ReadOnlyLine />
    </div>
  )
}
