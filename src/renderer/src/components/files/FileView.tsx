import { ChevronLeft, ChevronRight, ExternalLink, FolderOpen, ListTree, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { isHtmlPath, isMarkdownPath } from '@shared/file-links'
import { MAX_HIGHLIGHT_BYTES, type FileRoot, type FileTarget } from '@shared/files'
import { sizeText } from '../discussion/DocumentsPanel'
import { FileLinkBase, FileLinksContext, type OpenFileLink } from '../thread/FileLink'
import { Markdown } from '../thread/Markdown'
import { Tip } from '../common/Menus'
import { highlightLines, languageOf } from '../../code-lines'
import { FileActionItems, FileActionsMenu, type FileActions } from './FileActions'
import { CodeView, type CodeNotes } from './CodeView'
import type { OpenContent } from './useFilesTab'

interface Props {
  root: FileRoot | undefined
  /** Plusieurs racines : la racine est nommée dans le fil d'Ariane. */
  showRoot: boolean
  target: FileTarget
  content: OpenContent | null
  wrap: boolean
  actions: FileActions
  /** Le fichier a été modifié par la conversation : « Voir le diff ». */
  changed: boolean
  notes?: CodeNotes | undefined
  /** Liens d'un Markdown rendu, relatifs à son dossier. */
  openLink: OpenFileLink
  canBack: boolean
  canForward: boolean
  /** Arbre affiché à côté (agrandi) : son bouton est pressé. */
  treeShown: boolean
  onToggleTree: () => void
  onStep: (delta: -1 | 1) => void
  onClose: () => void
  /** Segment du fil d'Ariane : ce dossier révélé dans l'arbre. */
  onRevealDir: (path: string) => void
  onScroll?: (scroll: number) => void
  initialScroll?: number | undefined
}

/**
 * Fichier ouvert dans l'onglet Fichiers (fiche 271, Q38 à Q49), en lecture seule : fil d'Ariane,
 * précédent / suivant, menu …, puis le contenu — code coloré et numéroté (remarques sur une ligne),
 * Markdown rendu ou source, image, ou fiche d'un binaire.
 */
export function FileView(props: Props) {
  const { t, i18n } = useTranslation()
  const { root, target, content, actions } = props
  const name = target.path.split('/').at(-1) ?? target.path
  const markdown = isMarkdownPath(target.path)
  const [source, setSource] = useState(false)
  const loaded =
    content && content.target.path === target.path && content.target.root === target.root
  const read = loaded && 'content' in content ? content.content : undefined
  // Date de la première lecture : un fichier relu qui a changé le dit (Q49).
  const [first, setFirst] = useState<{ key: string; at: number } | null>(null)
  const key = `${target.root}:${target.path}`
  if (read && first?.key !== key) setFirst({ key, at: read.modified })
  const changedAt =
    read && first?.key === key && read.modified !== first.at
      ? new Date(read.modified).toLocaleTimeString(i18n.language, {
          hour: '2-digit',
          minute: '2-digit'
        })
      : undefined
  const svgSource = read?.kind === 'image' && read.text !== undefined
  const canToggleSource = (read?.kind === 'text' && markdown) || svgSource
  return (
    <div className="file-view" data-testid="file-view" data-path={target.path}>
      <FileHeader {...props} name={name} />
      <div className="file-view-bar">
        <span className="file-readonly" data-testid="file-readonly">
          {t('files.readOnly')}
        </span>
        {changedAt && (
          <span className="file-changed" data-testid="file-changed">
            {t('files.changed', { time: changedAt })}
          </span>
        )}
        <span className="grow" />
        {canToggleSource && (
          <div className="file-source-toggle" role="group">
            <button
              className={`btn small ghost${source ? '' : ' on'}`}
              aria-pressed={!source}
              onClick={() => setSource(false)}
              data-testid="file-rendered"
            >
              {t('files.rendered')}
            </button>
            <button
              className={`btn small ghost${source ? ' on' : ''}`}
              aria-pressed={source}
              onClick={() => setSource(true)}
              data-testid="file-source"
            >
              {t('files.source')}
            </button>
          </div>
        )}
        {isHtmlPath(target.path) && (
          <button
            className="btn small ghost"
            onClick={() => props.openLink(actions.absolute(target), { reveal: false })}
            data-testid="file-open-browser"
          >
            <ExternalLink size={13} />
            {t('files.openInBrowser')}
          </button>
        )}
      </div>
      <FileBody
        {...props}
        name={name}
        source={source}
        markdown={markdown}
        language={languageOf(target.path, read?.kind === 'text' ? read.text : '')}
        root={root}
      />
    </div>
  )
}

function FileHeader(props: Props & { name: string }) {
  const { t } = useTranslation()
  const { root, target, actions, name } = props
  const dirs = target.path.split('/').slice(0, -1)
  return (
    <div className="file-view-head">
      <Tip label={t('files.previous')}>
        <button
          className="icon-button small"
          disabled={!props.canBack}
          onClick={() => props.onStep(-1)}
          aria-label={t('files.previous')}
          data-testid="file-previous"
        >
          <ChevronLeft size={15} />
        </button>
      </Tip>
      <Tip label={t('files.next')}>
        <button
          className="icon-button small"
          disabled={!props.canForward}
          onClick={() => props.onStep(1)}
          aria-label={t('files.next')}
          data-testid="file-next"
        >
          <ChevronRight size={15} />
        </button>
      </Tip>
      <nav className="file-breadcrumb" aria-label={target.path} data-testid="file-breadcrumb">
        {props.showRoot && root && (
          <>
            <button className="crumb" onClick={() => props.onRevealDir('')}>
              {root.name}
            </button>
            <span className="crumb-sep">/</span>
          </>
        )}
        {dirs.map((dir, i) => (
          <span key={i} className="crumb-part">
            <button
              className="crumb"
              onClick={() => props.onRevealDir(dirs.slice(0, i + 1).join('/'))}
              data-testid="file-crumb"
            >
              {dir}
            </button>
            <span className="crumb-sep">/</span>
          </span>
        ))}
        <span className="crumb current" title={actions.absolute(target)}>
          {name}
        </span>
      </nav>
      <Tip label={t('files.showTree')} command="files-tree">
        <button
          className={`icon-button small${props.treeShown ? ' on' : ''}`}
          aria-pressed={props.treeShown}
          onClick={props.onToggleTree}
          aria-label={t('files.showTree')}
          data-testid="file-toggle-tree"
        >
          <ListTree size={15} />
        </button>
      </Tip>
      <FileActionsMenu label={t('files.actions', { name })} testId="file-view-actions">
        <FileActionItems
          item={{ root: target.root, path: target.path, kind: 'file' }}
          actions={actions}
          changed={props.changed}
          {...(target.line ? { line: target.line } : {})}
        />
      </FileActionsMenu>
      <Tip label={t('files.back')}>
        <button
          className="icon-button small"
          onClick={props.onClose}
          aria-label={t('files.back')}
          data-testid="file-close"
        >
          <X size={15} />
        </button>
      </Tip>
    </div>
  )
}

function FileBody(
  props: Props & {
    name: string
    source: boolean
    markdown: boolean
    language: string | undefined
  }
) {
  const { t, i18n } = useTranslation()
  const { content, target, actions } = props
  const units = (bytes: number) => sizeText(bytes, i18n.language)
  if (!content || content.target.path !== target.path || content.target.root !== target.root) {
    return <div className="file-view-note">{t('files.loading')}</div>
  }
  if ('error' in content) {
    return (
      <div className="file-view-note error" data-testid="file-error">
        {content.missing ? t('files.missing') : content.error}
      </div>
    )
  }
  const read = content.content
  if (read.kind === 'binary') {
    return (
      <div className="file-binary" data-testid="file-binary">
        <p>{t('files.binary', { size: units(read.size) })}</p>
        <div className="file-binary-actions">
          <button
            className="btn small"
            onClick={() => actions.openDefault({ ...target, kind: 'file' })}
          >
            <ExternalLink size={13} />
            {t('files.openDefault')}
          </button>
          <button
            className="btn small ghost"
            onClick={() => actions.reveal({ ...target, kind: 'file' })}
          >
            <FolderOpen size={13} />
            {t('files.reveal')}
          </button>
        </div>
      </div>
    )
  }
  if (read.kind === 'image' && !(props.source && read.text !== undefined)) {
    return <ImageView url={read.url} name={props.name} size={units(read.size)} />
  }
  const text = read.kind === 'image' ? (read.text ?? '') : read.text
  if (read.kind === 'text' && props.markdown && !props.source) {
    const absolute = actions.absolute(target)
    const dir = absolute.slice(0, Math.max(absolute.lastIndexOf('/'), absolute.lastIndexOf('\\')))
    return (
      <Scrolled onScroll={props.onScroll} initial={props.initialScroll}>
        <div className="file-markdown msg-agent" data-testid="file-markdown">
          <FileLinksContext.Provider value={props.openLink}>
            <FileLinkBase.Provider value={dir}>
              <Markdown text={text} />
            </FileLinkBase.Provider>
          </FileLinksContext.Provider>
          {read.truncated && (
            <p className="file-view-note">{t('files.truncated', { size: units(read.size) })}</p>
          )}
        </div>
      </Scrolled>
    )
  }
  return (
    <TextView
      {...props}
      text={text}
      truncated={read.kind === 'text' && read.truncated}
      size={read.size}
    />
  )
}

function TextView(
  props: Props & { text: string; language: string | undefined; truncated: boolean; size: number }
) {
  const { t, i18n } = useTranslation()
  const { text, language, target } = props
  const lines = useMemo(() => highlightLines(text, language), [text, language])
  const plain = !!language && text.length > MAX_HIGHLIGHT_BYTES
  return (
    <>
      {props.truncated && (
        <div className="file-view-banner" data-testid="file-truncated">
          {t('files.truncated', { size: sizeText(props.size, i18n.language) })}
        </div>
      )}
      {plain && <div className="file-view-banner">{t('files.plain')}</div>}
      <CodeView
        lines={lines}
        text={text}
        wrap={props.wrap}
        name={props.target.path}
        line={target.line}
        notes={props.notes}
        {...(props.onScroll ? { onScroll: props.onScroll } : {})}
        initialScroll={props.initialScroll}
      />
    </>
  )
}

/** Zone qui défile, sa position retenue (Q2). */
function Scrolled({
  children,
  onScroll,
  initial
}: {
  children: ReactNode
  onScroll: ((scroll: number) => void) | undefined
  initial: number | undefined
}) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (initial && box.current) box.current.scrollTop = initial
    // Position rendue une fois, à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seulement au montage
  }, [])
  return (
    <div
      className="file-scroll"
      ref={box}
      onScroll={(e) => onScroll?.((e.target as HTMLDivElement).scrollTop)}
    >
      {children}
    </div>
  )
}

/** Image du dossier (Q41, Q42) : ajustée au panneau, taille réelle au clic. */
function ImageView({ url, name, size }: { url: string; name: string; size: string }) {
  const [actual, setActual] = useState(false)
  const [dimensions, setDimensions] = useState<string>()
  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') setActual(false)
  }
  return (
    <div className={`file-image${actual ? ' actual' : ''}`} data-testid="file-image">
      <button className="file-image-frame" onClick={() => setActual(!actual)} onKeyDown={onKey}>
        <img
          src={url}
          alt={name}
          onLoad={(e) => {
            const img = e.currentTarget
            setDimensions(`${img.naturalWidth} × ${img.naturalHeight}`)
          }}
        />
      </button>
      <div className="file-image-info">{[dimensions, size].filter(Boolean).join(' · ')}</div>
    </div>
  )
}
