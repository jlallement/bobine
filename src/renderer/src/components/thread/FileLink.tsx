import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentProps
} from 'react'
import type { FileChecks } from './file-checks'
import { parseFileLink, webLinkTarget } from '@shared/file-links'
import { useTranslation } from 'react-i18next'
import { useDisplayPath } from '../../presentation'
import { EditorContext, OpenInEditorButton } from './OpenInEditor'
import { platformFeatures } from '../../platform-features'

/**
 * Ouvre un lien de fichier (fiche 052) ; `reveal` : le montrer dans le Finder (⌥-clic).
 * `onMissing` : fichier introuvable, dit par le lien lui-même plutôt que par un avis (fiche 272).
 */
export type OpenFileLink = (
  href: string,
  options: { reveal: boolean; base?: string; onMissing?: () => void }
) => void

/** Qui ouvre les liens de fichiers de ce fil (absent : ils restent de simples liens). */
export const FileLinksContext = createContext<OpenFileLink | null>(null)

/**
 * Mémoire de l'existence des fichiers cités en code dans ce fil (fiche 272) : un code en ligne
 * n'est un lien que vers un fichier qui existe. Absente : aucun.
 */
export const FileExistsContext = createContext<FileChecks | null>(null)

/**
 * Fil d'une conversation (`ConversationScope`) : un lien vers un fichier introuvable le dit
 * lui-même, barré, avec une bulle (fiche 272, D2), au lieu d'un avis dans le fil. Ailleurs
 * (aperçu, onglet Fichiers), l'avis habituel.
 */
export const MissingInPlaceContext = createContext(false)

/** Durée de la bulle « Fichier introuvable » sous le lien (fiche 272, D2). */
export const GONE_BUBBLE_MS = 3000

/** Dossier de base des liens relatifs (celui du document affiché ; absent : celui du fil). */
export const FileLinkBase = createContext<string | undefined>(undefined)

const noSubscription = () => () => {}

/**
 * Lien vers un fichier introuvable dans le fil (fiche 272, D2) : le « non » appris au clic, retenu
 * par la mémoire de la conversation (barré jusqu'au retour du fichier), et la bulle de 3 s, liée
 * à cette mémoire : un changement de conversation l'efface, sa minuterie avec.
 */
function useGoneLink(href: string | undefined) {
  const checks = useContext(FileExistsContext)
  const inPlace = useContext(MissingInPlaceContext)
  const base = useContext(FileLinkBase)
  const subscribe = useCallback(
    (listener: () => void) => (checks ? checks.subscribe(listener) : noSubscription()),
    [checks]
  )
  const gone = useSyncExternalStore(subscribe, () =>
    checks && href ? checks.gone(base, href) : false
  )
  const [bubbleFor, setBubbleFor] = useState<FileChecks | null>(null)
  const bubble = checks !== null && bubbleFor === checks && gone
  useEffect(() => {
    if (!bubble) return
    const timer = setTimeout(() => setBubbleFor(null), GONE_BUBBLE_MS)
    // Bulle cachée avant l'heure (autre conversation, fichier revenu) : oubliée, pas reportée.
    return () => {
      clearTimeout(timer)
      setBubbleFor(null)
    }
  }, [bubble])
  const onMissing =
    inPlace && checks && href
      ? () => {
          checks.markGone(base, href)
          setBubbleFor(checks)
        }
      : undefined
  return {
    gone: inPlace && gone,
    bubble: inPlace && bubble,
    live: inPlace && checks !== null,
    onMissing
  }
}

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
  const editor = useContext(EditorContext)
  const file = parseFileLink(href, { windowsPaths: platformFeatures().windowsPaths })
  const missing = useGoneLink(file ? href : undefined)
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
  // Annonce de la bulle à VoiceOver : la zone existe avant son texte, pour être lue.
  const status = missing.live && (
    <span role="status" className={missing.bubble ? 'file-gone-bubble' : 'sr-only'}>
      {missing.bubble ? t('fileLink.gone') : null}
    </span>
  )
  if (missing.gone) {
    // Le lien cesse d'en être un : du code barré et grisé, que le survol explique.
    return (
      <span className="file-link-group">
        <span className="file-link-gone" title={t('fileLink.gone')} data-testid="file-link-gone">
          {children}
        </span>
        {status}
      </span>
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
          // ⌘-clic : dans l'éditeur, à la ligne (fiche 271, Q11) ; ⌥-clic : le Finder.
          if ((event.metaKey || event.ctrlKey) && editor) {
            editor.open(file.path, {
              ...(file.line ? { line: file.line } : {}),
              ...(base ? { base } : {})
            })
            return
          }
          open(href, {
            reveal: event.altKey,
            ...(base ? { base } : {}),
            ...(missing.onMissing ? { onMissing: missing.onMissing } : {})
          })
        }}
        data-testid="file-link"
      >
        {children}
      </a>
      <OpenInEditorButton path={file.path} line={file.line} base={base} />
      {status}
    </span>
  )
}
