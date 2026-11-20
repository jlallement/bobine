import { ChevronLeft, ChevronRight, ExternalLink, FolderOpen, ListTree } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { isHtmlPath, isMarkdownPath } from '@shared/file-links'
import { MAX_HIGHLIGHT_BYTES, type FileRoot, type FileTarget } from '@shared/files'
import { sizeText } from '../discussion/DocumentsPanel'
import { FileLinkBase, FileLinksContext, type OpenFileLink } from '../thread/FileLink'
import { Markdown } from '../thread/Markdown'
import { Tip } from '../common/Menus'
import { highlightLines, languageOf } from '../../code-lines'
import { markdownSourceWanted, setMarkdownSourceWanted } from '../../files-state'
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
  /** Segment du fil d'Ariane : ce dossier révélé dans l'arbre. */
  onRevealDir: (path: string) => void
  onScroll?: (scroll: number) => void
  initialScroll?: number | undefined
  /** Menu de vue de l'onglet (un seul, point 4), à droite de l'en-tête. */
  viewMenu: ReactNode
}

/**
 * Fichier ouvert dans l'onglet Fichiers (fiche 271, Q38 à Q49), en lecture seule : précédent /
 * suivant, fil d'Ariane, pastille « Lecture seule », actions du fichier (⋮) et vue de l'onglet (…),
 * puis le contenu — code coloré et numéroté (remarques sur une ligne), Markdown rendu ou source,
 * image, ou fiche d'un binaire. Le ✕ de l'onglet ramène à l'arbre (point 3).
 */
export function FileView(props: Props) {
  const { t, i18n } = useTranslation()
  const { target, content, actions } = props
  const name = target.path.split('/').at(-1) ?? target.path
  const markdown = isMarkdownPath(target.path)
  // Rendu ou source : retenu le temps de la session (Q10).
  const [source, setSourceState] = useState(markdownSourceWanted)
  const setSource = (next: boolean) => {
    setMarkdownSourceWanted(next)
    setSourceState(next)
  }
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
  const html = isHtmlPath(target.path)
  return (
    <div className="file-view" data-testid="file-view" data-path={target.path}>
      <FileHeader {...props} name={name} executable={read?.executable === true} />
      {(canToggleSource || html) && (
        <div className="file-view-bar">
          {canToggleSource && (
            <div
              className="segmented"
              role="radiogroup"
              aria-label={t('files.source')}
              data-testid="file-source-toggle"
            >
              {[false, true].map((value) => (
                <button
                  key={String(value)}
                  role="radio"
                  aria-checked={source === value}
                  className={source === value ? 'active' : ''}
                  onClick={() => setSource(value)}
                  data-testid={value ? 'file-source' : 'file-rendered'}
                >
                  {t(value ? 'files.source' : 'files.rendered')}
                </button>
              ))}
            </div>
          )}
          <span className="grow" />
          {html && (
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
      )}
      {changedAt && (
        <div className="file-view-banner" data-testid="file-changed">
          <span className="grow">{t('files.changed', { time: changedAt })}</span>
          {props.changed && actions.showDiff && (
            <button
              className="btn small ghost"
              onClick={() => actions.showDiff?.({ ...target, kind: 'file' })}
              data-testid="file-changed-diff"
            >
              {t('files.showDiff')}
            </button>
          )}
        </div>
      )}
      <FileBody
        {...props}
        name={name}
        source={source}
        markdown={markdown}
        language={languageOf(target.path, read?.kind === 'text' ? read.text : '')}
      />
    </div>
  )
}

/**
 * Fil d'Ariane (point 16) : le nom du fichier d'abord ; au-delà de deux dossiers, ceux du milieu
 * deviennent « … » (le chemin entier en infobulle).
 */
function Breadcrumb(props: Props & { name: string }) {
  const { t } = useTranslation()
  const { root, target, name } = props
  const dirs = target.path.split('/').slice(0, -1)
  const crumb = (label: string, path: string) => (
    <button
      key={path}
      className="crumb"
      onClick={() => props.onRevealDir(path)}
      data-testid="file-crumb"
    >
      {label}
    </button>
  )
  // Dossiers coupés faute de place : fondus à gauche (seulement alors).
  const dirsBox = useRef<HTMLSpanElement>(null)
  const [clipped, setClipped] = useState(false)
  useEffect(() => {
    const node = dirsBox.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setClipped(node.scrollWidth > node.clientWidth + 1))
    observer.observe(node)
    return () => observer.disconnect()
  }, [target.path])
  const parts: ReactNode[] = []
  if (props.showRoot && root) parts.push(crumb(root.name, ''))
  const at = (i: number) => dirs.slice(0, i + 1).join('/')
  if (dirs.length > 2) {
    parts.push(crumb(dirs[0] ?? '', at(0)))
    const hidden = dirs.slice(1, -1).join('/')
    parts.push(
      <Tip key="more" label={t('files.hiddenDirs', { path: hidden })}>
        <button
          className="crumb more"
          aria-label={t('files.hiddenDirs', { path: hidden })}
          onClick={() => props.onRevealDir(at(dirs.length - 2))}
          data-testid="file-crumb-more"
        >
          …
        </button>
      </Tip>
    )
    parts.push(crumb(dirs.at(-1) ?? '', at(dirs.length - 1)))
  } else dirs.forEach((dir, i) => parts.push(crumb(dir, at(i))))
  return (
    <nav className="file-breadcrumb" aria-label={target.path} data-testid="file-breadcrumb">
      {parts.length > 0 && (
        <span className={`crumb-dirs${clipped ? ' clipped' : ''}`} ref={dirsBox}>
          {parts.map((part, i) => (
            <span key={i} className="crumb-part">
              {part}
              <span className="crumb-sep">/</span>
            </span>
          ))}
        </span>
      )}
      <span className="crumb current" title={props.actions.absolute(target)}>
        {name}
      </span>
    </nav>
  )
}

function FileHeader(props: Props & { name: string; executable: boolean }) {
  const { t } = useTranslation()
  const { target, actions, name } = props
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
      <Breadcrumb {...props} />
      <span className="file-readonly" data-testid="file-readonly">
        {t('files.readOnly')}
      </span>
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
          item={{
            root: target.root,
            path: target.path,
            kind: 'file',
            executable: props.executable
          }}
          actions={actions}
          changed={props.changed}
          {...(target.line ? { line: target.line } : {})}
        />
      </FileActionsMenu>
      {props.viewMenu}
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
  const item = { ...target, kind: 'file' as const, executable: read.executable === true }
  if (read.kind === 'binary') {
    return (
      <div className="file-binary" data-testid="file-binary">
        <p>{t('files.binary', { size: units(read.size) })}</p>
        <div className="file-binary-actions">
          {!item.executable && (
            <button className="btn small" onClick={() => actions.openDefault(item)}>
              <ExternalLink size={13} />
              {t('files.openDefault')}
            </button>
          )}
          <button className="btn small ghost" onClick={() => actions.reveal(item)}>
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
/** Une image plus petite que cela est agrandie (pixels nets) pour se voir. */
const SMALL_IMAGE = 64

/** Facteur entier qui amène une petite image vers `SMALL_IMAGE` px ; 1 pour les autres. */
export function smallImageScale(width: number, height: number): number {
  const side = Math.max(width, height)
  return side > 0 && side < SMALL_IMAGE ? Math.max(1, Math.floor(SMALL_IMAGE / side)) : 1
}

function ImageView({ url, name, size }: { url: string; name: string; size: string }) {
  const [actual, setActual] = useState(false)
  const [natural, setNatural] = useState<{ width: number; height: number }>()
  const dimensions = natural ? `${natural.width} × ${natural.height}` : undefined
  const scale = natural && !actual ? smallImageScale(natural.width, natural.height) : 1
  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') setActual(false)
  }
  return (
    <div className={`file-image${actual ? ' actual' : ''}`} data-testid="file-image">
      <button className="file-image-frame" onClick={() => setActual(!actual)} onKeyDown={onKey}>
        <img
          src={url}
          alt={name}
          className={scale > 1 ? 'enlarged' : undefined}
          style={scale > 1 && natural ? { width: natural.width * scale } : undefined}
          onLoad={(e) => {
            const img = e.currentTarget
            setNatural({ width: img.naturalWidth, height: img.naturalHeight })
          }}
        />
      </button>
      <div className="file-image-info">{[dimensions, size].filter(Boolean).join(' · ')}</div>
    </div>
  )
}
