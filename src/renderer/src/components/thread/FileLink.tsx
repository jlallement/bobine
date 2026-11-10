import { createContext, useContext, type ComponentProps } from 'react'
import { parseFileLink, webLinkTarget } from '@shared/file-links'
import { useTranslation } from 'react-i18next'
import { useDisplayPath } from '../../presentation'
import { OpenInEditorButton } from './OpenInEditor'

/** Ouvre un lien de fichier (fiche 052) ; `reveal` : le montrer dans le Finder (⌥-clic). */
export type OpenFileLink = (href: string, options: { reveal: boolean; base?: string }) => void

/** Qui ouvre les liens de fichiers de ce fil (absent : ils restent de simples liens). */
export const FileLinksContext = createContext<OpenFileLink | null>(null)

/** Dossier de base des liens relatifs (celui du document affiché ; absent : celui du fil). */
export const FileLinkBase = createContext<string | undefined>(undefined)

/**
 * Lien d'un texte Markdown : un lien de fichier s'ouvre par l'app (aperçu, app par défaut ou
 * Finder) ; un lien web aussi (fiche 154) : adresse du poste dans le navigateur intégré (⌥-clic :
 * celui du Mac), autre adresse dans le navigateur du Mac.
 */
export function MarkdownLink({
  node: _node,
  href,
  children,
  ...props
}: ComponentProps<'a'> & { node?: unknown }) {
  const { t } = useTranslation()
  const displayPath = useDisplayPath()
  const open = useContext(FileLinksContext)
  const base = useContext(FileLinkBase)
  const file = parseFileLink(href)
  if (open && href && webLinkTarget(href)) {
    return (
      <a
        href={href}
        {...props}
        onClick={(event) => {
          event.preventDefault()
          open(href, { reveal: event.altKey })
        }}
        data-testid="web-link"
      >
        {children}
      </a>
    )
  }
  if (!file || !open || !href) {
    // Sans fil de conversation, un lien web s'ouvre dans le navigateur du Mac (setWindowOpenHandler).
    return (
      <a href={href} {...props} target="_blank" rel="noreferrer">
        {children}
      </a>
    )
  }
  // « Ouvrir dans <éditeur> » juste après le lien, au survol (fiche 156).
  return (
    <span className="file-link-group">
      <a
        href={href}
        {...props}
        className="file-link"
        title={t('fileLink.title', {
          location: file.line
            ? t('fileLink.withLine', { path: displayPath(file.path), line: file.line })
            : displayPath(file.path)
        })}
        onClick={(event) => {
          event.preventDefault()
          open(href, { reveal: event.altKey, ...(base ? { base } : {}) })
        }}
        data-testid="file-link"
      >
        {children}
      </a>
      <OpenInEditorButton path={file.path} line={file.line} base={base} />
    </span>
  )
}
