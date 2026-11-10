import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { check, L, root, withApp } from '../lib.mjs'

const electron = createRequire(import.meta.url)('electron')

/**
 * Agent ACP personnalisé (fiche 141) : déclaré dans Réglages › Agents comme le ferait
 * l'utilisateur, avec l'agent factice pour commande (`--sans-historique` : ni `session/load` ni
 * `session/resume`). Formulaire et son erreur en direct, page de l'agent, conversation avec lui ;
 * après redémarrage de l'app, session neuve dans la même conversation et échange d'avant reçu
 * (ADR-0030) ; modifier, puis supprimer.
 */
export async function customAgentSuite(scheme) {
  console.log(`\n— Agent ACP personnalisé (${scheme})`)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-custom-agent-'))
  const store = mkdtempSync(join(tmpdir(), 'bob-e2e-custom-agent-store-'))
  const name = 'Agent maison'
  const commandLine = [
    `"${electron}"`,
    `"${join(root, 'src/mock-agent/main.mts')}"`,
    '--scenario streaming-texte',
    '--sans-historique',
    `--nom "${name}"`,
    `--store "${store}"`
  ].join(' ')
  const page = `document.querySelector('[data-testid=settings-agent-page]')`
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        // Saisie comme au clavier pour React : valeur posée puis évènement `input`, champ quitté.
        const fill = (field, value) =>
          ui.ev(`(() => {
            const el = ${ui.$(`custom-agent-${field}`)}
            el.focus()
            const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement
            Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(value)})
            el.dispatchEvent(new Event('input', { bubbles: true }))
            el.blur()
          })()`)
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-agents'))
        await ui.waitFor(`!!${ui.$('settings-add-agent')}`)
        check(
          (await ui.ev(`${ui.$('settings-add-agent')}.innerText`)).includes(L('customAgents.add')),
          'Réglages › Agents : « Ajouter un agent ACP… » en dernière ligne'
        )
        await ui.shot('ca1-liste')

        await ui.click(ui.$('settings-add-agent'))
        await ui.waitFor(`!!${ui.$('custom-agent-form')}`)
        await fill('label', name)
        await fill('commandLine', commandLine)
        await fill('envText', 'ELECTRON_RUN_AS_NODE=1\nACME LOG info')
        await ui.waitFor(`!!${ui.$('custom-agent-problem')}`)
        check(
          (await ui.ev(`${ui.$('custom-agent-problem')}.innerText`)).includes('ACME LOG info') &&
            (await ui.ev(`${ui.$('custom-agent-save')}.disabled`)),
          'formulaire : ligne de variable mal formée signalée sous son champ, « Ajouter » grisé'
        )
        await ui.shot('ca2-erreur')
        await fill('envText', 'ELECTRON_RUN_AS_NODE=1\nACME_REGION=eu')
        await fill('apiKeyEnv', 'ACME_API_KEY')
        await ui.waitFor(`!${ui.$('custom-agent-problem')}`)
        await ui.shot('ca3-formulaire')

        await ui.click(ui.$('custom-agent-save'))
        await ui.waitFor(`${page}?.dataset.agent === 'custom-agent-maison'`)
        check(
          (await ui.ev(`${ui.$('settings-heading')}.innerText`)) === name &&
            (await ui.ev(`!!${ui.$('settings-api-keys')}`)) &&
            (await ui.ev(`!!${ui.$('custom-agent-declared')}`)) &&
            (await ui.ev(`!!${ui.$('agent-page-edit')}`)),
          'page de l’agent déclaré : connexion par sa clé d’API, « Modifier… », « Déclaré dans Bobine »'
        )
        await ui.shot('ca4-page')
        const settings = JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8'))
        check(
          settings.customAgents?.[0]?.id === 'custom-agent-maison' &&
            settings.customAgents[0].args.includes('--sans-historique') &&
            settings.customAgents[0].env.ACME_REGION === 'eu',
          'déclaration enregistrée dans settings.json : commande, arguments, variables'
        )

        // Converser avec lui : choisi dans le menu des agents du compositeur.
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)
        await ui.click(ui.$('agent-menu'))
        await ui.waitFor(`!!${ui.$('agent-option-custom-agent-maison')}`)
        await ui.click(ui.$('agent-option-custom-agent-maison'))
        await ui.waitFor(`${ui.$('agent-menu')}.innerText.includes(${JSON.stringify(name)})`)
        await ui.ready()
        await ui.send('Première question')
        await ui.ready()
        check((await ui.lastAgentText()).length > 0, 'l’agent déclaré répond')
      },
      userData
    )

    // Redémarrage : il ne sait pas reprendre ; la conversation continue dans une session neuve.
    await withApp(
      scheme,
      async (ui) => {
        const item = `document.querySelector('[data-testid=history-item] .history-open')`
        await ui.waitFor(`!!${item}`)
        await ui.click(item)
        await ui.waitFor(
          `!!document.querySelector('[data-testid=handover-divider][data-reason=no-resume]')`
        )
        await ui.ready()
        const divider = await ui.ev(`${ui.$('handover-divider')}.innerText`)
        check(
          divider.includes(L('handover.thread.renewTitle', { agent: name })) &&
            divider.includes(L('handover.thread.renewDetailNoResume', { agent: name })),
          'après redémarrage : « Nouvelle session avec Agent maison », pas de lecture seule'
        )
        await ui.shot('ca5-nouvelle-session')
        await ui.send('/scenario contexte-recu')
        await ui.ready()
        check(
          (await ui.lastAgentText()).includes('Contexte reçu'),
          'la session neuve reçoit l’échange d’avant avec le message'
        )

        // Modifier, puis supprimer.
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-agents'))
        const row = `document.querySelector('[data-testid=settings-agent][data-agent=custom-agent-maison]')`
        await ui.waitFor(`!!${row}`)
        await ui.click(row)
        await ui.waitFor(`!!${ui.$('agent-page-edit')}`)
        await ui.click(ui.$('agent-page-edit'))
        await ui.waitFor(`!!${ui.$('custom-agent-form')}`)
        check(
          (await ui.ev(`${ui.$('settings-heading')}.innerText`)) ===
            L('customAgents.form.editTitle', { agent: name }) &&
            (await ui.ev(`${ui.$('custom-agent-commandLine')}.value`)).includes(
              '--sans-historique'
            ),
          'modifier : le formulaire reprend la déclaration'
        )
        await ui.ev(`(() => {
          const el = ${ui.$('custom-agent-label')}
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Agent maison 2')
          el.dispatchEvent(new Event('input', { bubbles: true }))
        })()`)
        await ui.click(ui.$('custom-agent-save'))
        await ui.waitFor(`${ui.$('settings-heading')}?.innerText === 'Agent maison 2'`)
        await ui.click(ui.$('custom-agent-remove'))
        await ui.waitFor(`!!${ui.$('confirm-row')}`)
        await ui.shot('ca6-supprimer')
        await ui.click(ui.$('confirm-row-confirm'))
        await ui.waitFor(`!!${ui.$('settings-agent-list')} && !${row}`)
        check(true, 'supprimé : retiré de la liste des agents')
      },
      userData
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
    rmSync(store, { recursive: true, force: true })
  }
}
