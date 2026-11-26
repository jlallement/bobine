import { FolderSymlink, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { revealLabelKey } from '../../platform-features'
import { useTranslation } from 'react-i18next'
import { Tip } from '../common/Menus'
import { ReasonButton } from '../common/ReasonButton'
import type { AddFolderResult } from '@shared/extra-folders'
import { folderName } from '@shared/windows-paths'
import { ADDED_NOTE_MS, FolderPathField } from './FolderPathField'

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
  /** Windows : « Explorateur de fichiers » (fiche 229). */
  explorer?: boolean
  /** Ajoute un dossier (fiche 290) : sans chemin, la fenêtre du système. */
  onAdd: (path?: string) => Promise<AddFolderResult | null>
  /** Chemin d'un élément glissé (`window.api.files.pathFor`). */
  pathFor: (file: File) => string
  /** Erreur inattendue d'un ajout. */
  onError: (error: unknown) => void
  onRemove: (folder: string) => void
  onReveal: (folder: string) => void
}

const baseName = (path: string) => folderName(path)

/**
 * Ligne « Autres dossiers » de l'environnement (fiche 179). Rien sans la capacité ni dossier ;
 * dossiers gardés d'un agent qui les prenait : listés grisés, « non transmis ».
 */
export function SessionFolders(props: SessionFoldersProps) {
  const { t } = useTranslation()
  // Dossier tout juste ajouté : fond vert bref (fiche 290).
  const [fresh, setFresh] = useState<string | null>(null)
  useEffect(() => {
    if (!fresh) return
    const timer = setTimeout(() => setFresh(null), ADDED_NOTE_MS)
    return () => clearTimeout(timer)
  }, [fresh])
  if (!props.supported && props.folders.length === 0) return null
  const revealLabel = t(revealLabelKey({ finder: props.finder, explorer: props.explorer === true }))
  return (
    <div
      className="session-row session-folders"
      data-testid="session-folders"
      data-supported={props.supported || undefined}
    >
      <span className="session-row-label">{t('sessionTab.extraFolders')}</span>
      <span className="session-row-value session-folder-list">
        {props.folders.map((folder) => (
          <span
            className={`session-folder${folder === fresh ? ' session-folder-added' : ''}`}
            key={folder}
            data-testid="session-extra-folder"
          >
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
            {/* Pendant une réponse : la raison au survol et au clavier (fiche 287). */}
            <ReasonButton
              className="btn small ghost icon session-folder-remove"
              aria-label={t('sessionTab.removeFolder', { name: baseName(folder) })}
              reason={props.busy ? t('sessionTab.foldersBusy') : undefined}
              tip={t('sessionTab.removeFolder', { name: baseName(folder) })}
              onClick={() => props.onRemove(folder)}
              data-testid="session-remove-folder"
            >
              <X size={14} />
            </ReasonButton>
          </span>
        ))}
        {props.supported ? (
          <FolderPathField
            blocked={props.busy ? t('sessionTab.foldersBusy') : undefined}
            add={props.onAdd}
            pathFor={props.pathFor}
            onAdded={setFresh}
            onError={props.onError}
          />
        ) : (
          <span className="session-folders-note" data-testid="session-folders-unsupported">
            {t('sessionTab.foldersUnsupported', { agent: props.agentLabel })}
          </span>
        )}
      </span>
    </div>
  )
}
