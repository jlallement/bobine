import { L, sleep, check, withApp } from '../lib.mjs'

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
      const placeholder = () => ui.ev(`${ui.$('composer-input')}.placeholder`)
      check(
        (await placeholder()) === L('composer.placeholder.new'),
        'accueil : l’invite demande quoi faire'
      )
      await ui.send('/scenario lent')
      await ui.waitFor(`!!${ui.$('stop')}`)
      check(
        (await placeholder()) === L('composer.placeholder.busy'),
        'pendant la réponse : l’invite propose d’ajouter une suite'
      )
      await queueAndEnter('Message en attente')
      await ui.waitFor(`${items}.length === 1`)
      await queueAndEnter('Deuxième')
      await ui.waitFor(`${items}.length === 2`)
      check(
        (await ui.ev(`${users}.length`)) === 1 &&
          (await ui.ev(`${ui.$('composer-input')}.value`)) === '' &&
          (await ui.ev(`!!${ui.$('stop')}`)),
        'Entrée pendant la réponse : messages mis en file, la réponse continue'
      )
      await ui.shot('21-file-attente')
      await ui.click(`${items}[1].querySelector('[data-testid=queued-edit]')`)
      await ui.waitFor(`${ui.$('composer-input')}.value === 'Deuxième' && ${items}.length === 1`)
      check(true, '« Modifier » remet le message dans la zone de saisie')
      await ui.press('Enter')
      await ui.waitFor(`${items}.length === 2`)
      await ui.click(`${items}[0].querySelector('[data-testid=queued-send-now]')`)
      await ui.waitFor(`${users}.length === 2`)
      await ui.ready()
      check(
        (await ui.ev(`${users}[1].innerText`)) === 'Message en attente\n\nDeuxième' &&
          (await ui.ev(
            `document.body.innerText.includes(${JSON.stringify(L('transcript.notice.cancelled'))})`
          )) &&
          (await ui.ev(`${items}.length`)) === 0,
        '« Envoyer maintenant » : réponse interrompue, messages envoyés ensemble'
      )
      // Dans une conversation, l'invite propose de répondre à l'agent, nommé.
      const reply = L('composer.placeholder.reply', { agent: '\u0000' }).split('\u0000')
      const now = await placeholder()
      check(
        now.startsWith(reply[0]) && now.endsWith(reply[1]) && now.length > reply.join('').length,
        `conversation : l’invite propose de répondre à l’agent (${now})`
      )
      await ui.send('/scenario lent')
      await ui.waitFor(`!!${ui.$('stop')}`)
      await queueAndEnter('Après arrêt')
      await ui.waitFor(`${items}.length === 1`)
      await ui.press('Escape')
      await ui.ready()
      await sleep(300)
      check(
        (await ui.ev(`${items}.length`)) === 1 &&
          (await ui.ev(`${ui.$('queued')}.innerText`)).includes(L('queued.interrupted')),
        'Échap arrête la réponse ; la file attend au lieu de partir seule'
      )
      await ui.shot('22-file-apres-arret')
      await ui.click(`${items}[0].querySelector('[data-testid=queued-send-now]')`)
      await ui.waitFor(`${users}.at(-1)?.innerText === 'Après arrêt'`)
      await ui.ready()
      check((await ui.ev(`${items}.length`)) === 0, 'message en attente envoyé à la demande')
    },
    undefined,
    'streaming-texte'
  )
}
