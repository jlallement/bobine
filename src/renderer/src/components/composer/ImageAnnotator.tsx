import * as Dialog from '@radix-ui/react-dialog'
import { ArrowUpRight, Pencil, Square, Trash2, Type, Undo2, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent
} from 'react'
import { base64Bytes, MAX_IMAGE_BYTES, type ImageAttachment } from '@shared/attachments'
import {
  ANNOTATION_COLORS,
  drawShapes,
  fontSize,
  isMeaningful,
  textFrame,
  toImagePoint,
  type AnnotationTool,
  type Point,
  type Shape
} from '../../annotation'
import { useTranslation } from 'react-i18next'

/** Outils de dessin ; leur nom : clé `annotator.tools.<id>`. */
const TOOLS: { id: AnnotationTool; icon: typeof Square }[] = [
  { id: 'rect', icon: Square },
  { id: 'arrow', icon: ArrowUpRight },
  { id: 'pen', icon: Pencil },
  { id: 'text', icon: Type }
]

/** Une forme plus petite que ça (en pixels de l'image) est un simple clic. */
const MIN_SHAPE = 6
/** Bordure et marge de la saisie du texte : son texte tombe là où il sera dessiné. */
const TEXT_BOX_INSET = { x: 3, y: 1 }

/**
 * Annotation d'une image jointe (fiche 067) : rectangle, flèche, crayon, texte, par-dessus
 * l'image ; « Appliquer » rend l'image annotée à sa taille d'origine.
 */
export function ImageAnnotator({
  image,
  onApply,
  onClose
}: {
  image: ImageAttachment
  onApply: (annotated: ImageAttachment) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [picture, setPicture] = useState<HTMLImageElement | null>(null)
  const [tool, setTool] = useState<AnnotationTool>('rect')
  const [color, setColor] = useState<string>(ANNOTATION_COLORS[0].value)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [draft, setDraft] = useState<Shape | null>(null)
  const [typing, setTyping] = useState<{ at: Point; text: string } | null>(null)
  const [scale, setScale] = useState(1)
  const area = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const textArea = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => setPicture(img)
    img.src = `data:${image.mimeType};base64,${image.data}`
  }, [image])

  // L'image entière dans la place disponible, jamais agrandie.
  useLayoutEffect(() => {
    const el = area.current
    if (!el || !picture) return
    const fit = () => {
      const { width, height } = el.getBoundingClientRect()
      setScale(Math.min(1, width / picture.naturalWidth, height / picture.naturalHeight))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [picture])

  // Affichage : image puis formes, nettes sur un écran Retina.
  useEffect(() => {
    const el = canvas.current
    if (!el || !picture) return
    const ratio = window.devicePixelRatio || 1
    const width = picture.naturalWidth * scale
    const height = picture.naturalHeight * scale
    el.width = Math.round(width * ratio)
    el.height = Math.round(height * ratio)
    el.style.width = `${width}px`
    el.style.height = `${height}px`
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0)
    ctx.drawImage(picture, 0, 0)
    drawShapes(ctx, draft ? [...shapes, draft] : shapes, {
      width: picture.naturalWidth,
      height: picture.naturalHeight
    })
  }, [picture, scale, shapes, draft])

  // Saisie du texte remontée, comme le dessin, si elle dépasserait en bas de l'image (fiche 094).
  useLayoutEffect(() => {
    const el = textArea.current
    if (!el || !typing || !picture) return
    const bottom = picture.naturalHeight * scale - el.offsetHeight + TEXT_BOX_INSET.y
    el.style.top = `${Math.max(0, Math.min(typing.at.y * scale, bottom)) - TEXT_BOX_INSET.y}px`
  }, [typing, picture, scale])

  const pointOf = (event: PointerEvent): Point | null => {
    const el = canvas.current
    if (!el || !picture) return null
    const box = el.getBoundingClientRect()
    return toImagePoint(
      { x: event.clientX, y: event.clientY },
      box,
      box.width / picture.naturalWidth,
      {
        width: picture.naturalWidth,
        height: picture.naturalHeight
      }
    )
  }

  const commitText = useCallback(() => {
    setTyping((current) => {
      if (current?.text.trim()) {
        setShapes((list) => [
          ...list,
          { kind: 'text', color, at: current.at, text: current.text.trim() }
        ])
      }
      return null
    })
  }, [color])

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = pointOf(event)
    if (!point) return
    if (tool === 'text') {
      commitText()
      setTyping({ at: point, text: '' })
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDraft(
      tool === 'pen'
        ? { kind: 'pen', color, points: [point] }
        : { kind: tool, color, from: point, to: point }
    )
  }
  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = pointOf(event)
    if (!point || !draft) return
    setDraft(
      draft.kind === 'pen'
        ? { ...draft, points: [...draft.points, point] }
        : draft.kind === 'text' || draft.kind === 'pin'
          ? draft
          : { ...draft, to: point }
    )
  }
  const onPointerUp = () => {
    if (draft && isMeaningful(draft, MIN_SHAPE)) setShapes((list) => [...list, draft])
    setDraft(null)
  }

  const undo = () => setShapes((list) => list.slice(0, -1))

  const apply = () => {
    if (!picture) return
    const out = document.createElement('canvas')
    out.width = picture.naturalWidth
    out.height = picture.naturalHeight
    const ctx = out.getContext('2d')
    if (!ctx) return
    ctx.drawImage(picture, 0, 0)
    drawShapes(ctx, shapes, { width: picture.naturalWidth, height: picture.naturalHeight })
    let mimeType = 'image/png'
    let data = out.toDataURL(mimeType).split(',')[1] ?? ''
    if (base64Bytes(data) > MAX_IMAGE_BYTES) {
      mimeType = 'image/jpeg'
      data = out.toDataURL(mimeType, 0.85).split(',')[1] ?? ''
    }
    const base = image.name.replace(/\.(png|jpe?g|gif|webp)$/i, '')
    onApply({
      kind: 'image',
      name: `${base}.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
      mimeType,
      data
    })
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (typing) return
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      undo()
    }
  }

  // Même cadre que le dessin : la saisie revient à la ligne là où le texte le fera (fiche 094).
  const frame = typing && picture ? textFrame(typing.at, picture.naturalWidth) : null
  const textBox = typing && picture && frame && (
    <textarea
      ref={textArea}
      className="annotator-text"
      autoFocus
      rows={1}
      value={typing.text}
      style={{
        left: frame.x * scale - TEXT_BOX_INSET.x,
        maxWidth: frame.width * scale,
        minWidth: Math.min(120, frame.width * scale),
        color,
        fontSize: fontSize(picture.naturalWidth) * scale
      }}
      onChange={(e) => setTyping({ ...typing, text: e.target.value })}
      onKeyDown={(e) => {
        // Entrée valide ; Maj+Entrée va à la ligne.
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          commitText()
        } else if (e.key === 'Escape') {
          // Abandonne ce texte, sans fermer l'annotation.
          e.preventDefault()
          e.stopPropagation()
          setTyping(null)
        }
      }}
      onBlur={commitText}
      placeholder={t('annotator.textPlaceholder')}
      title={t('annotator.textHint')}
      data-testid="annotator-text"
    />
  )

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog annotator" onKeyDown={onKeyDown} data-testid="annotator">
          <Dialog.Title className="sr-only">{t('annotator.title')}</Dialog.Title>
          <Dialog.Description className="sr-only">{t('annotator.description')}</Dialog.Description>
          <div className="annotator-bar">
            <div className="segmented" role="radiogroup" aria-label={t('annotator.tool')}>
              {TOOLS.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={tool === id}
                  className={tool === id ? 'active' : ''}
                  onClick={() => {
                    commitText()
                    setTool(id)
                  }}
                  title={t(`annotator.tools.${id}`)}
                  aria-label={t(`annotator.tools.${id}`)}
                  data-testid={`annotator-tool-${id}`}
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>
            <div
              className="annotator-colors"
              role="radiogroup"
              aria-label={t('annotator.color.label')}
            >
              {ANNOTATION_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={color === c.value}
                  className={`annotator-color${color === c.value ? ' active' : ''}`}
                  style={{ background: c.value }}
                  onClick={() => setColor(c.value)}
                  title={t(`annotator.color.${c.id}`)}
                  aria-label={t(`annotator.color.${c.id}`)}
                  data-testid={`annotator-color-${c.id}`}
                />
              ))}
            </div>
            <button
              type="button"
              className="icon-button small"
              onClick={undo}
              disabled={shapes.length === 0}
              title={t('annotator.undoTip')}
              aria-label={t('annotator.undo')}
              data-testid="annotator-undo"
            >
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              className="icon-button small"
              onClick={() => setShapes([])}
              disabled={shapes.length === 0}
              title={t('annotator.clear')}
              aria-label={t('annotator.clear')}
              data-testid="annotator-clear"
            >
              <Trash2 size={15} />
            </button>
            <span className="grow" />
            <Dialog.Close className="btn ghost" data-testid="annotator-close">
              {t('common.close')}
            </Dialog.Close>
            <button
              type="button"
              className="btn primary"
              onClick={apply}
              disabled={shapes.length === 0 || !picture}
              data-testid="annotator-apply"
            >
              {t('annotator.apply')}
            </button>
          </div>
          <div className="annotator-area" ref={area}>
            {/* Cadre à la taille du canevas : la saisie du texte s'y place en coordonnées de l'image. */}
            <div className="annotator-stage">
              <canvas
                ref={canvas}
                // Caché tant que l'image n'est pas là (sinon la taille par défaut d'un canevas,
                // 300 × 150, s'affiche un instant).
                hidden={!picture}
                data-ready={picture ? 'true' : undefined}
                className={`annotator-canvas tool-${tool}`}
                // Le canevas ne prend pas le focus : le texte en cours ne se valide pas vide.
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                data-testid="annotator-canvas"
              />
              {textBox}
            </div>
          </div>
          <Dialog.Close className="icon-button annotator-x" aria-label={t('common.close')}>
            <X size={16} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
