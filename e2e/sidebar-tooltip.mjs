import { check, sleep } from './lib.mjs'

/**
 * Enregistreur posé dans la page avant le survol : nombre maximal de bulles ouvertes en même temps
 * (la propriété de la fiche 149 : jamais deux), et ce qui a pu fermer la bulle sans que l'essai y
 * soit pour rien (ligne détachée ou déplacée par une mise à jour de la liste, pointeur sorti,
 * défilement). Sous charge, une mise à jour tardive de la barre latérale peut fermer la bulle :
 * l'essai le voit et le dit, au lieu de lire une bulle disparue (`null.scrollWidth`, « erreur dans
 * la page » qui venait de l'essai, pas de l'app).
 */
const record = (button) => `(() => {
  window.__tipWatch?.stop()
  const button = ${button}
  const box = () => { const r = button.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(',') }
  const start = box()
  const watch = { max: 0, events: [] }
  const note = (what) => watch.events.length < 20 && watch.events.push(what)
  const count = () => {
    watch.max = Math.max(watch.max, document.querySelectorAll('.tooltip').length, document.querySelectorAll('[role=tooltip]').length)
    if (!button.isConnected) note('ligne détachée')
    else if (box() !== start) note('ligne déplacée : ' + start + ' → ' + box())
  }
  const observer = new MutationObserver(count)
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] })
  const leave = (e) => note('pointeur sorti de la ligne (' + e.clientX + ',' + e.clientY + ')')
  const scroll = (e) => e.target instanceof Node && e.target.contains(button) && note('défilement')
  button.addEventListener('pointerleave', leave)
  window.addEventListener('scroll', scroll, true)
  watch.stop = () => {
    observer.disconnect()
    button.removeEventListener('pointerleave', leave)
    window.removeEventListener('scroll', scroll, true)
  }
  window.__tipWatch = watch
  count()
  return true
})()`

/** Une seule bulle ouverte, liée à la ligne (`aria-describedby`), et aucun attribut `title`. */
const single = (button) => `(() => {
  const button = ${button}
  if (!button) return false
  const description = document.getElementById(button.getAttribute('aria-describedby'))
  return document.querySelectorAll('.tooltip').length === 1 &&
    description?.getAttribute('role') === 'tooltip' &&
    document.querySelectorAll('[role=tooltip]').length === 1 &&
    !button.closest('[title]')
})()`

const WATCHED = `({ max: window.__tipWatch.max, events: window.__tipWatch.events })`

/** Infobulle réelle d'une ligne : même contenu au survol et au clavier, aucun attribut title. */
export async function conversationTooltip(ui, button, { hover = false, capture } = {}) {
  await ui.waitFor(`!!${button}`)
  check(
    await ui.ev(`!${button}.closest('[title]') && !${button}.querySelector('[title], title')`),
    'ligne de conversation : un seul mécanisme d’infobulle'
  )
  await ui.hover({ x: 600, y: 1 })
  const open = async () => {
    await ui.ev(record(button))
    if (hover) await ui.hover(await ui.center(button))
    else {
      // Focus au clavier : une touche d'abord. Un `.focus()` juste après un clic n'en est pas un,
      // et l'infobulle ne s'ouvre pas sur le focus qu'un clic laisse derrière lui (fiche 185, F7).
      await ui.press('Shift')
      await ui.ev(`${button}.focus(), true`)
    }
    await ui.waitFor(single(button))
    // Rester sur la ligne assez longtemps pour couvrir la seconde bulle retardée issue de title :
    // c'est la durée du survol essayé, pas une attente de l'app ; l'enregistreur compte les bulles
    // à chaque changement de la page pendant ce temps.
    if (hover) await sleep(1200)
    return { watch: await ui.ev(WATCHED), shown: await ui.ev(single(button)) }
  }
  let { watch, shown } = await open()
  if (!shown && watch.max <= 1 && watch.events.length > 0) {
    // Bulle fermée par la page autour (liste mise à jour, pointeur déplacé), sans seconde bulle :
    // ce n'est pas ce que l'essai vérifie. Rouverte une fois, en le disant.
    console.log(`    infobulle fermée par : ${watch.events.join(' ; ')} — rouverte`)
    await ui.hover({ x: 600, y: 1 })
    ;({ watch, shown } = await open())
  }
  const single1 = shown && watch.max === 1
  check(
    single1,
    `${hover ? 'survol prolongé : une seule infobulle' : 'focus clavier : une seule infobulle liée'}${
      single1
        ? ''
        : ` (ouverte : ${shown}, bulles au plus : ${watch.max}, évènements : ${watch.events.join(' ; ') || 'aucun'})`
    }`
  )
  await ui.ev(`window.__tipWatch.stop(), true`)
  check(
    shown &&
      (await ui.ev(`(() => {
        const tip = document.querySelector('.tooltip')
        return !!tip && tip.scrollWidth <= tip.clientWidth + 1
      })()`)),
    'texte complet : aucun débordement horizontal de l’infobulle'
  )
  const text = shown ? await ui.ev(`document.querySelector('.tooltip')?.innerText ?? ''`) : ''
  if (capture) await ui.shot(capture)
  await ui.hover({ x: 600, y: 1 })
  await ui.ev(`${button}?.blur(), true`)
  await ui.waitFor(
    `!document.querySelector('.tooltip') && !document.querySelector('[role=tooltip]')`
  )
  return text
}
