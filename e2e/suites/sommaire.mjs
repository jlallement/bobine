import { check, withApp } from '../lib.mjs'

/** Messages envoyés : de quoi dépasser la hauteur maximale de la colonne de traits. */
const MESSAGES = 80

/**
 * Sommaire d'une longue conversation (fiche 173) : la colonne de traits reste dans sa hauteur
 * maximale (30 % du fil, 240 px au plus), un trait représente alors plusieurs messages, et le trait
 * courant suit le défilement. La liste au survol garde tous les messages.
 */
export async function outlineSuite(scheme) {
  console.log(`\n— Sommaire d’une longue conversation (${scheme})`)
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      for (let i = 1; i <= MESSAGES; i++) {
        await ui.send(`Question ${i} : où en est l’étape ${i} ?`)
        await ui.ready()
      }
      await ui.waitFor(
        `document.querySelectorAll('[data-testid=user-message]').length === ${MESSAGES}`
      )
      // Panneau « Session » ouvert d'office (fiche 166) : fermé, la gouttière du sommaire revient.
      await ui.closePanel()
      await ui.waitFor(`!!document.querySelector('[data-testid=outline-bars]')`)
      const state = () =>
        ui.ev(`(() => {
          const scroll = document.querySelector('.scroll')
          const bars = document.querySelector('[data-testid=outline-bars]')
          const all = [...bars.querySelectorAll('.outline-bar')]
          const current = bars.querySelector('.outline-bar.current')
          return {
            thread: scroll.clientHeight,
            height: bars.getBoundingClientRect().height,
            padding: parseFloat(getComputedStyle(bars).paddingTop) + parseFloat(getComputedStyle(bars).paddingBottom),
            bars: all.length,
            current: current ? [Number(current.dataset.first), Number(current.dataset.last)] : null,
            currentRank: all.indexOf(current),
            items: document.querySelectorAll('[data-testid=outline-item]').length
          }
        })()`)
      const at = async (index) => {
        await ui.ev(
          `(() => { const s = document.querySelector('.scroll'); const m = document.querySelectorAll('[data-testid=user-message]')[${index}]; s.scrollTop += m.getBoundingClientRect().top - s.getBoundingClientRect().top - 20; return true })()`
        )
        await ui.ev(`new Promise((r) => setTimeout(r, 200))`)
        return state()
      }
      const bottom = await state()
      const limit = Math.min(240, Math.floor(bottom.thread * 0.3))
      check(
        bottom.height - bottom.padding <= limit,
        `colonne de traits dans sa hauteur maximale (${Math.round(bottom.height - bottom.padding)} ≤ ${limit} px, fil de ${bottom.thread} px)`
      )
      check(
        bottom.bars < MESSAGES && bottom.bars >= 20,
        `${MESSAGES} messages, ${bottom.bars} traits : un trait pour plusieurs messages`
      )
      check(bottom.items === MESSAGES, `la liste au survol garde les ${MESSAGES} messages`)
      check(
        bottom.current?.[1] === MESSAGES - 1 && bottom.currentRank === bottom.bars - 1,
        `en bas du fil, le dernier trait est le courant (${bottom.current})`
      )
      await ui.shot('173-sommaire-bas')
      const top = await at(0)
      check(
        top.current?.[0] === 0 && top.currentRank === 0,
        `en haut du fil, le premier trait est le courant (${top.current})`
      )
      await ui.shot('173-sommaire-haut')
      const middle = await at(40)
      check(
        middle.current && middle.current[0] <= 40 && middle.current[1] >= 40,
        `au 41ᵉ message, le trait courant le couvre (messages ${middle.current?.[0] + 1} à ${middle.current?.[1] + 1}, trait ${middle.currentRank + 1} sur ${middle.bars})`
      )
      await ui.shot('173-sommaire-milieu')
      await ui.ev(
        `document.querySelector('.outline').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))`
      )
      await ui.hover(await ui.center(`document.querySelector('[data-testid=outline-bars]')`))
      await ui.waitFor(
        `getComputedStyle(document.querySelector('[data-testid=outline-list]')).display === 'block'`
      )
      check(
        await ui.ev(
          `(() => { const list = document.querySelector('[data-testid=outline-list]'); const b = list.querySelector('.current').getBoundingClientRect(); const l = list.getBoundingClientRect(); return b.top >= l.top && b.bottom <= l.bottom })()`
        ),
        'la liste s’ouvre sur le message lu'
      )
      await ui.shot('173-sommaire-liste')
      // Fenêtre basse : la colonne raccourcit avec le fil (30 %).
      await ui.hover({ x: 900, y: 400 })
      await ui.viewport(1200, 560)
      const low = await state()
      const lowLimit = Math.min(240, Math.floor(low.thread * 0.3))
      check(
        low.height - low.padding <= lowLimit,
        `fenêtre basse : colonne de ${Math.round(low.height - low.padding)} ≤ ${lowLimit} px (fil de ${low.thread} px)`
      )
      await ui.shot('173-sommaire-fenetre-basse')
      await ui.viewport()
    },
    undefined,
    'echo'
  )
}
