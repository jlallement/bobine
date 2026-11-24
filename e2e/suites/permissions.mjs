import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { WITHDRAW_SIGNAL } from '../../src/mock-agent/scenarios-commandes.mts'
import { check, withApp } from '../lib.mjs'

/** Seconde chasse rc.4 : le focus va à la zone de saisie, pas sur la page. */
const COMPOSER_FOCUSED = `document.activeElement?.dataset.testid === 'composer-input'`
const focusedOnComposer = (ui) =>
  ui.waitFor(COMPOSER_FOCUSED, 2000).then(
    () => true,
    () => false
  )

/** « Toujours autoriser » retenu d'une conversation à l'autre, révocable (fiche 042). */
export async function permissionsSuite(scheme) {
  console.log(`\n— Autorisations retenues (${scheme})`)
  await withApp(scheme, async (ui) => {
    const card = `document.querySelector('[data-testid=permission]')`
    await ui.send('/scenario liste-taches')
    await ui.waitFor(`!!${card}`)
    await ui.shot('c0-autorisation-retenue')
    await ui.click(`${card}.querySelector('button[data-kind=allow_always]')`)
    await ui.ready()

    await ui.click(ui.$('new-conversation'))
    await ui.waitFor(`!document.querySelector('.history-item.active')`)
    await ui.ready()
    await ui.send('/scenario liste-taches')
    await ui.ready()

    await ui.click(ui.$('open-settings'))
    await ui.waitFor(`!!${ui.$('settings')}`)
    await ui.click(ui.$('settings-privacy'))
    await ui.waitFor(`!!${ui.$('settings-remembered-tools')}`)
    await ui.shot('c1-outils-autorises')
    await ui.click(ui.$('forget-tool'))
    await ui.waitFor(`!!${ui.$('confirm-row')}`)
    await ui.click(ui.$('confirm-row-confirm'))
    await ui.waitFor(`!${ui.$('settings-remembered-tools')}`)
    await ui.key('Escape')
    await ui.waitFor(`!${ui.$('settings')}`)
    check(
      await focusedOnComposer(ui),
      'Réglages fermés par Échap : le focus va à la zone de saisie'
    )

    await ui.click(ui.$('new-conversation'))
    await ui.waitFor(`!document.querySelector('.history-item.active')`)
    await ui.ready()
    await ui.send('/scenario liste-taches')
    await ui.waitFor(`!!${card}`)

    // Fiche 214 : l'agent retire lui-même sa demande ($/cancel_request, comme Bob 2.0.9 pour une
    // écriture hors du dossier) : la carte se ferme « annulée », plus rien n'attend l'utilisateur.
    // Le retrait suit un signal de l'essai, pas une durée (fiche 250) : retirée 120 ms après son
    // arrivée, la carte échappait parfois à l'attente (Linux, issue #16), et toujours à la capture.
    await ui.click(ui.$('new-conversation'))
    await ui.waitFor(`!document.querySelector('.history-item.active')`)
    await ui.ready()
    await ui.send('/scenario annulation-par-agent-sur-signal')
    await ui.waitFor(`!!${card}`)
    await ui.waitFor(`${card}.hasAttribute('data-armed')`)
    await ui.shot('c2-demande-avant-retrait')
    const folder = await ui.ev(
      `window.api.conversations.get().then((s) => s.conversations.find((c) => c.id === document.querySelector('.history-item.active')?.dataset.id)?.workspace)`
    )
    writeFileSync(join(folder, WITHDRAW_SIGNAL), '')
    await ui.waitFor(`!${card}`)
    await ui.ready()
    await ui.shot('c2-demande-retiree-par-agent')
  })
}
