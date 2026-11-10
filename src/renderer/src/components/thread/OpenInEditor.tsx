import { SquareArrowOutUpRight } from 'lucide-react'
import { createContext, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import type { EditorAction } from '../../useEditor'
import '../../thread-extras.css'

/** L'éditeur de l'utilisateur pour ce fil (fiche 156) ; absent : pas de bouton. */
export const EditorContext = createContext<EditorAction | null>(null)

/**
 * « Ouvrir dans <éditeur> » : le fichier à la ligne, dans l'éditeur choisi dans Réglages ›
 * Général. Rien quand aucun éditeur n'est installé.
 */
export function OpenInEditorButton({
  path,
  line,
  base
}: {
  path: string
  line?: number | null | undefined
  /** Dossier des chemins relatifs (document en aperçu). */
  base?: string | undefined
}) {
  const { t } = useTranslation()
  const editor = useContext(EditorContext)
  if (!editor) return null
  const label = t('editor.open', { editor: editor.name })
  return (
    <button
      type="button"
      className="icon-button small open-in-editor"
      title={line ? t('editor.openAtLine', { editor: editor.name, line }) : label}
      aria-label={label}
      onClick={(event) => {
        // Dans un résumé de carte ou un lien : ni déplier, ni suivre le lien.
        event.preventDefault()
        event.stopPropagation()
        editor.open(path, {
          ...(line ? { line } : {}),
          ...(base ? { base } : {})
        })
      }}
      data-testid="open-in-editor"
    >
      <SquareArrowOutUpRight size={12} />
    </button>
  )
}
