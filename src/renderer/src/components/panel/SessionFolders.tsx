import { FolderPlus, FolderSymlink, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tip } from '../common/Menus'

export interface SessionFoldersProps {
  /** Autres dossiers de la conversation (fiche 179), chemins absolus. */
  folders: readonly string[]
  /** L'agent annonce `additionalDirectories` : il les reçoit, on peut en ajouter. */
  supported: boolean
  /** L'agent répond : la session ne peut pas être rouverte maintenant. */
  busy: boolean
  agentLabel: string
  /** Le Finder (macOS) ou le gestionnaire de fichiers (fiche 145). */
  finder: boolean
  onAdd: () => void
  onRemove: (folder: string) => void
  onReveal: (folder: string) => void
}

const baseName = (path: string) => path.split('/').filter(Boolean).at(-1) ?? path

/**
 * Ligne « Autres dossiers » de l'environnement (fiche 179). Rien sans la capacité ni dossier ;
 * dossiers gardés d'un agent qui les prenait : listés grisés, « non transmis ».
 */
export function SessionFolders(props: SessionFoldersProps) {
  const { t } = useTranslation()
  if (!props.supported && props.folders.length === 0) return null
  const revealLabel = t(props.finder ? 'workspaceMenu.revealFinder' : 'workspaceMenu.revealFiles')
  return (
    <div
      className="session-row session-folders"
      data-testid="session-folders"
      data-supported={props.supported || undefined}
    >
      <span className="session-row-label">{t('sessionTab.extraFolders')}</span>
      <span className="session-row-value session-folder-list">
        {props.folders.map((folder) => (
          <span className="session-folder" key={folder} data-testid="session-extra-folder">
            <Tip label={`${revealLabel} — ${folder}`}>
              <button
                type="button"
                className="session-link"
                onClick={() => props.onReveal(folder)}
                data-folder={folder}
              >
                <FolderSymlink size={16} />
                <span className="session-link-text">{baseName(folder)}</span>
              </button>
            </Tip>
            <Tip
              label={
                props.busy
                  ? t('sessionTab.foldersBusy')
                  : t('sessionTab.removeFolder', { name: baseName(folder) })
              }
            >
              <button
                type="button"
                className="btn small ghost icon session-folder-remove"
                aria-label={t('sessionTab.removeFolder', { name: baseName(folder) })}
                disabled={props.busy}
                onClick={() => props.onRemove(folder)}
                data-testid="session-remove-folder"
              >
                <X size={14} />
              </button>
            </Tip>
          </span>
        ))}
        {props.supported ? (
          <Tip label={props.busy ? t('sessionTab.foldersBusy') : t('sessionTab.addFolderTip')}>
            <button
              type="button"
              className="session-link session-add-folder"
              disabled={props.busy}
              onClick={props.onAdd}
              data-testid="session-add-folder"
            >
              <FolderPlus size={16} />
              <span className="session-link-text">{t('sessionTab.addFolder')}</span>
            </button>
          </Tip>
        ) : (
          <span className="session-folders-note" data-testid="session-folders-unsupported">
            {t('sessionTab.foldersUnsupported', { agent: props.agentLabel })}
          </span>
        )}
      </span>
    </div>
  )
}
