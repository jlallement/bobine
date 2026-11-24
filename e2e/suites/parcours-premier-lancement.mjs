import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { affirm, probes } from '../affirm.mjs'
import { L, MAIN_PORT, NEUTRAL_AGENT_ENV, check, mainProcess, withApp } from '../lib.mjs'
import { ROWS, day, project, quitApp, userCount } from '../parcours.mjs'

/** Environnement d'un vrai premier lancement : pas de dossier imposé, l'accueil demandé. */
const firstLaunch = (trial) => ({
  BOBINE_DEFAULT_WORKSPACE: '',
  BOBINE_ONBOARDING: '1',
  BOBINE_TRIAL_DIR: trial,
  // Aucun vrai agent découvert, même installé sur la machine des essais (comme `onboarding`).
  ...NEUTRAL_AGENT_ENV
})

/**
 * « Premier lancement » (fiche 277, 7ᵉ journée ; inventaire B, risque 6 : aucune journée ne passait
 * par l'accueil) : Bobine neuve, l'accueil (Agent → Connexion → Dossier → Essai), la première
 * conversation dans le dossier choisi, une vraie réponse ; puis l'app quittée et relancée :
 * l'accueil ne revient pas, la conversation est là et continue.
 */
export async function parcoursPremierLancementSuite(scheme) {
  console.log(`\n— Parcours : premier lancement (${scheme})`)
  const workspace = project('bob-e2e-premier-')
  // Un projet pnpm : la suggestion « Lance les tests » doit le dire.
  writeFileSync(join(workspace, 'package.json'), JSON.stringify({ scripts: { test: 'vitest' } }))
  writeFileSync(join(workspace, 'pnpm-lock.yaml'), '')
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-premier-data-'))
  const trial = mkdtempSync(join(tmpdir(), 'bob-e2e-premier-essai-'))
  const journee = day('premier lancement')
  let said = 0
  try {
    await withApp(
      scheme,
      async (ui) => {
        await journee.attach(ui)
        const main = await mainProcess()
        await journee.step('l’accueil : bienvenue, l’agent trouvé présélectionné', async () => {
          await ui.waitFor(`!!${ui.$('onboarding')}`)
          check(
            (await ui.ev(`${ui.$('onboarding')}.innerText`)).includes(
              L('onboarding.agent.title')
            ) &&
              (await ui.ev(`${ui.$('onboarding-agent-mock')}.querySelector('input').checked`)) &&
              (await ui.ev(`document.querySelectorAll('.msg-user').length`)) === 0,
            'accueil ouvert sur l’étape Agent, l’agent factice coché, rien d’envoyé'
          )
        })

        await journee.step('connexion : l’agent est prêt, sans message au modèle', async () => {
          await ui.click(ui.$('onboarding-continue'))
          await ui.waitFor(`!!${ui.$('onboarding-ready')}`)
          check(
            (await ui.ev(`${ui.$('onboarding-ready')}.innerText`)).includes(
              L('onboarding.connect.readyTitle', { agent: L('profiles.mock.label') })
            ) &&
              (await ui.ev(`document.querySelector('.sidebar-footer .name')?.innerText ?? ''`)) ===
                L('profiles.mock.label'),
            '« prêt », et la barre latérale dit l’agent choisi'
          )
        })

        await journee.step('choisir le dossier du projet', async () => {
          await ui.click(ui.$('onboarding-continue'))
          await ui.waitFor(`!!${ui.$('onboarding-choose-folder')}`)
          // Dialogue natif simulé : il rend le dossier du projet.
          await main.evaluate(
            `(() => { require('electron').dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [${JSON.stringify(workspace)}] }); return true })()`
          )
          await ui.click(ui.$('onboarding-choose-folder'))
          await ui.waitFor(`!!${ui.$('onboarding-send')}`)
          check(
            (await ui.ev(`${ui.$('onboarding')}.innerText`)).includes(
              'Answer with the single word OK'
            ),
            'essai : le message à envoyer montré tel quel'
          )
        })

        await journee.step('l’essai : l’agent répond', async () => {
          await ui.click(ui.$('onboarding-send'))
          await ui.waitFor(`!!${ui.$('onboarding-replied')}`, 30000)
          check(
            (await ui.ev(`${ui.$('onboarding-replied')}.innerText`)).includes('OK') &&
              (await ui.ev(`document.activeElement?.dataset.testid`)) === 'onboarding-start',
            'essai réussi : la réponse, « Commencer » a le focus'
          )
        })

        await journee.step('commencer : la première conversation, dans le projet', async () => {
          await ui.click(ui.$('onboarding-start'))
          await ui.waitFor(`!${ui.$('onboarding')} && !!${ui.$('welcome')}`)
          await ui.waitFor(`!!${ui.$('suggestion-run-tests')}`)
          await ui.ready()
          check(
            (await ui.ev(`${ui.$('suggestion-run-tests')}.innerText`)).includes('pnpm test') &&
              (await ui.ev(`${ui.$('workspace-menu')}?.innerText ?? ''`)).includes(
                basename(workspace)
              ),
            'accueil de la conversation : « Lance les tests » avec pnpm, le dossier choisi'
          )
          // Inventaire `composer` n° 31-32 (captures) : à 760 px, saisie, envoi et suggestions
          // restent dans la fenêtre.
          await ui.viewport(760)
          await affirm(ui, '277-premier-accueil-760', [
            probes.inWidth('.composer', 'zone de saisie dans la fenêtre'),
            probes.inside(
              '[data-testid=send]',
              '.composer',
              'bouton d’envoi dans la zone de saisie'
            ),
            probes.inWidth('.suggestions .suggestion', 'suggestions dans la fenêtre')
          ])
          await ui.viewport()
          check(
            JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8')).onboarding
              ?.outcome === 'finished',
            'accueil marqué « fini »'
          )
        })

        await journee.step('la suggestion, puis le premier vrai message', async () => {
          await ui.click(ui.$('suggestion-run-tests'))
          check(
            (await ui.ev(`${ui.$('composer-input')}.value`)).includes('pnpm test') &&
              (await userCount(ui)) === 0,
            'la suggestion remplit la saisie sans l’envoyer'
          )
          await ui.ev(`${ui.$('composer-input')}.focus()`)
          await ui.enter()
          await ui.waitFor(`document.querySelectorAll('.msg-user').length === 1`)
          await ui.ready()
          await ui.waitFor(`${ROWS}.length === 1`)
          said = await userCount(ui)
          check(
            (await ui.lastAgentText()).includes('OK') &&
              (
                await ui.ev(`document.querySelector('.history-item.active')?.innerText ?? ''`)
              ).includes('pnpm test'),
            'premier message : l’agent répond, la conversation est dans la barre latérale'
          )
          await ui.shot('277-premier-conversation')
        })

        await journee.step(
          'quitter l’app',
          async () => {
            await quitApp(main, MAIN_PORT)
            check(true, 'app quittée (⌘Q)')
          },
          { closing: true }
        )
      },
      userData,
      'premier-essai',
      firstLaunch(trial),
      [`--inspect=${MAIN_PORT}`]
    )

    await withApp(
      scheme,
      async (ui) => {
        await journee.attach(ui)
        await journee.step('relancer : plus d’accueil, la conversation continue', async () => {
          await ui.waitFor(`document.querySelectorAll('.msg-user').length === ${said}`, 20000)
          await ui.ready()
          check(
            !(await ui.ev(`!!${ui.$('onboarding')}`)) &&
              (await ui.ev(`${ROWS}.length`)) === 1 &&
              (await ui.ev(`${ui.$('workspace-menu')}?.innerText ?? ''`)).includes(
                basename(workspace)
              ),
            'relancée : l’accueil ne revient pas, la conversation est rouverte dans son dossier'
          )
          await ui.send('/scenario echo On continue après la relance')
          await ui.ready()
          check(
            (await ui.lastAgentText()).includes('On continue après la relance') &&
              (await userCount(ui)) === said + 1,
            'la conversation continue avec son agent'
          )
          await ui.shot('277-premier-relance')
        })
      },
      userData,
      'premier-essai',
      firstLaunch(trial)
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
    rmSync(trial, { recursive: true, force: true })
  }
}
