import { check, sleep } from './lib.mjs'

/** Infobulle réelle d'une ligne : même contenu au survol et au clavier, aucun attribut title. */
export async function conversationTooltip(ui, button, { hover = false, capture } = {}) {
  await ui.waitFor(`!!${button}`)
  check(
    await ui.ev(`!${button}.closest('[title]') && !${button}.querySelector('[title], title')`),
    'ligne de conversation : un seul mécanisme d’infobulle'
  )
  await ui.hover({ x: 600, y: 1 })
  if (hover) await ui.hover(await ui.center(button))
  else {
    // Focus au clavier : une touche d'abord. Un `.focus()` juste après un clic n'en est pas un, et
    // l'infobulle ne s'ouvre pas sur le focus qu'un clic laisse derrière lui (fiche 185, F7).
    await ui.press('Shift')
    await ui.ev(`${button}.focus(), true`)
  }
  await ui.waitFor(`(() => {
    const button = ${button}
    const description = document.getElementById(button.getAttribute('aria-describedby'))
    return document.querySelectorAll('.tooltip').length === 1 &&
      description?.getAttribute('role') === 'tooltip' &&
      document.querySelectorAll('[role=tooltip]').length === 1
  })()`)
  // Rester sur la ligne assez longtemps pour couvrir la seconde bulle retardée issue de title.
  if (hover) await sleep(1200)
  check(
    await ui.ev(
      `document.querySelectorAll('.tooltip').length === 1 && !${button}.closest('[title]')`
    ),
    hover ? 'survol prolongé : une seule infobulle' : 'focus clavier : une seule infobulle liée'
  )
  check(
    await ui.ev(`(() => {
      const tip = document.querySelector('.tooltip')
      return tip.scrollWidth <= tip.clientWidth + 1
    })()`),
    'texte complet : aucun débordement horizontal de l’infobulle'
  )
  const text = await ui.ev(`document.querySelector('.tooltip').innerText`)
  if (capture) await ui.shot(capture)
  await ui.hover({ x: 600, y: 1 })
  await ui.ev(`${button}.blur(), true`)
  await ui.waitFor(
    `!document.querySelector('.tooltip') && !document.querySelector('[role=tooltip]')`
  )
  return text
}
