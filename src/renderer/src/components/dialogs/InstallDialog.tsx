import * as Dialog from '@radix-ui/react-dialog'
import { User, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { InstallChoice, InstallOffer, InstallScope } from '@shared/install'
import { AppIcon } from '../common/SpoolMark'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'
import { ipcErrorText } from '../../ipc-errors'

/** Libellés d'un choix : clés `install.scope.<portée>.title`, `.where` et `.denied`. */
const labels = (scope: InstallScope) => ({
  title: i18next.t(`install.scope.${scope}.title`),
  where: i18next.t(`install.scope.${scope}.where`),
  denied: i18next.t(`install.scope.${scope}.denied`)
})

/**
 * Ouverte depuis le .dmg ou un autre dossier, Bobine propose de s'installer (fiche 073) : pour tous
 * les utilisateurs (/Applications) ou pour soi seulement (~/Applications, sans droits
 * d'administrateur).
 */
export function InstallDialog() {
  const { t } = useTranslation()
  const [offer, setOffer] = useState<InstallOffer | null>(null)
  const [scope, setScope] = useState<InstallScope>('me')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    window.api.app
      .installOffer()
      .then((o) => {
        setOffer(o)
        if (o) setScope(o.suggested)
      })
      .catch(() => setOffer(null))
  }, [])
  if (!offer) return null

  const close = () => setOffer(null)
  const install = () => {
    setBusy(true)
    setError(null)
    // Réussie, l'installation relance l'app depuis sa nouvelle place : cette fenêtre se ferme.
    window.api.app.install(scope).catch((e: unknown) => {
      setBusy(false)
      setError(ipcErrorText(e))
    })
  }
  const chosen = offer.choices.find((c) => c.scope === scope)
  return (
    <Dialog.Root open onOpenChange={(open) => !open && !busy && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog install-dialog" data-testid="install-dialog">
          <div className="install-head">
            <AppIcon size={48} />
            <div>
              <Dialog.Title className="confirm-title">{t('install.title')}</Dialog.Title>
              <Dialog.Description className="confirm-text">
                {offer.fromDiskImage ? t('install.fromDmg') : t('install.elsewhere')}
              </Dialog.Description>
            </div>
          </div>
          <div className="install-choices" role="radiogroup" aria-label={t('install.title')}>
            {offer.choices.map((choice) => (
              <ChoiceCard
                key={choice.scope}
                choice={choice}
                selected={choice.scope === scope}
                disabled={busy}
                onSelect={() => setScope(choice.scope)}
              />
            ))}
          </div>
          {error && (
            <p className="confirm-text install-error" data-testid="install-error">
              {error}
            </p>
          )}
          <div className="confirm-actions">
            <button
              className="btn ghost install-never"
              onClick={() => {
                void window.api.app.dismissInstall()
                close()
              }}
              disabled={busy}
              data-testid="install-never"
            >
              {t('install.never')}
            </button>
            <Dialog.Close className="btn ghost" disabled={busy} data-testid="install-later">
              {t('install.later')}
            </Dialog.Close>
            <button
              className="btn primary"
              autoFocus
              onClick={install}
              disabled={busy || !chosen?.allowed}
              data-testid="install-now"
            >
              {busy ? t('install.installing') : t('install.install')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ChoiceCard({
  choice,
  selected,
  disabled,
  onSelect
}: {
  choice: InstallChoice
  selected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation()
  const label = labels(choice.scope)
  const Icon = choice.scope === 'everyone' ? Users : User
  return (
    <label
      className={`install-choice${selected ? ' selected' : ''}${choice.allowed ? '' : ' denied'}`}
      data-testid={`install-choice-${choice.scope}`}
    >
      <input
        type="radio"
        name="install-scope"
        checked={selected}
        disabled={disabled || !choice.allowed}
        onChange={onSelect}
      />
      <Icon size={20} className="install-choice-icon" aria-hidden />
      <span className="install-choice-text">
        <strong>{label.title}</strong>
        <span>{choice.allowed ? label.where : label.denied}</span>
        {choice.allowed && choice.replacing && <span>{t('install.replaces')}</span>}
        <code title={choice.target}>{choice.target.replace(/\/[^/]+$/, '')}</code>
      </span>
    </label>
  )
}
