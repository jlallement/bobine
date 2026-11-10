import { L, Lpart, check, withApp } from '../lib.mjs'

/** « Toujours autoriser » retenu d'une conversation à l'autre, révocable (fiche 042). */
export async function permissionsSuite(scheme) {
  console.log(`\n— Autorisations retenues (${scheme})`)
  await withApp(scheme, async (ui) => {
    const card = `document.querySelector('[data-testid=permission]')`
    await ui.send('/scenario liste-taches')
    await ui.waitFor(`!!${card}`)
    check(
      (await ui.ev(`${ui.$('permission-remember-note')}?.innerText ?? ''`)).includes(
        Lpart('toolCall.permission.rememberNote')
      ),
      'carte : « Always allow » vaudra aussi pour les prochaines conversations'
    )
    await ui.shot('c0-autorisation-retenue')
    await ui.click(`${card}.querySelector('button[data-kind=allow_always]')`)
    await ui.ready()

    await ui.click(ui.$('new-conversation'))
    await ui.waitFor(`!document.querySelector('.history-item.active')`)
    await ui.ready()
    await ui.send('/scenario liste-taches')
    await ui.ready()
    check(
      !(await ui.ev(`!!${card}`)) && (await ui.lastAgentText()).includes('Liste de tâches à jour'),
      'nouvelle conversation : accordé d’office, sans demande'
    )

    await ui.click(ui.$('open-settings'))
    await ui.waitFor(`!!${ui.$('settings')}`)
    await ui.click(ui.$('settings-privacy'))
    await ui.waitFor(`!!${ui.$('settings-remembered-tools')}`)
    check(
      (await ui.ev(`${ui.$('settings-allowed')}.innerText`)).includes(
        L('settings.privacy.tools.known.todoList')
      ),
      'réglages : l’outil est listé avec son agent, son titre dit dans la langue de l’interface'
    )
    await ui.shot('c1-outils-autorises')
    await ui.click(ui.$('forget-tool'))
    await ui.waitFor(`!!${ui.$('confirm-row')}`)
    await ui.click(ui.$('confirm-row-confirm'))
    await ui.waitFor(`!${ui.$('settings-remembered-tools')}`)
    await ui.key('Escape')
    await ui.waitFor(`!${ui.$('settings')}`)

    await ui.click(ui.$('new-conversation'))
    await ui.waitFor(`!document.querySelector('.history-item.active')`)
    await ui.ready()
    await ui.send('/scenario liste-taches')
    await ui.waitFor(`!!${card}`)
    check(true, 'révoqué : la demande revient')

    // Fiche 214 : l'agent retire lui-même sa demande ($/cancel_request, comme Bob 2.0.9 pour une
    // écriture hors du dossier) : la carte se ferme « annulée », plus rien n'attend l'utilisateur.
    await ui.click(ui.$('new-conversation'))
    await ui.waitFor(`!document.querySelector('.history-item.active')`)
    await ui.ready()
    await ui.send('/scenario annulation-par-agent')
    await ui.waitFor(`!!${card}`)
    await ui.shot('c2-demande-avant-retrait')
    await ui.waitFor(`!${card}`)
    await ui.ready()
    check(
      !(await ui.ev(`!!${ui.$('permission-answer')}`)) &&
        !(await ui.ev(`document.body.innerText`)).includes(L('toolCall.permission.cancelled')) &&
        !(await ui.ev(`document.body.innerText`)).includes(L('toolCall.state.failed')) &&
        (await ui.ev(
          `document.querySelectorAll('.history-item.active .child-state[data-state=waiting]').length`
        )) === 0,
      'demande retirée par l’agent : carte disparue sans « annulée » ni échec, plus de pastille d’attente'
    )
    await ui.shot('c2-demande-retiree-par-agent')
  })

  // Cartes de la fiche 214 (maquettes validées) avec un agent qui déclare la portée de son
  // « Toujours », comme Bob : pastille du dossier, tâches, arguments d'un outil MCP, carte à risque.
  await withApp(
    scheme,
    async (ui) => {
      const card = `document.querySelector('[data-testid=permission]')`
      // Carte armée (400 ms après son apparition, fiche 0.11 M1) : ses boutons sont atténués avant,
      // une capture trop tôt les montrerait comme désactivés.
      const armed = () => ui.waitFor(`${card}.hasAttribute('data-armed')`)
      const answerOnce = async () => {
        await armed()
        await ui.click(`${card}.querySelector('button[data-kind=allow_once]')`)
        await ui.waitFor(`!${card}`)
        await ui.ready()
      }
      const text = (testId) => ui.ev(`${ui.$(testId)}?.innerText ?? ''`)
      await ui.send('/scenario commande-dossier-bob')
      await ui.waitFor(`!!${card}`)
      const chip = `${ui.$('command-chip')}`
      check(
        (await ui.ev(`${chip}.innerText.trim()`)) === 'workspace' &&
          (await ui.ev(`${chip}.title.endsWith('/workspace')`)) &&
          (await ui.ev(`${ui.$('command-text')}.innerText.includes('npm test')`)),
        'commande : le dossier de la conversation est une pastille, chemin entier en infobulle'
      )
      check(
        (await ui.ev(`${card}.querySelector('button[data-kind=allow_always]').innerText`)).includes(
          L('toolCall.permission.alwaysConversation')
        ) &&
          (await text('permission-always-scope')).includes(
            L('toolCall.permission.alwaysScope.execute', { agent: L('profiles.mock.label') })
          ),
        'commande : « Toujours dans cette conversation » et la portée déclarée par le profil'
      )
      await armed()
      await ui.shot('c3-commande-pastille')
      await answerOnce()

      await ui.send('/scenario liste-taches-bob')
      await ui.waitFor(`!!${card}`)
      check(
        (await ui.ev(`${ui.$('permission-todos')}.querySelectorAll('li').length`)) === 4 &&
          (await text('permission-todos-count')).includes('1') &&
          (await ui.ev(`${card}.querySelector('.pc-title').innerText`)) ===
            L('toolCall.permission.question.todos'),
        'liste de tâches : question dédiée, quatre tâches et le compte'
      )
      await armed()
      await ui.shot('c4-liste-taches')
      await answerOnce()

      await ui.send('/scenario outil-mcp-bob')
      await ui.waitFor(`!!${card}`)
      check(
        (await text('permission-args')).includes('Lyon') &&
          (await text('permission-remember-note')).includes('Running Meteo'),
        'outil MCP : arguments tels que reçus, portée retenue par Bobine dite'
      )
      await armed()
      await ui.shot('c5-outil-mcp')
      await answerOnce()

      await ui.send('/scenario commande-ecriture-hors-dossier')
      await ui.waitFor(`!!${card}`)
      check(
        (await text('permission-risk-no-always')).includes(L('toolCall.permission.riskNoAlways')) &&
          !(await ui.ev(`!!${card}.querySelector('button[data-kind=allow_always]')`)),
        'carte à risque : pas de « Toujours », une ligne dit pourquoi'
      )
      await armed()
      await ui.shot('c6-carte-a-risque')
      await answerOnce()
    },
    undefined,
    'demo',
    { MOCK_AGENT_ALWAYS_SCOPE: 'bob' }
  )
}
