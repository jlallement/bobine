import { MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'

/**
 * Aparté (fiche 180) : une question à côté, pendant le tour de la conversation, dans une session à
 * part du même agent. Le scénario `demo` s'arrête sur sa permission : le tour principal dure tant
 * qu'on n'y répond pas. L'agent factice reconnaît la consigne de l'aparté (scénario `aparte`) et dit
 * ce qu'il a reçu.
 */
export async function asideSuite(scheme) {
  console.log(`\n— Aparté (${scheme})`)
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await ui.closePanel()

      // Conversation neuve, sans message (recette 0.9, D5) : la carte s'affiche sur l'accueil, la
      // réponse est lisible ; rien n'est envoyé dans le fil. ✕ la ferme.
      await ui.ev(`${ui.$('composer-input')}.focus()`)
      await ui.type('/btw Question avant tout message')
      await ui.waitFor(`!${ui.$('command-menu')}`)
      await ui.enter()
      await ui.waitFor(
        `${ui.$('aside-card')}?.dataset.status === 'ready' && !!${ui.$('aside-answer')}`,
        20_000
      )
      await ui.shot('180-aparte-conversation-vide')
      await ui.click(ui.$('aside-close'))
      await ui.waitFor(`!${ui.$('aside-card')}`)

      await ui.send('Modifie la configuration')
      await ui.waitFor(`!!${ui.$('permission')}`)
      await ui.shot('180-avant-pendant-tour')

      // `/btw` dans le menu « / ».
      await ui.ev(`${ui.$('composer-input')}.focus()`)
      await ui.type('/bt')
      await ui.waitFor(`!!${ui.$('command-menu')}`)
      await ui.shot('180-menu-btw')

      // Question posée pendant le tour (carte au-dessus de la saisie, rien dans le fil : vérifiés
      // dans `parcours-matinee`).
      await ui.type('w C’est quoi déjà ce flag ?')
      // Menu refermé après l'espace (Échap arrêterait le tour principal).
      await ui.waitFor(`!${ui.$('command-menu')}`)
      await ui.enter()
      await ui.waitFor(
        `${ui.$('aside-card')}?.dataset.status === 'ready' && !!${ui.$('aside-answer')}`,
        20_000
      )
      await ui.shot('180-aparte-reponse')

      // Deuxième question, avec la fin du fil ; puis une demande d'écriture, refusée d'office.
      await ui.click(ui.$('aside-with-context'))
      await ui.ev(`${ui.$('aside-input')}.focus()`)
      await ui.type('Et avec le fil ?')
      await ui.enter()
      await ui.waitFor(
        `document.querySelectorAll('[data-testid=aside-answer]').length === 2 && ${ui.$('aside-card')}.dataset.status === 'ready'`,
        20_000
      )
      await ui.ev(`${ui.$('aside-input')}.focus()`)
      await ui.type('/scenario permission')
      await ui.enter()
      await ui.waitFor(
        `!!${ui.$('aside-refused')} && ${ui.$('aside-card')}.dataset.status === 'ready'`,
        20_000
      )
      await ui.shot('180-aparte-refus')

      // « Ajouter au fil » : citation dans la saisie, rien d'envoyé, carte fermée.
      await ui.click(ui.$('aside-quote'))
      await ui.waitFor(`!${ui.$('aside-card')}`)
      await ui.shot('180-ajouter-au-fil')

      // ⇧⌘A (menu Conversation › Aparté…) : carte vide, champ prêt ; Échap la ferme.
      const main = await mainProcess()
      try {
        await main.evaluate(
          `require('electron').BrowserWindow.getAllWindows()[0].webContents.send('app:command', 'aside'); true`
        )
      } finally {
        main.close()
      }
      await ui.waitFor(
        `!!${ui.$('aside-card')} && document.activeElement === ${ui.$('aside-input')}`
      )
      await ui.shot('180-aparte-raccourci')
      await ui.press('Escape')
      await ui.waitFor(`!${ui.$('aside-card')}`)
      check(
        await ui.ev(`document.activeElement === ${ui.$('composer-input')}`),
        'Échap ferme l’aparté, le clavier revient à la saisie'
      )
    },
    undefined,
    'demo',
    {},
    [`--inspect=${MAIN_PORT}`]
  )
}
