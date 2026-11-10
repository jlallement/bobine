import { L, MAIN_PORT, MOCK_LANG, check, mainProcess, withApp } from '../lib.mjs'

/**
 * Aparté (fiche 180) : une question à côté, pendant le tour de la conversation, dans une session à
 * part du même agent. Le scénario `demo` s'arrête sur sa permission : le tour principal dure tant
 * qu'on n'y répond pas. L'agent factice reconnaît la consigne de l'aparté (scénario `aparte`) et dit
 * ce qu'il a reçu.
 */
export async function asideSuite(scheme) {
  console.log(`\n— Aparté (${scheme})`)
  const en = MOCK_LANG === 'en'
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
      check(
        (await ui.ev(`!!${ui.$('welcome')} && !document.querySelector('.msg-user')`)) &&
          (await ui.ev(`${ui.$('composer-input')}.value`)) === '',
        'conversation vide : la carte d’aparté et sa réponse s’affichent sur l’accueil, rien dans le fil'
      )
      await ui.shot('180-aparte-conversation-vide')
      await ui.click(ui.$('aside-close'))
      await ui.waitFor(`!${ui.$('aside-card')}`)

      await ui.send('Modifie la configuration')
      await ui.waitFor(`!!${ui.$('permission')}`)
      const users = `document.querySelectorAll('.msg-user').length`
      const before = await ui.ev(users)
      await ui.shot('180-avant-pendant-tour')

      // `/btw` dans le menu « / ».
      await ui.ev(`${ui.$('composer-input')}.focus()`)
      await ui.type('/bt')
      await ui.waitFor(`!!${ui.$('command-menu')}`)
      check(
        await ui.ev(
          `[...document.querySelectorAll('[data-testid=command-item]')].some((i) => i.innerText.includes('/btw'))`
        ),
        '/btw proposée dans le menu « / »'
      )
      await ui.shot('180-menu-btw')

      // Question posée pendant le tour : carte au-dessus de la saisie, rien dans le fil.
      await ui.type('w C’est quoi déjà ce flag ?')
      // Menu refermé après l'espace (Échap arrêterait le tour principal).
      await ui.waitFor(`!${ui.$('command-menu')}`)
      await ui.enter()
      await ui.waitFor(
        `${ui.$('aside-card')}?.dataset.status === 'ready' && !!${ui.$('aside-answer')}`,
        20_000
      )
      const first = await ui.ev(`(() => {
      const card = ${ui.$('aside-card')}
      const composer = document.querySelector('.thread-dock .composer')
      return {
        answer: ${ui.$('aside-answer')}.innerText,
        above: card.getBoundingClientRect().bottom <= composer.getBoundingClientRect().top + 1,
        input: ${ui.$('composer-input')}.value,
        cost: ${ui.$('aside-cost')}?.innerText ?? ''
      }
    })()`)
      check(
        first.answer.includes(en ? 'Aside received, read only.' : 'Aparté reçu, en lecture seule.'),
        'l’aparté reçoit la consigne de lecture seule'
      )
      check(
        first.answer.includes(
          en ? 'Nothing from the main conversation.' : 'Rien du fil principal.'
        ),
        'par défaut, rien du fil principal'
      )
      check(first.above && first.input === '', 'carte au-dessus de la zone de saisie, saisie vide')
      check(first.cost !== '', `coût de l’aparté affiché (${first.cost})`)
      check(
        (await ui.ev(users)) === before && (await ui.ev(`!!${ui.$('permission')}`)),
        'rien dans le fil, le tour principal attend toujours sa permission'
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
      check(
        (
          await ui.ev(`[...document.querySelectorAll('[data-testid=aside-answer]')][1].innerText`)
        ).includes(
          en ? 'Main conversation joined: 1 user message(s).' : 'Fil principal joint : 1 message(s)'
        ),
        'case cochée : la fin du fil part avec la question'
      )
      await ui.ev(`${ui.$('aside-input')}.focus()`)
      await ui.type('/scenario permission')
      await ui.enter()
      await ui.waitFor(
        `!!${ui.$('aside-refused')} && ${ui.$('aside-card')}.dataset.status === 'ready'`,
        20_000
      )
      check(
        (await ui.ev(`${ui.$('aside-refused')}.innerText`)) === L('aside.refused', { count: 1 }),
        'demande d’autorisation de l’aparté refusée d’office, et dit'
      )
      await ui.shot('180-aparte-refus')

      // « Ajouter au fil » : citation dans la saisie, rien d'envoyé, carte fermée.
      await ui.click(ui.$('aside-quote'))
      await ui.waitFor(`!${ui.$('aside-card')}`)
      const quoted = await ui.ev(`${ui.$('composer-input')}.value`)
      check(
        quoted.startsWith(`> **${L('aside.title')}** — C’est quoi déjà ce flag ?`) &&
          (await ui.ev(users)) === before,
        'question et réponse en citation dans la saisie, jamais envoyées'
      )
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
      check(
        !(await ui.ev(`!!${ui.$('aside-answer')}`)),
        'raccourci : carte neuve, champ de question prêt'
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
