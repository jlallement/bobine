import { L, LANG, check, withApp } from '../lib.mjs'

/** Texte sans espaces insécables (Intl en français). */
const plain = (text) => (text ?? '').replace(/[  ]/g, ' ')

/** Réponse de l'agent factice quand il a pu reprendre (il parle la langue des essais, fiche 167). */
const RESUMED =
  LANG === 'en' ? 'The entities now use PanacheEntityBase.' : 'Les entités utilisent maintenant'

const cards = `[...document.querySelectorAll('[data-testid=turn-limit-card]')]`
const lastCard = `${cards}.at(-1)`
const userCount = `document.querySelectorAll('[data-testid=user-message]').length`

/**
 * Limite d'étapes de l'agent (fiche 209), contre l'agent factice qui imite Bob 2.0.9 : carte
 * « s'est arrêté avant la fin » et « Continuer » ; refus sans rien faire, « Rouvrir la session et
 * continuer » (relance, `session/load` avec rejeu tardif comme Bob) ; agent dont la limite survit
 * à la relance : seule « Nouvelle session avec le résumé » reste, puis la session neuve répond.
 */
export async function limiteEtapesSuite(scheme) {
  console.log(`\n— Limite d’étapes de l’agent (${scheme})`)
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await ui.send('Passe les entités à PanacheEntityBase')
      await ui.waitFor(`${cards}.length === 1`, 20000)
      await ui.ready()
      await ui.hover({ x: 5, y: 400 })
      await ui.shot('limite-1-arret')

      await ui.click(ui.$('turn-limit-continue'))
      await ui.waitFor(`${cards}.length === 2`, 20000)
      await ui.ready()
      await ui.hover({ x: 5, y: 400 })
      await ui.shot('limite-2-refus')

      const users = await ui.ev(userCount)
      await ui.click(ui.$('turn-limit-reopen'))
      await ui.waitFor(`document.body.innerText.includes(${JSON.stringify(RESUMED)})`, 20000)
      await ui.ready()
      check(
        (await ui.ev(userCount)) === users &&
          plain(await ui.ev(`${lastCard}.innerText`)).includes(
            plain(L('turnGuards.limit.reopened'))
          ) &&
          !(await ui.ev(`!!${ui.$('handover-divider')}`)),
        'réouverture : même session, le message renvoyé une fois (pas répété), l’agent reprend'
      )
      await ui.hover({ x: 5, y: 400 })
      await ui.shot('limite-3-rouvert')
    },
    undefined,
    'limite-etapes-session',
    { MOCK_AGENT_REPLAY: 'late' }
  )
}
