import { L, check, literal, withApp, M, MOCK_LANG } from '../lib.mjs'
import { describeSettings } from '../../src/mock-agent/langue.mts'

export async function suite(scheme) {
  console.log(`\n— Thème ${scheme}`)
  await withApp(scheme, async (ui) => {
    check(await ui.ev(`!!${ui.$('welcome')}`), 'accueil affiché avec la zone de saisie au centre')
    // Bobine (fiche 069) : le fil s'enroule à l'ouverture, puis s'arrête.
    const greetSpool = `document.querySelector('.greeting [data-testid=spool-mark][data-motion=intro] .spool-thread-2')`
    check(await ui.ev(`!!${greetSpool}`), 'accueil : la bobine à côté de la salutation')
    await ui.waitFor(`!${greetSpool}.getAnimations().some((a) => a.playState === 'running')`)
    check(true, 'accueil : fil enroulé, animation terminée')
    // Astuce tirée du profil de l'agent factice, pas d'un test sur son identifiant (fiche 088).
    await ui.waitFor(`document.querySelector('.welcome-hint code')?.textContent === '/scenario'`)
    check(true, 'accueil : astuce de l’agent factice, déclarée par son profil')
    await ui.shot('1-accueil')

    // Indicateur d'activité à la fin du fil pendant la réponse.
    await ui.send('/scenario lent')
    await ui.waitFor(`${ui.$('working')}?.dataset.activity === 'writing'`)
    check(
      new RegExp(`^${literal(L('activity.writing'))}\\s*\\d+ s$`).test(
        (await ui.ev(`${ui.$('working')}.innerText`)).replace(/\n/g, ' ')
      ),
      'l’agent répond : « Écrit… » et le temps écoulé à la fin du fil'
    )
    check(
      await ui.ev(
        `[...${ui.$('working')}.querySelectorAll('[data-motion=loop] .spool-thread')].every((p) => p.getAnimations().some((a) => a.playState === 'running'))`
      ),
      'l’agent travaille : le fil de la bobine s’enroule en boucle'
    )
    await ui.shot('1b-agent-ecrit')
    await ui.click(ui.$('stop'))
    await ui.ready()
    check(!(await ui.ev(`!!${ui.$('working')}`)), 'réponse finie : indicateur retiré')

    // Permission : autoriser
    await ui.send('/scenario permission')
    await ui.waitFor(`!!${ui.$('permission')}`)
    check(
      (await ui.ev(`${ui.$('working')}?.dataset.activity`)) === 'permission',
      'autorisation demandée : « Attend votre accord »'
    )
    check(
      await ui.ev(`!!${ui.$('working')}.querySelector('[data-motion=none]')`),
      'autorisation demandée : bobine immobile'
    )
    await ui.shot('2-permission')
    await ui.ev(`${ui.$('permission')}.querySelector('[data-kind=allow_once]').click()`)
    await ui.ready()
    let tool = await ui.lastTool()
    check(
      tool.status === 'completed' && tool.answer?.includes(M('Autoriser')),
      'permission autorisée → outil terminé'
    )

    // Permission : refuser
    await ui.send('/scenario permission')
    await ui.waitFor(`!!${ui.$('permission')}`)
    await ui.ev(`${ui.$('permission')}.querySelector('[data-kind=reject_once]').click()`)
    await ui.ready()
    tool = await ui.lastTool()
    check(
      tool.status === 'refused' && tool.answer?.includes(M('Refuser')),
      'permission refusée → outil « refusé » (fiche 122)'
    )

    // Stop pendant une demande en attente
    await ui.send('/scenario permission')
    await ui.waitFor(`!!${ui.$('permission')}`)
    await ui.ev(`${ui.$('stop')}.click()`)
    await ui.ready()
    tool = await ui.lastTool()
    check(
      tool.status === 'cancelled' && tool.answer?.includes(L('toolCall.permission.cancelled')),
      'Stop pendant l’attente → demande annulée'
    )

    // Réglages de session via le menu
    await ui.click(ui.$('session-settings'))
    await ui.waitFor(`!!${ui.$('session-settings-content')}`)
    await ui.click(ui.$('control-model'))
    await ui.waitFor(`!!${ui.$('control-model-factice-precis')}`)
    await ui.shot('3-reglages')
    await ui.click(ui.$('control-model-factice-precis'))
    await ui.waitFor(`!${ui.$('session-settings-content')}`)
    // Puce du modèle (fiche 090) : suit le menu, et règle le modèle elle aussi
    await ui.waitFor(`${ui.$('model-chip')}?.innerText.trim() === '${M('Factice précis')}'`)
    await ui.click(ui.$('model-chip'))
    await ui.waitFor(`!!${ui.$('model-menu-content')}`)
    await ui.shot('3b-puce-modele')
    await ui.click(ui.$('control-model-factice-rapide'))
    await ui.waitFor(`${ui.$('model-chip')}.innerText.trim() === '${M('Factice rapide')}'`)
    await ui.click(ui.$('mode-chip'))
    await ui.waitFor(`!!${ui.$('control-mode-ask')}`)
    await ui.click(ui.$('control-mode-ask'))
    await ui.waitFor(`${ui.$('mode-chip')}.innerText.includes('${M('Question')}')`)
    await ui.send('/scenario echo')
    await ui.ready()
    const echo = await ui.lastAgentText()
    check(
      echo.includes(
        describeSettings(MOCK_LANG, { mode: 'ask', model: 'factice-rapide', verbose: false })
      ),
      'mode et modèle choisis dans les puces et le menu, appliqués par l’agent'
    )

    // Menu asynchrone : distinguer son ouverture de la sélection d’une ligne (fiche 151).
    await ui.ev(`${ui.$('agent-menu')}.focus()`)
    await ui.press('Enter')
    await ui.waitFor(`!!${ui.$('agent-menu-content')}`)
    check(
      (await ui.ev(`${ui.$('agent-menu')}.innerText`)).includes(L('profiles.mock.label')),
      'consultation du menu : l’agent factice reste sélectionné'
    )
    await ui.shot('4-agents')
    const bob = await ui.ev(`${ui.$('agent-option-bob')}?.hasAttribute('data-disabled')`)
    console.log(`    (Bob ${bob ? 'indisponible' : 'disponible'} sur cette machine)`)
    await ui.key('Escape')

    // Nouvelle conversation : sans confirmation, l'ancienne passe dans « Récents »
    const historyCount = `document.querySelectorAll('[data-testid=history-item]').length`
    await ui.click(ui.$('new-conversation'))
    await ui.waitFor(`!!${ui.$('welcome')}`)
    await ui.ready()
    check(
      ui.dialogs.length === 0 && (await ui.ev(historyCount)) === 1,
      'nouvelle conversation : sans confirmation, l’ancienne est dans « Récents »'
    )
    await ui.shot('5-historique')

    // Retour sur l'ancienne : son fil est là, l'agent est toujours vivant
    await ui.click(`document.querySelector('[data-testid=history-item] .history-open')`)
    await ui.waitFor(`document.querySelectorAll('.msg-user').length === 5`)
    await ui.ready()
    check(
      (await ui.ev(historyCount)) === 1,
      'retour sur l’ancienne conversation : fil intact, brouillon vide écarté'
    )

    // Renommer
    await ui.click(`document.querySelector('[data-testid=history-more]')`)
    await ui.waitFor(`!!${ui.$('history-rename')}`)
    await ui.click(ui.$('history-rename'))
    await ui.waitFor(`!!${ui.$('rename-input')}`)
    await ui.ev(`(() => { const i = ${ui.$('rename-input')}; i.select(); return true })()`)
    await ui.type('Essai renommé')
    await ui.key('Enter')
    await ui.waitFor(
      `document.querySelector('[data-testid=history-item] .label')?.innerText === 'Essai renommé'`
    )
    check(true, 'renommage depuis la barre latérale')
  })
}
