import {
  ArrowLeft,
  ArrowRight,
  CircleExclamationPoint,
  CircleCheck,
  Globe,
  MessageSquarePlus,
  RotateCw,
  X
} from 'lucide-react'
import type { ImageAttachment } from '@shared/attachments'
import { AttachImageButton } from './AttachImageButton'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { BrowserDownload, BrowserState } from '@shared/browser'
import { DevServersBar } from './DevServersBar'
import { Tip } from '../common/Menus'
import { useTranslation } from 'react-i18next'
import { ipcErrorText } from '../../ipc-errors'
import { AnnotateHint, PageAnnotator, PageNotesBar } from './PageAnnotator'
import { usePageAnnotation } from '../../usePageAnnotation'

/** Durée du bandeau d'un téléchargement terminé (fiche 094). */
const DOWNLOAD_NOTICE_MS = 8000
/** Ce qui peut passer sur la page : fenêtres et menus de l'app. */
const COVERS = '.dialog-overlay, [role="menu"]'
/** Images suivies après un changement (menu qui s'ouvre et se place, panneau qui s'anime). */
const FOLLOW_FRAMES = 20

/** Un menu ouvert passe sur cette zone. */
function menuOver(area: DOMRect): boolean {
  return [...document.querySelectorAll('[role="menu"]')].some((menu) => {
    const r = menu.getBoundingClientRect()
    return r.left < area.right && r.right > area.left && r.top < area.bottom && r.bottom > area.top
  })
}

/** Une fenêtre ou un menu de l'app apparaît ou disparaît dans ces changements du DOM. */
function coversChanged(records: MutationRecord[]): boolean {
  return records.some((record) =>
    [...record.addedNodes, ...record.removedNodes].some(
      (node) => node instanceof Element && (node.matches(COVERS) || !!node.querySelector(COVERS))
    )
  )
}

/**
 * Onglet « Navigateur » (fiche 007) : la page de la conversation est une vue native placée par le
 * main exactement sur la zone réservée ici ; la barre d'outils reste dans l'UI.
 */
export function BrowserTab({
  conversationId,
  onAttach,
  onSendNotes
}: {
  conversationId: string
  /** « Joindre au message » (fiche 066). */
  onAttach?: (image: ImageAttachment) => void
  /** Remarques sur la page (fiches 132, 146) : un message à l'agent, captures annotées. */
  onSendNotes?: ((text: string, images: ImageAttachment[]) => void) | undefined
}) {
  const { t } = useTranslation()
  const [state, setState] = useState<BrowserState | null>(null)
  const [address, setAddress] = useState('')
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [download, setDownload] = useState<BrowserDownload | null>(null)
  const area = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  // Mode Annoter (fiches 132, 146) : la page reste vivante ; figée seulement le temps d'écrire
  // une remarque (brouillon), où la vue native n'est plus posée.
  const shown = state && state.url !== '' && state.url !== 'about:blank' ? state : null
  const annotation = usePageAnnotation(
    conversationId,
    shown ? { url: shown.url, tab: shown.activeTab } : null,
    onSendNotes,
    setError
  )
  const { annotating, draft } = annotation
  const frozen = !!draft

  useEffect(() => {
    let alive = true
    void window.api.browser.getState(conversationId).then((s) => {
      if (alive && s) setState(s)
    })
    const off = window.api.browser.onState((s) => {
      if (s.conversationId === conversationId) setState(s)
    })
    return () => {
      alive = false
      off()
    }
  }, [conversationId])

  // Téléchargement enregistré ou en échec (fiche 094) : un bandeau qui s'efface seul.
  useEffect(
    () =>
      window.api.browser.onDownload((d) => {
        if (d.conversationId === conversationId) setDownload(d)
      }),
    [conversationId]
  )
  useEffect(() => {
    if (!download) return
    const timer = setTimeout(() => setDownload(null), DOWNLOAD_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [download])

  const hasPage = !!state && state.url !== '' && state.url !== 'about:blank'

  // La vue native suit la zone réservée (fiche 129) : taille de la colonne, panneau agrandi,
  // fenêtre, zoom de l'interface. Le main convertit les pixels CSS envoyés selon ce zoom.
  useEffect(() => {
    const el = area.current
    if (!hasPage || !el || frozen) return
    let frame = 0
    let frames = 0
    let last = ''
    const place = () => {
      // Une fenêtre de l'app est ouverte, ou un menu qui passe sur la page (« + » du panneau,
      // fiche 082) : la vue native, posée par-dessus toute la page, les couvrirait et prendrait
      // leurs clics ; masquée le temps qu'ils restent ouverts.
      const r = el.getBoundingClientRect()
      if (document.querySelector('.dialog-overlay') || menuOver(r)) {
        if (last !== 'masquée') {
          last = 'masquée'
          void window.api.browser.hide()
        }
        return
      }
      const key = `${r.x},${r.y},${r.width},${r.height}`
      if (key === last) return
      last = key
      void window.api.browser.show(conversationId, {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height
      })
    }
    // Placée tout de suite, puis suivie quelques images (un menu se place après son ouverture).
    const follow = () => {
      place()
      frames = FOLLOW_FRAMES
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const tick = () => {
      frame = 0
      place()
      if (--frames > 0) frame = requestAnimationFrame(tick)
    }
    const resize = new ResizeObserver(follow)
    resize.observe(el)
    const covers = new MutationObserver((records) => {
      if (coversChanged(records)) follow()
    })
    covers.observe(document.body, { childList: true, subtree: true })
    // Fenêtre redimensionnée ou zoom de l'interface : la zone bouge sans changer de taille CSS.
    window.addEventListener('resize', follow)
    follow()
    return () => {
      resize.disconnect()
      covers.disconnect()
      window.removeEventListener('resize', follow)
      cancelAnimationFrame(frame)
      void window.api.browser.hide()
    }
  }, [conversationId, hasPage, frozen])

  // ⌘L tapé dans la page (fiche 129) : le champ d'adresse prend le clavier.
  useEffect(
    () =>
      window.api.browser.onCommand((command) => {
        if (command.conversationId !== conversationId) return
        if (command.command === 'focus-address') input.current?.focus()
      }),
    [conversationId]
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!address.trim()) return
    setEditing(false)
    setError(null)
    // Comme un navigateur : la barre rend la main une fois l'adresse validée.
    input.current?.blur()
    window.api.browser.navigate(conversationId, address).catch((e: unknown) => {
      setError(ipcErrorText(e))
    })
  }

  return (
    <div className="browser-tab" data-testid="browser-tab">
      {state && state.tabs.length > 1 && (
        <div className="browser-tabs" role="tablist" data-testid="browser-tabs">
          {state.tabs.map((tab) => (
            <div
              key={tab.id}
              className={`browser-tab-chip${tab.id === state.activeTab ? ' active' : ''}`}
              data-testid="browser-tab-chip"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab.id === state.activeTab}
                title={tab.url}
                onClick={() => void window.api.browser.selectTab(conversationId, tab.id)}
              >
                {tab.title || tab.url || t('browser.newTab')}
              </button>
              <button
                type="button"
                className="browser-tab-close"
                aria-label={t('browser.closeTab')}
                onClick={() => void window.api.browser.closeTab(conversationId, tab.id)}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      <form className="browser-bar" onSubmit={submit}>
        <Tip label={t('browser.back')}>
          <button
            type="button"
            className="icon-button small"
            disabled={!state?.canGoBack}
            onClick={() => void window.api.browser.go(conversationId, 'back')}
            aria-label={t('browser.back')}
          >
            <ArrowLeft size={15} />
          </button>
        </Tip>
        <Tip label={t('browser.forward')}>
          <button
            type="button"
            className="icon-button small"
            disabled={!state?.canGoForward}
            onClick={() => void window.api.browser.go(conversationId, 'forward')}
            aria-label={t('browser.forward')}
          >
            <ArrowRight size={15} />
          </button>
        </Tip>
        <Tip label={state?.loading ? t('browser.stop') : t('browser.reload')}>
          <button
            type="button"
            className="icon-button small"
            disabled={!hasPage}
            onClick={() =>
              void window.api.browser.go(conversationId, state?.loading ? 'stop' : 'reload')
            }
            aria-label={state?.loading ? t('browser.stop') : t('browser.reload')}
          >
            {state?.loading ? <X size={15} /> : <RotateCw size={14} />}
          </button>
        </Tip>
        <span className="browser-address-field">
          <input
            ref={input}
            className="browser-address"
            value={editing ? address : hasPage ? (state?.url ?? '') : address}
            placeholder={t('browser.addressPlaceholder')}
            spellCheck={false}
            onFocus={(e) => {
              setEditing(true)
              setAddress(hasPage ? (state?.url ?? '') : address)
              e.currentTarget.select()
            }}
            onBlur={() => setEditing(false)}
            onChange={(e) => setAddress(e.target.value)}
            data-testid="browser-address"
          />
          {hasPage && state && <PageChips conversationId={conversationId} state={state} />}
        </span>
        {onSendNotes && (
          <Tip label={t('browser.annotate.button')}>
            <button
              type="button"
              className={`icon-button small${annotating ? ' annotating' : ''}`}
              disabled={!hasPage && !annotating}
              aria-pressed={annotating}
              aria-label={t('browser.annotate.button')}
              onClick={() => void annotation.toggle()}
              data-testid="browser-annotate"
            >
              <MessageSquarePlus size={15} />
            </button>
          </Tip>
        )}
        {onAttach && (
          <AttachImageButton
            label={t('browser.attach')}
            testId="browser-attach"
            disabled={!hasPage}
            take={() => window.api.browser.capture(conversationId)}
            onAttach={onAttach}
          />
        )}
      </form>
      {annotating && <AnnotateHint />}
      {error && <div className="browser-error">{error}</div>}
      {download && (
        <DownloadNotice
          download={download}
          onShow={(path) => void window.api.browser.showDownload(conversationId, path)}
          onDismiss={() => setDownload(null)}
        />
      )}
      <DevServersBar
        conversationId={conversationId}
        onOpen={(url) => void window.api.browser.navigate(conversationId, url)}
      />
      <div className="browser-page" ref={area} data-testid="browser-page">
        {draft && (
          <PageAnnotator
            key={draft.id}
            draft={draft}
            number={annotation.draftNumber}
            onSave={annotation.save}
            onCancel={annotation.cancel}
            onDelete={annotation.remove}
          />
        )}
        {!hasPage && !annotating && (
          <div className="side-panel-empty">
            <Globe size={22} />
            <p>{t('browser.empty')}</p>
          </div>
        )}
      </div>
      {onSendNotes && <PageNotesBar annotation={annotation} />}
    </div>
  )
}

/**
 * Puces du champ d'adresse (fiche 129) : zoom de la page hors de 100 %, taille d'écran imposée
 * par l'agent. Un clic revient à 100 %, ou à la largeur du panneau.
 */
function PageChips({ conversationId, state }: { conversationId: string; state: BrowserState }) {
  const { t } = useTranslation()
  const zoom = Math.round(state.zoom * 100)
  const { emulation } = state
  return (
    <>
      {emulation && (
        <Tip label={t('browser.emulation.tip', { percent: Math.round(emulation.scale * 100) })}>
          <button
            type="button"
            className="browser-chip"
            aria-label={t('browser.emulation.tip', {
              percent: Math.round(emulation.scale * 100)
            })}
            onClick={() => void window.api.browser.clearEmulation(conversationId)}
            data-testid="browser-emulation"
          >
            {t('browser.emulation.chip', { width: emulation.width, height: emulation.height })}
          </button>
        </Tip>
      )}
      {zoom !== 100 && (
        <Tip label={t('browser.zoom.reset', { percent: zoom })}>
          <button
            type="button"
            className="browser-chip"
            aria-label={t('browser.zoom.reset', { percent: zoom })}
            onClick={() => void window.api.browser.zoom(conversationId, 'reset')}
            data-testid="browser-zoom"
          >
            {t('browser.zoom.chip', { percent: zoom })}
          </button>
        </Tip>
      )}
    </>
  )
}

/** Bandeau d'un téléchargement terminé, sous la barre d'adresse (fiche 094). */
function DownloadNotice({
  download,
  onShow,
  onDismiss
}: {
  download: BrowserDownload
  onShow: (path: string) => void
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  const { path } = download
  const saved = download.state === 'completed'
  return (
    <div
      className={`panel-note browser-download${saved ? '' : ' failed'}`}
      role="status"
      data-testid="browser-download"
    >
      {saved ? <CircleCheck size={14} /> : <CircleExclamationPoint size={14} />}
      <span className="browser-download-text">
        {t(saved ? 'browser.download.saved' : 'browser.download.failed', { name: download.name })}
      </span>
      {path && (
        <button
          type="button"
          className="link-button"
          onClick={() => onShow(path)}
          data-testid="browser-download-show"
        >
          {t('browser.download.show')}
        </button>
      )}
      <button
        type="button"
        className="icon-button small"
        aria-label={t('common.close')}
        onClick={onDismiss}
      >
        <X size={13} />
      </button>
    </div>
  )
}
