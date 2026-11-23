import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, Folder, FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { basename } from '../common/Menus'
import { useDisplayPath } from '../../presentation'

/**
 * Dossier d'une tâche planifiée (fiche 276, T12) : le chemin choisi, et un menu des dossiers
 * récents (celui de la conversation ouverte en tête) avec « Autre dossier… » pour la fenêtre de
 * macOS. Sans dossier récent, le bouton ouvre directement cette fenêtre, comme avant.
 */
export function FolderChooser({
  folder,
  folders,
  current,
  onChange,
  onChooseOther
}: {
  folder: string
  /** Dossiers proposés : la conversation ouverte puis les récents (`taskFolders`). */
  folders: readonly string[]
  /** Dossier de la conversation ouverte, signalé dans le menu. */
  current?: string | undefined
  onChange: (folder: string) => void
  onChooseOther: () => void
}) {
  const { t } = useTranslation()
  const displayPath = useDisplayPath()
  const label = folder ? t('scheduled.form.changeFolder') : t('scheduled.form.chooseFolder')
  return (
    <div className="scheduled-folder-line">
      <span className="scheduled-path" title={folder} data-testid="scheduled-folder">
        {/* Isolé : le début du chemin est coupé, sans renvoyer ses « / » à l'autre bout. */}
        <bdi>{folder || t('scheduled.form.noFolder')}</bdi>
      </span>
      {folders.length === 0 ? (
        <button type="button" className="btn small" onClick={onChooseOther}>
          {t('scheduled.form.chooseFolder')}
        </button>
      ) : (
        <Dropdown.Root modal={false}>
          <Dropdown.Trigger className="btn small" data-testid="scheduled-folder-menu">
            {label}
            <ChevronDown size={13} aria-hidden />
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content
              className="menu scheduled-folder-options"
              side="bottom"
              align="end"
              sideOffset={6}
              collisionPadding={12}
              data-testid="scheduled-folder-options"
            >
              <div className="menu-label">{t('scheduled.form.recent')}</div>
              {folders.map((path) => (
                <Dropdown.Item
                  key={path}
                  className="menu-item"
                  onSelect={() => onChange(path)}
                  data-testid="scheduled-folder-option"
                >
                  <Folder size={16} className="menu-icon" />
                  <span className="menu-text">
                    <div className="menu-title">
                      {basename(path)}
                      {path === current && (
                        <span className="menu-title-aside"> · {t('scheduled.form.current')}</span>
                      )}
                    </div>
                    {/* Chemin d'une ligne, coupé par le début : la fin nomme le dossier. */}
                    <div className="menu-desc scheduled-folder-path" title={path}>
                      <bdi>{displayPath(path)}</bdi>
                    </div>
                  </span>
                  {path === folder && <Check size={16} className="menu-check" />}
                </Dropdown.Item>
              ))}
              <Dropdown.Separator className="menu-separator" />
              <Dropdown.Item
                className="menu-item"
                onSelect={onChooseOther}
                data-testid="scheduled-folder-other"
              >
                <FolderOpen size={16} className="menu-icon" />
                <span className="menu-text">{t('scheduled.form.otherFolder')}</span>
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      )}
    </div>
  )
}
