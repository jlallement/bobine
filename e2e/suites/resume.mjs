import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'

/** Session gardée par l'agent factice, comme une session commencée dans `bob chat` (fiche 055). */
function storedSession(store, sessionId, cwd, title, updatedAt, exchange) {
  writeFileSync(
    join(store, `${sessionId}.json`),
    JSON.stringify({
      sessionId,
      cwd,
      title,
      updatedAt,
      modeId: 'code',
      model: 'factice-rapide',
      verbose: false,
      history: [
        { sessionUpdate: 'user_message_chunk', content: { type: 'text', text: exchange[0] } },
        { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: exchange[1] } }
      ]
    })
  )
}

/** Reprendre une session commencée ailleurs (fiche 055) : liste, filtre, reprise, pas de doublon. */
export async function resumeSuite(scheme) {
  console.log(`\n— Reprendre une session (${scheme})`)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-'))
  const other = mkdtempSync(join(tmpdir(), 'bob-e2e-ailleurs-'))
  const store = join(userData, 'mock-agent-sessions')
  const workspace = join(userData, 'workspace')
  mkdirSync(store, { recursive: true })
  mkdirSync(workspace, { recursive: true })
  storedSession(
    store,
    'ses_terminal_1',
    workspace,
    'Prépare un plan de migration Postgres vers la version 17',
    new Date(Date.now() - 3600_000).toISOString(),
    [
      'Prépare un plan de migration Postgres vers la version 17',
      'Voici le plan en **trois étapes**.'
    ]
  )
  storedSession(
    store,
    'ses_terminal_2',
    other,
    'Ajoute des tests au parser de dates',
    new Date(Date.now() - 2 * 86_400_000).toISOString(),
    ['Ajoute des tests au parser de dates', 'Tests ajoutés.']
  )
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const sessions = `[...document.querySelectorAll('[data-testid=resume-session]')]`

        // Menu « … » de l'historique (il n'apparaît qu'avec un historique) ; aussi ⇧⌘O.
        await ui.send('Bonjour')
        await ui.ready()
        await ui.click(ui.$('history-grouping'))
        await ui.click(ui.$('history-resume-session'))
        await ui.waitFor(`${sessions}.length === 1`)
        check(
          (await ui.ev(`${sessions}[0].innerText`)).includes('Prépare un plan de migration'),
          'reprendre : la session du dossier, pas celle d’un autre dossier ni celles déjà connues'
        )
        await ui.click(ui.$('resume-scope-all'))
        await ui.waitFor(`${sessions}.length === 2`)
        const folders = await ui.ev(
          `[...document.querySelectorAll('.resume-folder')].map((f) => f.innerText).join(' | ')`
        )
        check(
          folders.includes('workspace') && folders.includes('bob-e2e-ailleurs-'),
          `tous les dossiers : sessions groupées par dossier (${folders.replace(/\s+/g, ' ')})`
        )
        await ui.ev(`${ui.$('resume-filter')}.focus()`)
        await ui.type('parser')
        await ui.waitFor(`${sessions}.length === 1`)
        await ui.shot('h0-reprendre-session')
        await ui.ev(`document.querySelector('[data-testid=resume-filter]').select()`)
        await ui.type('postgres')
        await ui.waitFor(
          `${sessions}.length === 1 && ${sessions}[0].innerText.includes('Postgres')`
        )
        await ui.click(`${sessions}[0]`)
        await ui.click(ui.$('resume-confirm'))
        await ui.waitFor(`!${ui.$('resume-dialog')}`)

        // L'agent rejoue l'échange ; la conversation est en tête de l'historique, et continue.
        await ui.waitFor(`document.body.innerText.includes('trois étapes')`)
        await ui.ready()
        const active = await ui.ev(
          `document.querySelector('.history-item.active .label')?.innerText`
        )
        check(
          active?.startsWith('Prépare un plan de migration'),
          `reprise : conversation ouverte, échange rejoué (${active})`
        )
        await ui.send('Et la sauvegarde ?')
        await ui.ready()
        check(
          (await ui.ev(`document.querySelectorAll('.msg-user').length`)) === 2,
          'reprise : on continue la conversation'
        )
        await ui.shot('h1-session-reprise')

        // Fenêtre refermée : le menu de l'historique se rouvre (un menu modal bloquait la page).
        await ui.click(ui.$('history-grouping'))
        check(
          await ui
            .waitFor(`!!${ui.$('history-resume-session')}`, 3000)
            .then(() => true)
            .catch(() => false),
          'fenêtre refermée : le menu de l’historique se rouvre'
        )
        await ui.key('Escape')

        // Menu Fichier (⇧⌘O) : la session reprise n'est plus proposée.
        const main = await mainProcess()
        try {
          await main.evaluate(
            `(require('electron').Menu.getApplicationMenu().getMenuItemById('resume-session').click(), true)`
          )
        } finally {
          main.close()
        }
        await ui.waitFor(`!!${ui.$('resume-none')}`)
        check(true, 'menu Fichier : la session reprise n’est plus proposée')
        await ui.key('Escape')
      },
      userData,
      // Réponses sans autorisation à donner.
      'streaming-texte',
      {},
      // Menu macOS cliqué depuis le process principal.
      [`--inspect=${MAIN_PORT}`]
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
    rmSync(other, { recursive: true, force: true })
  }
}
