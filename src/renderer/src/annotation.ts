/**
 * Annotation d'une image jointe (fiche 067) : formes dessinées par-dessus, en coordonnées de
 * l'image (pas de l'écran), puis dessinées sur un contexte 2D — celui de l'affichage ou celui de
 * l'export à la taille d'origine.
 */

export interface Point {
  x: number
  y: number
}

export type AnnotationTool = 'rect' | 'arrow' | 'pen' | 'text'

export type Shape =
  | { kind: 'rect'; color: string; from: Point; to: Point }
  | { kind: 'arrow'; color: string; from: Point; to: Point }
  | { kind: 'pen'; color: string; points: Point[] }
  | { kind: 'text'; color: string; at: Point; text: string }
  /** Épingle numérotée d'une remarque sur la page (fiche 132) : sa pointe est en `at`. */
  | { kind: 'pin'; color: string; at: Point; label: string }

export const ANNOTATION_COLORS = [
  { id: 'red', value: '#e5484d' },
  { id: 'yellow', value: '#f5c518' },
  { id: 'blue', value: '#3b82f6' },
  { id: 'black', value: '#1f1f1f' }
] as const

/** Ce que le dessin utilise d'un `CanvasRenderingContext2D` (remplaçable en test). */
export type DrawContext = Pick<
  CanvasRenderingContext2D,
  | 'beginPath'
  | 'arc'
  | 'moveTo'
  | 'lineTo'
  | 'stroke'
  | 'fill'
  | 'closePath'
  | 'strokeRect'
  | 'fillText'
  | 'strokeText'
  | 'measureText'
  | 'save'
  | 'restore'
> & {
  strokeStyle: CanvasRenderingContext2D['strokeStyle']
  fillStyle: CanvasRenderingContext2D['fillStyle']
  lineWidth: number
  lineCap: CanvasLineCap
  lineJoin: CanvasLineJoin
  font: string
  textBaseline: CanvasTextBaseline
}

/** Épaisseur du trait, proportionnée à l'image (lisible une fois réduite par l'agent). */
export function strokeWidth(imageWidth: number): number {
  return Math.max(3, Math.round(imageWidth / 250))
}

/** Taille du texte, proportionnée à l'image. */
export function fontSize(imageWidth: number): number {
  return Math.max(16, Math.round(imageWidth / 45))
}

/** Police du texte : la même pour la saisie à l'écran et le dessin. */
export const TEXT_FONT_FAMILY = '-apple-system, system-ui, sans-serif'
/** Interligne du texte, en tailles de texte. */
export const TEXT_LINE_HEIGHT = 1.2
/** Au plus 20 tailles de texte par ligne (une quarantaine de caractères), puis à la ligne. */
const TEXT_MAX_EM = 20
/** Avec moins de place que ça avant le bord droit, le texte se décale vers la gauche. */
const TEXT_MIN_EM = 8

/**
 * Où commence un texte posé en `at` et sur quelle largeur il revient à la ligne (fiche 094), en
 * pixels de l'image : jamais au-delà du bord droit.
 */
export function textFrame(at: Point, imageWidth: number): { x: number; width: number } {
  const size = fontSize(imageWidth)
  const max = Math.min(size * TEXT_MAX_EM, imageWidth)
  const width = Math.min(max, Math.max(Math.min(size * TEXT_MIN_EM, max), imageWidth - at.x))
  return { x: Math.max(0, Math.min(at.x, imageWidth - width)), width }
}

/**
 * Lignes d'un texte qui revient à la ligne à `width` : entre les mots, au milieu d'un mot trop long
 * pour tenir seul ; les retours à la ligne saisis sont gardés.
 */
export function wrapText(text: string, width: number, measure: (part: string) => number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word
      if (measure(candidate) <= width) {
        line = candidate
        continue
      }
      if (line) lines.push(line)
      line = ''
      for (const char of word) {
        if (line && measure(line + char) > width) {
          lines.push(line)
          line = ''
        }
        line += char
      }
    }
    lines.push(line)
  }
  return lines
}

/** Point de l'écran (dans le canevas affiché, à l'échelle `scale`) → point de l'image. */
export function toImagePoint(
  client: Point,
  box: { left: number; top: number },
  scale: number,
  size: { width: number; height: number }
): Point {
  const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v))
  return {
    x: clamp((client.x - box.left) / scale, size.width),
    y: clamp((client.y - box.top) / scale, size.height)
  }
}

/** Les deux extrémités de la pointe d'une flèche qui va de `from` à `to`. */
export function arrowHead(from: Point, to: Point, length: number): [Point, Point] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const spread = Math.PI / 7
  return [
    { x: to.x - length * Math.cos(angle - spread), y: to.y - length * Math.sin(angle - spread) },
    { x: to.x - length * Math.cos(angle + spread), y: to.y - length * Math.sin(angle + spread) }
  ]
}

/** Une forme trop petite (simple clic) n'est pas gardée. */
export function isMeaningful(shape: Shape, minimum: number): boolean {
  if (shape.kind === 'pin') return true
  if (shape.kind === 'text') return shape.text.trim().length > 0
  if (shape.kind === 'pen') return shape.points.length > 1
  return Math.hypot(shape.to.x - shape.from.x, shape.to.y - shape.from.y) >= minimum
}

/** Dessine les formes, en coordonnées de l'image, pour une image de cette taille. */
export function drawShapes(
  ctx: DrawContext,
  shapes: readonly Shape[],
  image: { width: number; height: number }
): void {
  const width = strokeWidth(image.width)
  for (const shape of shapes) {
    ctx.save()
    ctx.strokeStyle = shape.color
    ctx.fillStyle = shape.color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (shape.kind === 'rect') {
      const x = Math.min(shape.from.x, shape.to.x)
      const y = Math.min(shape.from.y, shape.to.y)
      ctx.strokeRect(x, y, Math.abs(shape.to.x - shape.from.x), Math.abs(shape.to.y - shape.from.y))
    } else if (shape.kind === 'arrow') {
      ctx.beginPath()
      ctx.moveTo(shape.from.x, shape.from.y)
      ctx.lineTo(shape.to.x, shape.to.y)
      ctx.stroke()
      const [a, b] = arrowHead(shape.from, shape.to, width * 5)
      ctx.beginPath()
      ctx.moveTo(shape.to.x, shape.to.y)
      ctx.lineTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.closePath()
      ctx.fill()
    } else if (shape.kind === 'pen') {
      const [first, ...rest] = shape.points
      if (first) {
        ctx.beginPath()
        ctx.moveTo(first.x, first.y)
        for (const p of rest) ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }
    } else if (shape.kind === 'pin') {
      drawPin(ctx, shape, image.width)
    } else {
      drawText(ctx, shape, image, width)
    }
    ctx.restore()
  }
}

/** Côté d'une épingle, proportionné à l'image (26 px à l'écran, fiche 132). */
export function pinSize(imageWidth: number): number {
  return Math.max(24, Math.round(imageWidth / 36))
}

/**
 * Épingle comme à l'écran (fiche 132) : goutte de la couleur, coins arrondis sauf celui du bas à
 * gauche, pointé sur `at` ; bord blanc, numéro blanc au centre.
 */
function drawPin(ctx: DrawContext, shape: Extract<Shape, { kind: 'pin' }>, imageWidth: number) {
  const size = pinSize(imageWidth)
  const r = size / 2
  const { x, y } = shape.at
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y - r)
  ctx.arc(x + r, y - r, r, Math.PI, 2.5 * Math.PI)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = Math.max(2, size / 13)
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.font = `600 ${Math.round(size * 0.46)}px ${TEXT_FONT_FAMILY}`
  ctx.textBaseline = 'middle'
  const width = ctx.measureText(shape.label).width
  ctx.fillText(shape.label, x + r - width / 2, y - r)
}

/**
 * Texte lisible sur tout fond : contour blanc, puis la couleur ; revient à la ligne (fiche 094) et
 * remonte s'il dépasserait en bas de l'image.
 */
function drawText(
  ctx: DrawContext,
  shape: Extract<Shape, { kind: 'text' }>,
  image: { width: number; height: number },
  stroke: number
): void {
  const size = fontSize(image.width)
  ctx.font = `600 ${size}px ${TEXT_FONT_FAMILY}`
  ctx.textBaseline = 'top'
  const frame = textFrame(shape.at, image.width)
  const lines = wrapText(shape.text, frame.width, (part) => ctx.measureText(part).width)
  const lineHeight = size * TEXT_LINE_HEIGHT
  const top = Math.max(0, Math.min(shape.at.y, image.height - lines.length * lineHeight))
  // Demi-interligne au-dessus de chaque ligne, comme la saisie à l'écran (CSS).
  const y = (i: number) => top + i * lineHeight + (lineHeight - size) / 2
  // Tous les contours d'abord : celui d'une ligne ne mord pas sur la précédente.
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = Math.max(3, stroke)
  lines.forEach((line, i) => ctx.strokeText(line, frame.x, y(i)))
  lines.forEach((line, i) => ctx.fillText(line, frame.x, y(i)))
}
