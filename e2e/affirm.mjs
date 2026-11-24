/**
 * Captures qui affirment (chantier « pyramide », après l'inventaire `docs/tests/inventaire-e2e-*`).
 *
 * Une capture seule ne protège rien : personne ne regarde chaque matin des centaines d'images, et
 * une comparaison d'images au pixel près casse à chaque police, chaque antialiasing, chaque runner.
 * Ici, une capture est toujours accompagnée de **mesures du DOM réel** (boîtes, débordements, styles
 * calculés, contraste) : ce qu'une capture montrerait de travers fait échouer l'essai, avec la
 * mesure dans le message. L'image reste pour comprendre l'échec ; elle n'est jamais l'oracle.
 *
 * `affirm(ui, nom, [sondes])` prend la capture puis passe chaque sonde ; une sonde est une
 * expression évaluée dans la page qui rend `{ ok, detail }`. Les sondes ci-dessous couvrent ce que
 * les vérifications classées `capture` de l'inventaire mesuraient déjà dans leurs suites
 * (positions, débordement, alignement, couleur calculée) : elles survivent ainsi à la réduction de
 * ces suites, dans les journées types.
 */
import { check } from './lib.mjs'

const q = (selector) => `document.querySelector(${JSON.stringify(selector)})`
const sonde = (label, body) => ({ label, js: `(() => {\n${body}\n})()` })

/**
 * Débordements du fil (fiche 173) : le cadre du fil et ses ancêtres (`scrollWidth > clientWidth`),
 * les éléments du fil qui sortent de la colonne sans être dans un cadre qui les coupe ou les fait
 * défiler (les plus profonds seulement), et le nombre de blocs qui défilent dans leur propre cadre.
 */
export const MEASURE = `(() => {
  const scroll = document.querySelector('.scroll')
  const column = scroll.querySelector('.column').getBoundingClientRect()
  const columnEl = scroll.querySelector('.column')
  // Un cadre qui coupe ou fait défiler son contenu (sauf la colonne elle-même, filet de sécurité).
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== columnEl; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== 'visible') return true
    }
    return false
  }
  // Sort de la colonne : la boîte de l'élément, ou son texte qui dépasse de sa boîte.
  const out = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width === 0) return false
    const text = getComputedStyle(el).overflowX === 'visible' && el.clientWidth > 0 ? r.left + el.scrollWidth : r.right
    return Math.max(r.right, text) > column.right + 1 || r.left < column.left - 1
  }
  const name = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '') + (el.dataset.testid ? '[' + el.dataset.testid + ']' : '')
  const offenders = []
  for (const el of scroll.querySelectorAll('.thread *')) {
    if (!out(el) || clipped(el)) continue
    if ([...el.children].some(out)) continue
    const r = el.getBoundingClientRect()
    const right = Math.max(r.right, r.left + el.scrollWidth)
    offenders.push(name(el) + ' (' + Math.round(r.left - column.left) + '…' + Math.round(right - column.left) + ' / ' + Math.round(column.width) + ')')
  }
  const ancestors = []
  for (let p = scroll.parentElement; p; p = p.parentElement) {
    ancestors.push({ name: name(p), scrollWidth: p.scrollWidth, clientWidth: p.clientWidth })
  }
  const framed = [...scroll.querySelectorAll('.thread *')].filter((el) => {
    const o = getComputedStyle(el).overflowX
    return (o === 'auto' || o === 'scroll') && el.scrollWidth > el.clientWidth
  }).length
  return {
    scroll: { scrollWidth: scroll.scrollWidth, clientWidth: scroll.clientWidth },
    offenders: offenders.slice(0, 20),
    ancestors,
    framed
  }
})()`

/**
 * Contraste WCAG (luminance relative) du texte d'un élément sur son fond réel : le premier fond
 * opaque en remontant les ancêtres, les fonds translucides composés par-dessus.
 */
const CONTRAST = `
  const parse = (c) => { const m = c.match(/[\\d.]+/g)?.map(Number) ?? [0, 0, 0, 0]; return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 } }
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 })
  const backdrop = (el) => {
    const layers = []
    for (let p = el; p; p = p.parentElement) {
      const c = parse(getComputedStyle(p).backgroundColor)
      if (c.a > 0) layers.push(c)
      if (c.a >= 1) break
    }
    let color = { r: 255, g: 255, b: 255, a: 1 }
    for (const layer of layers.reverse()) color = over(layer, color)
    return color
  }
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (el) => {
    const bg = backdrop(el)
    const fg = over(parse(getComputedStyle(el).color), bg)
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x)
    return (a + 0.05) / (b + 0.05)
  }`

/** Sondes de mise en page, à passer à `affirm`. */
export const probes = {
  /** Ni la page ni le cadre `selector` ne défilent de côté. */
  noSideScroll: (selector = '.main > .scroll') =>
    sonde(
      `rien ne défile de côté (${selector})`,
      `const el = ${q(selector)}
      if (!el) return { ok: false, detail: 'introuvable' }
      const page = document.documentElement.scrollWidth - innerWidth
      const own = el.scrollWidth - el.clientWidth
      return { ok: page <= 1 && own <= 1, detail: 'page +' + page + ' px, cadre +' + own + ' px' }`
    ),

  /**
   * Le fil tient dans sa colonne (sonde `MEASURE`, fiche 173) : aucun élément ne dépasse hors d'un
   * cadre, aucun ancêtre ne défile de côté, et un décalage forcé (`scrollLeft`) ne prend pas ;
   * `framed` : au moins ce nombre de blocs larges défilent dans leur propre cadre.
   */
  threadFits: ({ framed = 0 } = {}) =>
    sonde(
      `le fil tient dans sa colonne${framed ? `, ≥ ${framed} bloc(s) large(s) dans leur cadre` : ''}`,
      `const m = ${MEASURE}
      const s = document.querySelector('.scroll')
      const before = s.scrollLeft
      s.scrollLeft = 200
      const left = s.scrollLeft
      s.scrollLeft = before
      const wide = m.ancestors.filter((a) => a.scrollWidth > a.clientWidth).map((a) => a.name + ' ' + a.scrollWidth + ' > ' + a.clientWidth)
      const ok = m.scroll.scrollWidth <= m.scroll.clientWidth && m.offenders.length === 0 && wide.length === 0 && left === 0 && m.framed >= ${framed}
      return { ok, detail: 'fil ' + m.scroll.scrollWidth + '/' + m.scroll.clientWidth + ' px, scrollLeft ' + left + ', ' + m.framed + ' cadre(s)' + (m.offenders.length ? ' — dépassent : ' + m.offenders.join(' ; ') : '') + (wide.length ? ' — défilent : ' + wide.join(' ; ') : '') }`
    ),

  /** `inner` (premier trouvé) tient dans la boîte de `outer` (à 1 px près). */
  inside: (inner, outer, label) =>
    sonde(
      label ?? `${inner} dans ${outer}`,
      `const a = ${q(inner)}, b = ${q(outer)}
      if (!a || !b) return { ok: false, detail: (a ? '' : '${inner} ') + (b ? '' : '${outer} ') + 'introuvable' }
      const r = a.getBoundingClientRect(), o = b.getBoundingClientRect()
      const ok = r.left >= o.left - 1 && r.right <= o.right + 1 && r.top >= o.top - 1 && r.bottom <= o.bottom + 1
      return { ok, detail: [r.left, r.top, r.right, r.bottom].map(Math.round).join(',') + ' dans ' + [o.left, o.top, o.right, o.bottom].map(Math.round).join(',') }`
    ),

  /** Tous les éléments de `selector` tiennent dans la largeur de la fenêtre (aucun bord coupé). */
  inWidth: (selector, label) =>
    sonde(
      label ?? `${selector} dans la largeur de la fenêtre`,
      `const boxes = [...document.querySelectorAll(${JSON.stringify(selector)})].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0)
      if (boxes.length === 0) return { ok: false, detail: 'introuvable' }
      const left = Math.min(...boxes.map((r) => r.left)), right = Math.max(...boxes.map((r) => r.right))
      return { ok: left >= -1 && right <= innerWidth + 1, detail: Math.round(left) + '…' + Math.round(right) + ' / ' + innerWidth + ' px' }`
    ),

  /** Le bas de `top` est au-dessus du haut de `bottom`, avec au moins `gap` px entre les deux. */
  above: (top, bottom, gap = 0, label) =>
    sonde(
      label ?? `${top} au-dessus de ${bottom} (≥ ${gap} px)`,
      `const a = ${q(top)}, b = ${q(bottom)}
      if (!a || !b) return { ok: false, detail: 'introuvable' }
      const space = b.getBoundingClientRect().top - a.getBoundingClientRect().bottom
      return { ok: space >= ${gap} - 0.5, detail: 'écart ' + Math.round(space * 10) / 10 + ' px' }`
    ),

  /** Tous les éléments de `selector` visibles commencent au même x (tolérance `tolerance` px). */
  sameLeft: (selector, tolerance = 1, label) =>
    sonde(
      label ?? `${selector} alignés à gauche (±${tolerance} px)`,
      `const xs = [...document.querySelectorAll(${JSON.stringify(selector)})].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => Math.round(r.left * 10) / 10)
      if (xs.length < 2) return { ok: false, detail: xs.length + ' élément(s)' }
      return { ok: Math.max(...xs) - Math.min(...xs) <= ${tolerance}, detail: 'x = ' + xs.join(', ') }`
    ),

  /** Tous les enfants visibles de `selector` sont sur une seule rangée (même haut, ±2 px). */
  oneRow: (selector, label) =>
    sonde(
      label ?? `${selector} sur une seule rangée`,
      `const el = ${q(selector)}
      if (!el) return { ok: false, detail: 'introuvable' }
      const tops = [...el.children].map((c) => c.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0).map((r) => Math.round(r.top))
      return { ok: tops.length > 0 && Math.max(...tops) - Math.min(...tops) <= 2, detail: 'hauts ' + tops.join(', ') }`
    ),

  /**
   * Aucun texte coupé dans `selector` : un élément qui coupe son contenu (`overflow` autre que
   * visible, ou points de suspension) le montre en entier — sauf s'il porte une infobulle (`title`)
   * et que `allowTitled` le permet.
   */
  nothingClipped: (selector, { allowTitled = false } = {}, label) =>
    sonde(
      label ?? `rien de coupé dans ${selector}`,
      `const root = ${q(selector)}
      if (!root) return { ok: false, detail: 'introuvable' }
      const cut = [...root.querySelectorAll('*')].filter((el) => {
        const s = getComputedStyle(el)
        if (s.overflowX === 'visible' && s.textOverflow !== 'ellipsis') return false
        if (el.clientWidth === 0 || el.scrollWidth <= el.clientWidth + 1) return false
        if (s.overflowX === 'auto' || s.overflowX === 'scroll') return false
        return !(${allowTitled} && el.closest('[title]'))
      }).map((el) => (el.dataset.testid || el.className || el.tagName) + ' « ' + el.innerText.trim().slice(0, 30) + ' » ' + el.scrollWidth + '>' + el.clientWidth)
      return { ok: cut.length === 0, detail: cut.length ? cut.slice(0, 5).join(' ; ') : 'rien de coupé' }`
    ),

  /** Propriété CSS calculée de `selector` égale à `expected` (`rgb(…)` pour une couleur). */
  computed: (selector, property, expected, label) =>
    sonde(
      label ?? `${selector} : ${property} = ${expected}`,
      `const el = ${q(selector)}
      if (!el) return { ok: false, detail: 'introuvable' }
      const value = getComputedStyle(el).getPropertyValue(${JSON.stringify(property)}).trim()
      return { ok: value === ${JSON.stringify(expected)}, detail: value }`
    ),

  /** Contraste du texte de `selector` sur son fond réel ≥ `min` (WCAG : 4,5 pour le texte courant). */
  contrast: (selector, min = 4.5, label) =>
    sonde(
      label ?? `contraste de ${selector} ≥ ${min}:1`,
      `${CONTRAST}
      const el = ${q(selector)}
      if (!el) return { ok: false, detail: 'introuvable' }
      const r = ratio(el)
      return { ok: r >= ${min}, detail: (Math.round(r * 100) / 100) + ':1' }`
    ),

  /** Sonde libre : `body` est le corps d'une fonction de la page qui rend `{ ok, detail }`. */
  custom: (label, body) => sonde(label, body)
}

/**
 * Capture qui affirme : la capture `name` (comme `ui.shot`), puis chaque sonde, chacune un `check`
 * qui dit sa mesure. Une sonde illisible (page partie, sélecteur faux) échoue aussi.
 */
export async function affirm(ui, name, list) {
  await ui.shot(name)
  for (const { label, js } of list) {
    const r = await ui
      .ev(js)
      .catch((error) => ({ ok: false, detail: `sonde illisible : ${error.message}` }))
    check(r?.ok === true, `capture ${name} — ${label}${r?.detail ? ` (${r.detail})` : ''}`)
  }
}
