import { L, check, sleep, withApp } from '../lib.mjs'

/**
 * Pannes réseau et reconnexion progressive (fiche 142), contre l'agent factice : une panne
 * passagère (deux tentatives, puis le message part), puis un réseau coupé (cinq tentatives,
 * « Connexion impossible », « Réessayer »), et Échap qui annule les tentatives.
 */
export async function networkSuite(scheme) {
  console.log(`\n— Pannes réseau (${scheme})`)
  await withApp(scheme, async (ui) => {
    await ui.ready()
    const banner = ui.$('turn-retry')
    const users = `document.querySelectorAll('.msg-user').length`
    const errors = `document.querySelectorAll('.notice-error').length`

    // 1. Panne passagère : « fetch failed » deux fois, puis la réponse.
    await ui.send('/scenario reseau-instable')
    await ui.waitFor(`${banner}?.dataset.attempt === '1'`)
    check(
      (await ui.ev(`${banner}.innerText`)).includes(L('turnRetry.network')) &&
        (await ui.ev(`${banner}.dataset.cause`)) === 'network' &&
        (await ui.ev(`!!${ui.$('stop')}`)) &&
        (await ui.ev(`!${ui.$('working')}`)),
      'panne réseau : bandeau « Connexion perdue » à la place de l’indicateur, Stop proposé'
    )
    await ui.waitFor(`${banner}?.dataset.attempt === '2'`, 8000)
    await ui.shot('142-reseau-attente')
    await ui.waitFor(`!${banner}`, 10000)
    await ui.ready()
    check(
      (await ui.lastAgentText()).includes('Réseau revenu') &&
        (await ui.ev(users)) === 1 &&
        (await ui.ev(errors)) === 0,
      'réseau revenu : le message part, sans nouvelle bulle ni erreur'
    )

    // 2. Réseau coupé : chaque tentative échoue ; « Réessayer maintenant » les enchaîne.
    await ui.send('/scenario reseau-coupe')
    for (let next = 1; next <= 5; next++) {
      await ui.waitFor(`${banner}?.dataset.attempt === '${next}'`)
      await ui.click(ui.$('turn-retry-now'))
      if (next < 5) await ui.waitFor(`${banner}?.dataset.attempt !== '${next}'`)
    }
    await ui.waitFor(`${banner}?.dataset.attempt === 'exhausted'`)
    await ui.ready()
    await ui.shot('142-reseau-impossible')

    // 3. « Réessayer » repart pour cinq tentatives ; Échap les annule.
    await ui.click(ui.$('turn-retry-now'))
    await ui.waitFor(`${banner}?.dataset.attempt === '1'`)
    await ui.ev(`${ui.$('composer-input')}.focus()`)
    await ui.press('Escape')
    await ui.waitFor(`!${banner}`)
    await ui.ready()
    await sleep(2500)
  })
}
