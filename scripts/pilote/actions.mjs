/**
 * Actions de secours du pilote (et des essais) : écrire et envoyer un message, répondre à une
 * carte, cliquer un libellé, ouvrir un panneau. Toujours par de vrais évènements d'entrée
 * (souris, frappe), comme un humain ; computer use reste le chemin principal (fiche 206).
 */
import { sleep } from './cdp.mjs'

/** Éléments qu'un humain clique : boutons, liens, onglets, entrées de menu, choix. */
const CLICKABLE =
  'button, a[href], [role=button], [role=tab], [role=menuitem], [role=menuitemradio], [role=option], [role=radio], label, summary, .history-item'

/**
 * Expression de la page : centre de l'élément cliquable visible dont le libellé (texte ou
 * `aria-label`) vaut `label` — à défaut, le contient. `scope` : sélecteur qui limite la recherche
 * au dernier élément visible qui y répond (la dernière carte, le menu ouvert). Plusieurs éléments
 * possibles (fiche 210 : l'icône « Réessayer » d'un message et celui d'une carte) : erreur
 * `ambigu` avec chacun (libellé, `data-testid`, zone), jamais le premier au hasard ; un élément
 * cliquable dans un autre ne compte qu'une fois. Renvoie `{ x, y, label }`, `{ error, seen }` ou
 * `{ error: 'ambigu', matches }`.
 */
export const findClickable = (label, scope = 'document') => `(() => {
  const want = ${JSON.stringify(label)}.normalize('NFC').replace(/\\s+/g, ' ').trim().toLowerCase()
  const norm = (s) => (s || '').normalize('NFC').replace(/\\s+/g, ' ').trim().toLowerCase()
  const visible = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[inert],[aria-hidden=true]') }
  const root = ${scope === 'document' ? 'document' : `[...document.querySelectorAll(${JSON.stringify(scope)})].filter(visible).at(-1)`}
  if (!root) return { error: 'zone absente' }
  const all = [...root.querySelectorAll(${JSON.stringify(CLICKABLE)})].filter(visible)
  const text = (e) => norm(e.getAttribute('aria-label') || e.innerText || e.title)
  const exact = all.filter((e) => text(e) === want || norm(e.innerText) === want || norm(e.title) === want)
  const loose = all.filter((e) => text(e).includes(want) || norm(e.innerText).includes(want))
  const innermost = (list) => list.filter((e) => !list.some((o) => o !== e && e.contains(o)))
  const candidates = innermost(exact.length ? exact : loose)
  const shown = (e) => (e.getAttribute('aria-label') || e.innerText || e.title || '').replace(/\\s+/g, ' ').trim()
  const where = (e) => {
    const zone = e.parentElement && e.parentElement.closest('[data-testid]')
    const id = e.getAttribute('data-testid')
    return shown(e).slice(0, 60) + (id ? ' [' + id + ']' : '') + (zone ? ' dans ' + zone.getAttribute('data-testid') : '')
  }
  if (candidates.length > 1) return { error: 'ambigu', matches: candidates.map(where).slice(0, 10) }
  const pick = candidates[0]
  if (!pick) return { error: 'introuvable', seen: [...new Set(all.map(shown).filter(Boolean))].slice(0, 40) }
  if (pick.disabled || pick.getAttribute('aria-disabled') === 'true') return { error: 'désactivé', label: text(pick) }
  pick.scrollIntoView({ block: 'nearest' })
  const b = pick.getBoundingClientRect()
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, label: (pick.getAttribute('aria-label') || pick.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80) }
})()`

/**
 * Clique le libellé (vrai clic souris) ; lève une erreur qui liste ce qui est cliquable, ou les
 * éléments entre lesquels choisir quand le libellé est ambigu (préciser la zone, ou un libellé
 * plus long).
 */
export async function clickLabel(page, label, scope) {
  const found = await page.ev(findClickable(label, scope))
  if (found.error === 'ambigu') {
    throw new Error(
      `« ${label} » ambigu : ${found.matches.length} éléments — ${found.matches.join(' | ')} ; précisez la zone ou le libellé`
    )
  }
  if (found.error) {
    const seen = found.seen?.length ? ` — visibles : ${found.seen.join(' | ')}` : ''
    throw new Error(`« ${label} » ${found.error}${seen}`)
  }
  await page.mouse(found.x, found.y)
  return found.label
}

/** Cartes qui attendent une réponse : autorisation, question, plan, propositions. */
const CARD = '.permission-card'

/**
 * Répond à la dernière carte en attente par le libellé d'un de ses boutons. Une carte
 * d'autorisation n'accepte un clic qu'une fois armée (400 ms sans défilement, fiche 203) : on
 * attend, comme un humain.
 */
export async function answerCard(page, label) {
  const last = `[...document.querySelectorAll('${CARD}')].at(-1)`
  if (!(await page.ev(`!!${last}`))) throw new Error('aucune carte en attente')
  for (let i = 0; i < 50; i++) {
    const armed = await page.ev(
      `(() => { const c = ${last}; return !c || c.dataset.testid !== 'permission' || c.dataset.armed !== undefined })()`
    )
    if (armed) break
    await sleep(100)
  }
  return clickLabel(page, label, CARD)
}

/** Zone de saisie de la conversation. */
const COMPOSER = '[data-testid=composer-input]'

/**
 * Écrit le texte dans la zone de saisie et l'envoie (Entrée). Vérifie que le message est parti :
 * un nouveau message de l'utilisateur dans le fil, ou la zone vidée (message mis en file).
 */
export async function sendMessage(page, text) {
  if (!(await page.ev(`!!document.querySelector('${COMPOSER}')`))) {
    throw new Error('pas de zone de saisie à l’écran (accueil, réglages ouverts ?)')
  }
  const users = `document.querySelectorAll('.msg-user').length`
  const before = await page.ev(users)
  const box = await page.ev(
    `(() => { const b = document.querySelector('${COMPOSER}').getBoundingClientRect(); return { x: b.x + 20, y: b.y + b.height / 2 } })()`
  )
  await page.mouse(box.x, box.y)
  await page.ev(`document.querySelector('${COMPOSER}').focus()`)
  await page.insertText(text)
  await sleep(100)
  await page.key('Enter')
  for (let i = 0; i < 50; i++) {
    const state = await page.ev(
      `({ users: ${users}, value: document.querySelector('${COMPOSER}')?.value ?? '' })`
    )
    if (state.users > before || state.value.trim() === '') return
    await sleep(100)
  }
  throw new Error('message pas parti (toujours dans la zone de saisie)')
}

/** Centre d'un élément (sélecteur), ou rien s'il n'est pas à l'écran. */
const centerOf = (page, selector) =>
  page.ev(`(() => {
    const e = document.querySelector(${JSON.stringify(selector)})
    if (!e) return null
    const b = e.getBoundingClientRect()
    return b.width ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null
  })()`)

/**
 * Ouvre un onglet du panneau de droite (`id` : `session`, `terminal`, `browser`, `changes`…) :
 * le panneau s'ouvre d'abord s'il est fermé ; un onglet pas encore ouvert se prend dans « Autres
 * outils » (`label` : son nom affiché, `more` : celui du menu).
 */
export async function openPanel(page, id, label, more) {
  if (!(await centerOf(page, '[data-testid=side-panel]'))) {
    const toggle = await centerOf(page, '[data-testid=panel-toggle]')
    if (!toggle) throw new Error('pas de bouton de panneau à l’écran')
    await page.mouse(toggle.x, toggle.y)
    await sleep(400)
  }
  const tab = `[data-testid=side-panel] .side-panel-tab-main[data-tab="${id}"]`
  let at = await centerOf(page, tab)
  if (!at) {
    // Menu « Autres outils » déjà ouvert : un clic sur son bouton le refermerait.
    if (!(await centerOf(page, '[role=menu]'))) {
      await clickLabel(page, more, '[data-testid=side-panel]')
      for (let i = 0; i < 20 && !(await centerOf(page, '[role=menu]')); i++) await sleep(100)
    }
    await clickLabel(page, label, '[role=menu]')
    for (let i = 0; i < 20 && !at; i++) {
      await sleep(100)
      at = await centerOf(page, tab)
    }
    if (!at) throw new Error(`onglet « ${label} » pas ouvert`)
  }
  await page.mouse(at.x, at.y)
  return label
}
