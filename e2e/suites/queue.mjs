import { sleep, check, withApp } from '../lib.mjs'

/** Écrire pendant que l'agent travaille (fiche 020). */
export async function queueSuite(scheme) {
  console.log(`\n— File d’attente (${scheme})`)
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      const users = `[...document.querySelectorAll('.msg-user')]`
      const items = `document.querySelectorAll('[data-testid=queued-item]')`
      const queueAndEnter = async (text) => {
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.type(text)
        await ui.press('Enter')
      }
      // Un tour qui ne finit qu'à l'arrêt : la file reste pleine le temps des étapes, quelle que
      // soit la vitesse de l'agent (« Envoyer maintenant » interrompt le tour, fiche 279).
      await ui.send('/scenario attend-stop')
      await ui.waitFor(`!!${ui.$('stop')}`)
      await queueAndEnter('Message en attente')
      await ui.waitFor(`${items}.length === 1`)
      await queueAndEnter('Deuxième')
      await ui.waitFor(`${items}.length === 2`)
      await ui.shot('21-file-attente')
      // Le premier message, modifié, garde sa place devant le second (fiche 247, D12).
      await ui.click(`${items}[0].querySelector('[data-testid=queued-edit]')`)
      await ui.waitFor(
        `${ui.$('composer-input')}.value === 'Message en attente' && ${items}.length === 1`
      )
      await ui.type(' modifié')
      await ui.press('Enter')
      await ui.waitFor(`${items}.length === 2`)
      const order = await ui.ev(
        `[...${items}].map((i) => i.querySelector('.queued-text').innerText).join(' | ')`
      )
      check(
        order === 'Message en attente modifié | Deuxième',
        `message modifié : il garde sa place dans la file (${order})`
      )
      await ui.click(`${items}[0].querySelector('[data-testid=queued-send-now]')`)
      await ui.waitFor(`${users}.length === 2`)
      await ui.ready()
      await ui.send('/scenario attend-stop')
      await ui.waitFor(`!!${ui.$('stop')}`)
      await queueAndEnter('Après arrêt')
      await ui.waitFor(`${items}.length === 1`)
      await ui.press('Escape')
      await ui.ready()
      await sleep(300)
      await ui.shot('22-file-apres-arret')
      await ui.click(`${items}[0].querySelector('[data-testid=queued-send-now]')`)
      await ui.waitFor(`${users}.at(-1)?.innerText === 'Après arrêt'`)
      await ui.ready()
    },
    undefined,
    'streaming-texte'
  )
}
