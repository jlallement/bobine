import { check, withApp } from '../lib.mjs'

/** Premier lancement de Bob (simulé) : dossier, connexion, puis formulaires de l'agent. */
export async function bobSuite(scheme) {
  console.log(`\n— Parcours Bob simulé (${scheme})`)
  await withApp(
    scheme,
    async (ui) => {
      await ui.waitFor(`!!${ui.$('blocker-trust')}`)
      await ui.shot('7-dossier')
      check(
        await ui.ev(
          `!!${ui.$('agent-menu')} && !${ui.$('agent-menu')}.disabled && !!${ui.$('workspace-menu')} && !${ui.$('workspace-menu')}.disabled`
        ),
        'agent bloqué : on peut toujours changer d’agent ou de dossier'
      )
      await ui.ev(`${ui.$('trust-once')}.click()`)
      await ui.waitFor(`!!${ui.$('blocker-auth')}`)
      await ui.shot('8-connexion')
      await ui.ev(`${ui.$('auth-mock-sso')}.click()`)
      await ui.ready()
      check(true, 'connexion SSO (simulée) → agent prêt')

      // Formulaire riche
      await ui.send('/scenario bob-elicitation')
      await ui.waitFor(`!!${ui.$('elicitation')}`)
      await ui.ev(`${ui.$('elicitation-submit')}.click()`)
      await ui.waitFor(`document.querySelectorAll('.field-error').length > 0`)
      await ui.ev(`(() => {
        const select = document.querySelector('#f-environnement')
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'recette')
        select.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      })()`)
      await ui.ev(`(() => {
        const boxes = [...${ui.$('elicitation')}.querySelectorAll('.field-check input')]
        boxes.find((b) => b.parentElement.innerText.includes('Europe')).click()
        boxes.find((b) => b.parentElement.innerText.includes('confirme')).click()
        return true
      })()`)
      await ui.shot('9-formulaire')
      await ui.ev(`${ui.$('elicitation-submit')}.click()`)
      await ui.waitFor(`!!${ui.$('elicitation-answer')}`)
      await ui.ready()
      check(
        (await ui.lastAgentText()).includes('Déploiement sur recette lancé'),
        'formulaire rempli → réponse transmise à l’agent'
      )

      // Page web : refusée (on n'ouvre pas le navigateur pendant les tests)
      await ui.send('/scenario elicitation-url')
      await ui.waitFor(`!!${ui.$('elicitation')}`)
      await ui.ev(`${ui.$('elicitation')}.querySelector('.btn.ghost').click()`)
      await ui.ready()

      // Licence au premier message, comme Bob 2.0.9 (fiche 163) : message sur plusieurs lignes.
      await ui.send('/scenario bob-licence-formulaire')
      await ui.waitFor(`!!${ui.$('elicitation')}`)
      check(
        await ui.ev(`(() => {
          const message = ${ui.$('elicitation')}.querySelector('.elicitation-message')
          return getComputedStyle(message).whiteSpace === 'pre-line' &&
            message.innerText.split('\\n').length === 4
        })()`),
        'licence : message de l’agent sur ses quatre lignes'
      )
      await ui.shot('163-licence-formulaire')
      await ui.ev(`${ui.$('elicitation')}.querySelector('.btn.ghost').click()`)
      await ui.ready()
    },
    undefined,
    'bob-premiere-connexion'
  )
}
