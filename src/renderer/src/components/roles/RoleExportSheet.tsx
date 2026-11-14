import * as Dialog from '@radix-ui/react-dialog'
import { Check, Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  RoleExportError,
  RoleExportPreview,
  RoleExportRef,
  RoleExportScope
} from '@shared/role-export'
import { ipcErrorText } from '../../ipc-errors'
import { RoleAvatar } from './RoleAvatar'
import { roleExportErrorText } from './RoleExportStatus'

/** Texte avec le libellé du rôle en gras (`{{label}}` de la traduction). */
function withBoldLabel(text: string, marker: string, label: string) {
  const [before, after] = text.split(marker)
  return (
    <>
      {before}
      <b>{label}</b>
      {after}
    </>
  )
}

/**
 * Feuille « Installer dans <agent> » (fiche 223, phase 4, maquettes 05-2 et 05-3) : où (portée,
 * chemin), quoi (identifiant, droits, sauvegarde), ce que Bobine en fait (« lancer dans ce
 * mode »), et le texte exact en lecture seule. Rien n'est écrit avant « Installer ». Les textes
 * propres au format viennent de la traduction du format déclaré par le profil (ADR-0011).
 */
export function RoleExportSheet(props: {
  role: RoleExportRef & { icon: string; color: string }
  profileId: string
  onClose: () => void
  /** Installé, ou refusé sans rien changer : la page le dit. */
  onDone: (error?: RoleExportError) => void
}) {
  const { t } = useTranslation()
  const [preview, setPreview] = useState<RoleExportPreview | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [scope, setScope] = useState<RoleExportScope>('user')
  const [use, setUse] = useState(true)
  const [showText, setShowText] = useState(false)
  const [busy, setBusy] = useState(false)
  const { scope: roleScope, name, conversationId } = props.role
  useEffect(() => {
    let alive = true
    const ref = { scope: roleScope, name, ...(conversationId ? { conversationId } : {}) }
    window.api.roles.exportPreview(ref, props.profileId).then(
      (found) => {
        if (!alive) return
        setPreview(found)
        setScope(found.defaultScope)
      },
      (e: unknown) => alive && setFailure(ipcErrorText(e))
    )
    return () => {
      alive = false
    }
  }, [roleScope, name, conversationId, props.profileId])

  const install = async () => {
    if (!preview || busy) return
    setBusy(true)
    try {
      const result = await window.api.roles.export(
        { scope: roleScope, name, ...(conversationId ? { conversationId } : {}) },
        { profileId: props.profileId, scope },
        { useInBobine: use }
      )
      props.onDone(result.ok ? undefined : result.error)
    } catch (e) {
      setFailure(ipcErrorText(e))
      setBusy(false)
    }
  }

  const f = preview ? (`roleExport.format.${preview.format}` as const) : undefined
  const agent = preview?.profileLabel ?? ''
  const place = preview?.places.find((p) => p.scope === scope)
  const marker = '\u0000'
  return (
    <Dialog.Root open onOpenChange={(open) => !open && !busy && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay role-export-overlay" />
        <Dialog.Content
          className="dialog role-export-sheet"
          aria-describedby={undefined}
          data-testid="role-export-sheet"
          data-format={preview?.format}
        >
          <header className="role-export-head">
            <RoleAvatar role={props.role} size={32} />
            <Dialog.Title className="role-export-title">
              {preview
                ? t('roleExport.title', { label: preview.label, agent })
                : t('roleExport.button')}
            </Dialog.Title>
          </header>
          {preview && f && (
            <div className="role-export-body">
              <p className="role-export-intro">
                {withBoldLabel(
                  t(`${f}.intro`, {
                    agent,
                    label: marker,
                    interpolation: { escapeValue: false }
                  }),
                  marker,
                  preview.listedAs
                )}
              </p>
              <div className="role-export-label" id="role-export-where">
                {t('roleExport.where')}
              </div>
              <div role="radiogroup" aria-labelledby="role-export-where">
                {preview.places.map((p) => (
                  <label
                    key={p.scope}
                    className={`role-export-place${p.scope === scope ? ' on' : ''}`}
                    data-testid={`role-export-place-${p.scope}`}
                  >
                    <input
                      type="radio"
                      name="role-export-scope"
                      checked={p.scope === scope}
                      onChange={() => setScope(p.scope)}
                    />
                    <span>
                      <b>{t(`roleExport.scope.${p.scope}`)}</b>
                      <code className="role-export-path">{p.file}</code>
                      {p.scope === 'user' && preview.sharedFile && (
                        <span className="role-export-note">
                          {t(`${f}.userNote`, { id: preview.id })}
                        </span>
                      )}
                      {p.scope === 'project' && (
                        <span className="role-export-note">{t('roleExport.projectNote')}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              <dl className="role-export-facts">
                <dt>{t(`${f}.kind`)}</dt>
                <dd>
                  <code>{preview.id}</code> · {preview.label}
                </dd>
                <dt>{t('roleExport.rights', { agent })}</dt>
                <dd data-testid="role-export-rights">
                  {t(preview.readOnly ? `${f}.readOnly` : `${f}.readWrite`)}
                </dd>
                {preview.replacesBasePrompt && (
                  <>
                    <dt>{t(`${f}.promptLabel`)}</dt>
                    <dd>{t(`${f}.prompt`)}</dd>
                  </>
                )}
                <dt>{t('roleExport.backup')}</dt>
                <dd>{t(`${f}.backup`)}</dd>
              </dl>
              <label className="role-export-use" data-testid="role-export-use">
                <input type="checkbox" checked={use} onChange={(e) => setUse(e.target.checked)} />
                <span>
                  {t(`${f}.use`)}
                  {preview.readOnly && <small>{t('roleExport.useHintReadOnly', { agent })}</small>}
                </span>
              </label>
              <p className="role-export-later">
                <Info size={13} aria-hidden />
                {t('roleExport.later')}
              </p>
              {showText && (
                <pre
                  className="role-export-text"
                  aria-label={t('roleExport.textLabel', { file: place?.file ?? '' })}
                  tabIndex={0}
                  data-testid="role-export-text"
                >
                  {preview.text}
                </pre>
              )}
              {preview.error && (
                <p className="field-error" role="alert" data-testid="role-export-sheet-error">
                  {roleExportErrorText(preview.error, preview.format, agent)}
                </p>
              )}
            </div>
          )}
          {failure && (
            <p className="field-error role-export-body" role="alert">
              {failure}
            </p>
          )}
          <footer className="role-export-foot">
            {preview && (
              <button
                className="btn link"
                onClick={() => setShowText(!showText)}
                aria-expanded={showText}
                data-testid="role-export-show-text"
              >
                {showText ? t('roleExport.hideText') : t('roleExport.showText')}
              </button>
            )}
            <span className="role-wizard-spacer" />
            <button className="btn ghost" onClick={props.onClose} disabled={busy}>
              {t('common.cancel')}
            </button>
            <button
              className="btn primary"
              onClick={() => void install()}
              disabled={!preview || !!preview.error || busy}
              data-testid="role-export-install"
            >
              {busy ? <Check size={13} aria-hidden /> : null}
              {busy ? t('roleExport.installing') : t('roleExport.install')}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
