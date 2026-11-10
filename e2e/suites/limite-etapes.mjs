import { L, LANG, check, withApp } from '../lib.mjs'

/** Texte sans espaces insécables (Intl en français). */
const plain = (text) => (text ?? '').replace(/[  ]/g, ' ')

/** Réponse de l'agent factice quand il a pu reprendre (il parle la langue des essais, fiche 167). */
const RESUMED =
  LANG === 'en' ? 'The entities now use PanacheEntityBase.' : 'Les entités utilisent maintenant'

const cards = `[...document.querySelectorAll('[data-testid=turn-limit-card]')]`
const lastCard = `${cards}.at(-1)`
/** Boutons de la dernière carte : texte, et principal ou non. */
const buttons = (ui) =>
  ui.ev(
    `[...${lastCard}.querySelectorAll('button')].map((b) => b.innerText.trim() + (b.classList.contains('primary') ? '*' : '')).join('|')`
  )
const userCount = `document.querySelectorAll('[data-testid=user-message]').length`

/** Message envoyé, puis « Continuer » refusé sans rien faire : la deuxième carte attend. */
async function exhaust(ui) {
  await ui.ready()
  await ui.send('Passe les entités à PanacheEntityBase')
  await ui.waitFor(`${cards}.length === 1`, 20000)
  await ui.ready()
  await ui.click(ui.$('turn-limit-continue'))
  await ui.waitFor(`${cards}.length === 2`, 20000)
  await ui.ready()
}

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
      const first = plain(await ui.ev(`${lastCard}.innerText`))
      const body = await ui.ev('document.body.innerText')
      check(
        first.includes(plain(L('turnGuards.limit.title'))) &&
          first.includes(plain(L('turnGuards.limit.detail'))) &&
          !body.includes(L('transcript.notice.maxTurnRequests')),
        'travail arrêté : une carte « s’est arrêté avant la fin », plus la ligne grise'
      )
      check(
        (await buttons(ui)) === `${L('turnGuards.limit.continue')}*` &&
          !(await ui.ev(`!!${ui.$('turn-summary')}`)),
        'un seul bouton principal, « Continuer » ; pas de « Terminé ✓ »'
      )
      await ui.hover({ x: 5, y: 400 })
      await ui.shot('limite-1-arret')

      await ui.click(ui.$('turn-limit-continue'))
      await ui.waitFor(`${cards}.length === 2`, 20000)
      await ui.ready()
      const second = plain(await ui.ev(`${lastCard}.innerText`))
      check(
        second.includes(plain(L('turnGuards.limit.refusedTitle'))) &&
          second.includes(plain(L('turnGuards.limit.refusedDetail'))) &&
          plain(await ui.ev(`${cards}[0].innerText`)).includes(
            plain(L('turnGuards.limit.continued'))
          ),
        'Continuer refusé sans rien faire : carte « refuse de continuer ici » ; la première dit le choix'
      )
      check(
        (await buttons(ui)) === `${L('turnGuards.limit.reopen')}*|${L('turnGuards.limit.renew')}`,
        'deux choix : « Rouvrir la session et continuer » (principal), « Nouvelle session avec le résumé »'
      )
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

  // Limite qui survit à la relance : la réouverture est refusée de nouveau, la session neuve reste.
  await withApp(
    scheme,
    async (ui) => {
      await exhaust(ui)
      await ui.click(ui.$('turn-limit-reopen'))
      await ui.waitFor(`${cards}.length === 3`, 20000)
      await ui.ready()
      check(
        (await buttons(ui)) === `${L('turnGuards.limit.renew')}*`,
        'refusé encore après la réouverture : seule « Nouvelle session avec le résumé » reste'
      )
      await ui.hover({ x: 5, y: 400 })
      await ui.shot('limite-4-tenace')

      await ui.click(ui.$('turn-limit-renew'))
      await ui.waitFor(`document.body.innerText.includes(${JSON.stringify(RESUMED)})`, 20000)
      await ui.ready()
      const divider = await ui.ev(`${ui.$('handover-divider')}?.dataset.reason ?? ''`)
      const detail = plain(await ui.ev(`${ui.$('handover-divider')}.innerText`))
      check(
        divider === 'turn-limit' &&
          detail.includes(
            plain(L('handover.thread.renewDetailTurnLimit', { agent: L('profiles.mock.label') }))
          ),
        'session neuve : repère « Nouvelle session » avec la raison, et l’agent répond'
      )
      await ui.hover({ x: 5, y: 400 })
      await ui.shot('limite-5-nouvelle-session')
    },
    undefined,
    'limite-etapes-tenace'
  )
}
