import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'
import { ROWS, day, newConversation, open, project, quitApp, row, userCount } from '../parcours.mjs'

const CALM = '/scenario echo Conversation tranquille'
const SHAKY = '/scenario echo Conversation agitée'
const notices = `[...document.querySelectorAll('.notice-error')]`

/**
 * « Pannes » (fiche 277) : deux conversations ; l'agent de l'une plante en plein tour, l'autre
 * n'en sait rien ; écrire relance l'agent planté ; un agent silencieux est arrêté ; une erreur de
 * tour, puis la suite ; on quitte pendant un tour, et l'app relancée rouvre la conversation qui
 * travaillait, qui reprend, l'autre intacte.
 */
export async function parcoursPannesSuite(scheme) {
  console.log(`\n— Parcours : pannes (${scheme})`)
  const workspace = project('bob-e2e-pannes-parcours-')
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-pannes-parcours-data-'))
  const journee = day('pannes')
  let calmMessages = 0
  let shakyMessages = 0
  try {
    await withApp(
      scheme,
      async (ui) => {
        await journee.attach(ui)
        const main = await mainProcess()
        await journee.step('deux conversations qui répondent', async () => {
          await ui.ready()
          await ui.send(CALM)
          await ui.ready()
          await newConversation(ui)
          await ui.send(SHAKY)
          await ui.ready()
          check((await ui.ev(`${ROWS}.length`)) === 2, 'deux conversations')
        })

        await journee.step(
          'l’agent de l’une plante en plein tour',
          async () => {
            await ui.send('/scenario plantage')
            await ui.waitFor(`!!${ui.$('restart')}`, 20000)
            const said = await ui.ev(`${notices}.map((n) => n.innerText)`)
            check(
              said.length === 1 && /code 3/.test(said[0]),
              `un avis de panne, avec le code de sortie (${said.length})`
            )
            await ui.shot('276-pannes-plantage')
          },
          { allow: [/plantage simulé|code 3|panic|exit/i] }
        )

        await journee.step('l’autre conversation n’en sait rien', async () => {
          await open(ui, CALM)
          await ui.ready()
          await ui.send('/scenario echo Toujours là ?')
          await ui.ready()
          check(
            (await ui.lastAgentText()).includes('Toujours là ?') &&
              (await ui.ev(`${notices}.length`)) === 0,
            'conversation tranquille : aucun avis, elle répond'
          )
        })

        await journee.step('écrire à la conversation plantée relance son agent', async () => {
          await open(ui, SHAKY)
          await ui.waitFor(`!!${ui.$('restart')}`)
          await ui.send('/scenario echo On repart')
          await ui.ready()
          check(
            (await ui.lastAgentText()).includes('On repart') &&
              (await ui.ev(`${notices}.length`)) === 1,
            'agent relancé : le message part, le fil (avis compris) est gardé'
          )
        })

        await journee.step('un agent silencieux, arrêté', async () => {
          await ui.send('/scenario silence-annulable')
          await ui.waitFor(`!!${ui.$('silence-banner')}`, 15000)
          await ui.click(ui.$('silence-stop'))
          await ui.ready()
          await ui.send('/scenario echo Après le silence')
          await ui.ready()
          check(
            !(await ui.ev(`!!${ui.$('silence-banner')}`)) &&
              (await ui.lastAgentText()).includes('Après le silence'),
            'bandeau de silence, « Arrêter », puis la conversation continue'
          )
        })

        await journee.step(
          'une erreur de tour, puis la suite',
          async () => {
            await ui.send('/scenario erreur')
            await ui.ready()
            const errors = await ui.ev(`${notices}.length`)
            await ui.send('/scenario echo Et ensuite ?')
            await ui.ready()
            check(
              errors === 2 && (await ui.lastAgentText()).includes('Et ensuite ?'),
              `erreur dite dans le fil (${errors} avis), la conversation continue`
            )
            shakyMessages = await userCount(ui)
          },
          { allow: [/erreur simulée|Internal error/i] }
        )

        await journee.step(
          'quitter pendant un tour',
          async () => {
            await open(ui, CALM)
            await ui.send('/scenario attend-stop')
            await ui.waitFor(`${ui.$('working')}?.dataset.activity === 'writing'`)
            calmMessages = await userCount(ui)
            await quitApp(main, MAIN_PORT)
            check(true, 'quitté pendant le tour (« Quitter » à la question de l’app)')
          },
          { closing: true }
        )
      },
      userData,
      'echo',
      { BOBINE_WORKSPACE: workspace, BOBINE_SILENCE_MS: '1500' },
      [`--inspect=${MAIN_PORT}`]
    )

    await withApp(
      scheme,
      async (ui) => {
        await journee.attach(ui)
        await journee.step('relancer : la conversation qui travaillait est rouverte', async () => {
          await ui.waitFor(`${row(CALM)}?.classList.contains('active')`, 20000)
          await ui.waitFor(`document.querySelectorAll('.msg-user').length === ${calmMessages}`)
          await ui.ready()
          await ui.send('/scenario echo On reprend après la coupure')
          await ui.ready()
          check(
            (await ui.lastAgentText()).includes('On reprend après la coupure') &&
              (await userCount(ui)) === calmMessages + 1,
            'relance : la conversation interrompue reprend'
          )
        })

        await journee.step('l’autre conversation a gardé ses pannes et répond', async () => {
          await open(ui, SHAKY)
          await ui.waitFor(`document.querySelectorAll('.msg-user').length === ${shakyMessages}`)
          await ui.send('/scenario echo Rien perdu ?')
          await ui.ready()
          check(
            (await ui.lastAgentText()).includes('Rien perdu ?') &&
              (await ui.ev(`${notices}.length`)) === 2,
            'conversation agitée : son fil entier, elle répond'
          )
          await ui.shot('276-pannes-relance')
        })

        await journee.step(
          'une panne réseau passagère, puis la réponse',
          async () => {
            // Inventaire `network` n° 3 : « fetch failed » deux fois (reprises de l'app), puis le
            // message passe, sans nouvelle bulle ni avis d'erreur.
            const users = await userCount(ui)
            const errors = await ui.ev(`${notices}.length`)
            await ui.send('/scenario reseau-instable')
            await ui.waitFor(`${ui.$('turn-retry')}?.dataset.attempt === '1'`, 10000)
            await ui.waitFor(`!${ui.$('turn-retry')}`, 20000)
            await ui.ready()
            check(
              (await ui.lastAgentText()).includes('Réseau revenu') &&
                (await userCount(ui)) === users + 1 &&
                (await ui.ev(`${notices}.length`)) === errors,
              'réseau revenu : le message part, sans nouvelle bulle ni avis d’erreur'
            )
          },
          { allow: [/fetch failed|ECONNRESET|Internal error/i] }
        )
      },
      userData,
      'echo',
      { BOBINE_AGENT_PROFILE: '', BOBINE_MOCK_AGENT: '1', BOBINE_SILENCE_MS: '1500' }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
  }
}
