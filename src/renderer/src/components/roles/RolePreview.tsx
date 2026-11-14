import { CornerDownRight, Info, LoaderCircle } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { roleFileHint, type RoleDraft } from '../../roles/role-draft'
import { RoleAvatar, useRoleTint } from './RoleAvatar'

/**
 * Aperçu en direct de l'assistant (maquettes A1 à A3) : le rôle tel qu'il apparaîtra dans le menu
 * `@`, au travail dans le fil, et sous sa mère dans la barre latérale ; à la dernière étape, où il
 * sera enregistré. Décoratif : tout ce qu'il montre est déjà dans les champs.
 */
export function RolePreview({ draft, showFile }: { draft: RoleDraft; showFile: boolean }) {
  const { t } = useTranslation()
  const tint = useRoleTint(draft.color)
  const label = draft.label.trim() || t('roleWizard.preview.unnamed')
  const description = draft.description.trim() || t('roleWizard.preview.noDescription')
  return (
    <aside
      className="role-preview"
      data-testid="role-preview"
      aria-label={t('roleWizard.preview.title')}
    >
      <div className="role-preview-head">
        <span className="role-preview-title">{t('roleWizard.preview.title')}</span>
        <span className="role-preview-live">{t('roleWizard.preview.live')}</span>
      </div>
      <div className="role-preview-block">
        <span className="role-preview-caption">{t('roleWizard.preview.menu')}</span>
        <div className="role-preview-card role-preview-menu">
          <RoleAvatar role={draft} size={24} />
          <span className="role-preview-name">{label}</span>
          <span className="role-preview-desc">{description}</span>
        </div>
      </div>
      <div className="role-preview-block">
        <span className="role-preview-caption">{t('roleWizard.preview.thread')}</span>
        <div
          className="role-preview-card role-preview-work"
          style={{ '--role': tint } as CSSProperties}
        >
          <RoleAvatar role={draft} size={32} />
          <span className="role-preview-work-text">
            <span className="role-preview-name">{label}</span>
            <span className="role-preview-desc">
              {draft.readOnly ? t('roleWizard.preview.reading') : t('roleWizard.preview.working')}
            </span>
          </span>
        </div>
      </div>
      <div className="role-preview-block">
        <span className="role-preview-caption">{t('roleWizard.preview.sidebar')}</span>
        <div className="role-preview-card role-preview-side">
          <CornerDownRight size={14} aria-hidden className="role-preview-link" />
          <RoleAvatar role={draft} size={18} />
          <span className="role-preview-name">{t('roleWizard.preview.childTitle')}</span>
          <LoaderCircle size={14} aria-hidden className="role-preview-spin" />
        </div>
      </div>
      {showFile && (
        <p className="role-preview-file" data-testid="role-preview-file">
          <Info size={13} aria-hidden />
          <span>
            {draft.scope === 'project'
              ? t('roleWizard.preview.fileProject', { file: roleFileHint(draft) })
              : t('roleWizard.preview.fileUser', { file: roleFileHint(draft) })}
          </span>
        </p>
      )}
    </aside>
  )
}
