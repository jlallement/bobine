import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { describeSettings } from '../../src/mock-agent/langue.mts'
import { affirm, probes } from '../affirm.mjs'
import { L, M, MAIN_PORT, MOCK_LANG, check, mainProcess, withApp } from '../lib.mjs'
import {
  ROWS,
  activeId,
  day,
  eventually,
  git,
  newConversation,
  open,
  project,
  quitApp,
  row,
  userCount
} from '../parcours.mjs'

/** Première demande de la matinée : le titre de sa conversation. */
const FIRST = 'Ajoute le filtre par statut'
const SECOND = 'Deuxième chantier : la page d’aide'
const card = `document.querySelector('[data-testid=permission]')`
const items = `document.querySelectorAll('[data-testid=queued-item]')`
const reviewer = `document.querySelector('[data-testid=work-card][data-role=code-reviewer]')`
const workRows = `[...document.querySelectorAll('[data-testid=work-row]')]`
/** Réponses des travaux dans l'ordre du fil (cartes-réponses, lignes dépliées des groupes). */
const workAnswers = `[...document.querySelectorAll('[data-testid=work-answer]')]`

/**
 * « Matinée de dev » (fiche 277) : un projet git ouvert, une demande, des autorisations (une fois,
 * refus, toujours), de vraies modifications vues dans Modifications, relues par le Code reviewer,
 * committées avec un message rédigé ; une deuxième conversation pendant que la première travaille,
 * retour, suite envoyée pendant le tour, tour arrêté ; modèle et mode changés ; puis l'app quittée
 * et relancée : la conversation reprend (historique, réglages, agent relancé), l'autre aussi.
 */
export async function parcoursMatineeSuite(scheme) {
  console.log(`\n— Parcours : matinée de dev (${scheme})`)
  const workspace = project('bob-e2e-matinee-')
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-matinee-data-'))
  const journee = day('matinée')
  let usersInFirst = 0
  /** La jauge de consommation était-elle là avant de quitter ? */
  let meterBefore = false
  try {
    await withApp(
      scheme,
      async (ui) => {
        await journee.attach(ui)
        const main = await mainProcess()
        await journee.step('ouvrir le projet git et faire une première demande', async () => {
          await ui.ready()
          check(
            (await ui.ev(`${ui.$('workspace-menu')}?.innerText ?? ''`)).includes(
              basename(workspace)
            ),
            'le dossier du projet est celui de la conversation'
          )
          await ui.send(FIRST)
          await ui.ready()
          await ui.waitFor(`!!${row(FIRST)}`)
          check(
            (await ui.lastAgentText()).includes('Ajoute le filtre par statut') &&
              (await ui.ev(`${ROWS}.length`)) === 1,
            'réponse reçue, la conversation est dans la barre latérale'
          )
        })

        await journee.step('autoriser une modification une fois', async () => {
          await ui.send('/scenario permission')
          await ui.waitFor(`!!${card}`)
          await ui.click(`${card}.querySelector('button[data-kind=allow_once]')`)
          await ui.waitFor(`!${card}`)
          await ui.ready()
          const tool = await ui.lastTool()
          check(
            tool.status === 'completed' && tool.answer?.includes(M('Autoriser')),
            'autorisée une fois : l’outil se termine'
          )
        })

        await journee.step('refuser la même demande', async () => {
          await ui.send('/scenario permission')
          await ui.waitFor(`!!${card}`)
          await ui.click(`${card}.querySelector('button[data-kind=reject_once]')`)
          await ui.waitFor(`!${card}`)
          await ui.ready()
          const tool = await ui.lastTool()
          check(
            tool.status === 'refused' &&
              (await ui.lastAgentText()).includes(
                M('Entendu, je ne modifie pas la configuration.')
              ),
            'refusée : outil « refusé », l’agent en prend acte'
          )
        })

        await journee.step('« Toujours autoriser », puis plus de question', async () => {
          await ui.send('/scenario liste-taches')
          await ui.waitFor(`!!${card}`)
          await ui.click(`${card}.querySelector('button[data-kind=allow_always]')`)
          await ui.waitFor(`!${card}`)
          await ui.ready()
          await ui.send('/scenario liste-taches')
          await ui.ready()
          check(
            !(await ui.ev(`!!${card}`)) &&
              (await ui.lastAgentText()).includes(M('Liste de tâches à jour')),
            'demande suivante accordée d’office, sans carte'
          )
        })

        await journee.step('vraies modifications, vues dans Modifications', async () => {
          await ui.send('/scenario modifications Fais les modifications')
          await ui.ready()
          await ui.waitFor(`!!${ui.$('changes-toggle')}`)
          await ui.click(ui.$('changes-toggle'))
          await ui.waitFor(`!!${ui.$('changes-tab')}`)
          const files = `[...document.querySelectorAll('[data-testid=changes-file]')]`
          // Les modifications de toute la conversation : config.json (autorisée plus tôt),
          // README.md et src/app.js.
          const readme = `${files}.find((f) => f.querySelector('.changes-toggle').innerText.includes('README.md'))`
          await ui.waitFor(`!!${readme} && ${files}.some((f) => f.innerText.includes('app.js'))`)
          await ui.click(`${readme}.querySelector('.changes-toggle')`)
          await ui.waitFor(`!!document.querySelector('[data-testid=changes-diff]')`)
          check(
            (
              await ui.ev(`document.querySelector('[data-testid=changes-diff]').innerText`)
            ).includes('Version 2') &&
              git(workspace, 'status', '--porcelain').includes('README.md'),
            'Modifications : README.md et src/app.js, le diff de README sur le disque'
          )
          // Inventaire `git` n° 2 : la puce de branche le dit aussi, après le tour de l'agent.
          check(
            await eventually(ui, `${ui.$('git-branch')}?.dataset.dirty === 'true'`),
            'après le tour de l’agent : point sur la branche (non commité)'
          )
          await ui.shot('276-matinee-modifications')
        })

        await journee.step('faire relire par le Code reviewer', async () => {
          await ui.waitFor(`!!${ui.$('changes-review')}`)
          await ui.click(ui.$('changes-review'))
          await ui.waitFor(`!!${ui.$('review-dialog')}`)
          await ui.waitFor(`!!${ui.$('review-model')}`)
          await ui.click(ui.$('review-launch'))
          await ui.waitFor(`!${ui.$('review-dialog')}`)
          await ui.waitFor(`${reviewer}?.dataset.state === 'replied'`, 30000)
          check(
            Number(await ui.ev(`${reviewer}.dataset.findings`)) > 0 &&
              (await ui.ev(`${row(FIRST)}?.classList.contains('active')`)),
            'la relecture rend ses remarques dans la conversation, qui reste affichée'
          )
        })

        await journee.step('committer avec le message rédigé par l’agent', async () => {
          const tab = `document.querySelector('.side-panel-tab[data-tab=changes]')`
          if (!(await ui.ev(`!!${ui.$('side-panel')}`))) await ui.click(ui.$('panel-toggle'))
          await ui.waitFor(`!!${ui.$('side-panel')}`)
          if (await ui.ev(`!!${tab}`)) await ui.click(tab)
          await ui.waitFor(`!!${ui.$('changes-view-git')}`)
          await ui.click(ui.$('changes-view-git'))
          await ui.waitFor(`!!${ui.$('changes-commit')}`, 15000)
          const said = await userCount(ui)
          await ui.click(ui.$('changes-commit'))
          await ui.waitFor(`${ui.$('changes-commit-draft')}?.dataset.state === 'agent'`, 20000)
          const message = await ui.ev(`${ui.$('changes-commit-message')}.value`)
          await ui.click(ui.$('changes-commit-confirm'))
          await ui.waitFor(`!!${ui.$('changes-commit-undo')}`, 15000)
          check(
            message.startsWith('feat: ') &&
              git(workspace, 'log', '-1', '--format=%s') === message.split('\n')[0] &&
              git(workspace, 'status', '--porcelain') === '' &&
              (await userCount(ui)) === said,
            `commit fait avec le message rédigé (${JSON.stringify(message.split('\n')[0])}), rien dans le fil`
          )
          await ui.waitFor(`${ui.$('git-branch')}?.dataset.dirty !== 'true'`, 10000)
          await ui.closePanel()
        })

        await journee.step(
          'une deuxième conversation pendant que la première travaille',
          async () => {
            await ui.send('/scenario attend-stop')
            await ui.waitFor(`!!${ui.$('stop')}`)
            usersInFirst = await userCount(ui)
            await newConversation(ui)
            await ui.send(SECOND)
            await ui.ready()
            check(
              (await ui.ev(`!!${row(FIRST)}?.querySelector('.spin')`)) &&
                (await ui.ev(`${row(SECOND)}?.classList.contains('active')`)) &&
                (await ui.lastAgentText()).includes('Deuxième chantier'),
              'la deuxième répond ; la première travaille encore (indicateur dans la barre latérale)'
            )
          }
        )

        await journee.step(
          'revenir à la première, envoyer une suite et poser un aparté pendant le tour',
          async () => {
            await open(ui, FIRST)
            await ui.waitFor(`!!${ui.$('stop')}`)
            await ui.waitFor(`document.querySelectorAll('.msg-user').length === ${usersInFirst}`)
            await ui.ev(`${ui.$('composer-input')}.focus()`)
            await ui.type('Et ajoute un test')
            await ui.press('Enter')
            await ui.waitFor(`${items}.length === 1`)
            check(
              (await userCount(ui)) === usersInFirst && (await ui.ev(`!!${ui.$('stop')}`)),
              'retour : le tour continue, la suite attend dans la file'
            )
            // Inventaire `aparte` n° 5 et 7 : une question à côté pendant le tour (fiche 180).
            await ui.ev(`${ui.$('composer-input')}.focus()`)
            await ui.type('/btw C’est quoi déjà ce flag ?')
            await ui.waitFor(`!${ui.$('command-menu')}`)
            await ui.enter()
            await ui.waitFor(
              `${ui.$('aside-card')}?.dataset.status === 'ready' && !!${ui.$('aside-answer')}`,
              20000
            )
            await affirm(ui, '277-matinee-aparte', [
              probes.above(
                '[data-testid=aside-card]',
                '.thread-dock .composer',
                -1,
                'carte d’aparté au-dessus de la saisie'
              )
            ])
            check(
              (await ui.ev(`${ui.$('composer-input')}.value`)) === '' &&
                (await userCount(ui)) === usersInFirst &&
                (await ui.ev(`${items}.length`)) === 1 &&
                (await ui.ev(`!!${ui.$('stop')}`)),
              'aparté : réponse à côté, saisie vide, rien dans le fil ; le tour et la file attendent'
            )
            await ui.click(ui.$('aside-close'))
            await ui.waitFor(`!${ui.$('aside-card')}`)
          }
        )

        await journee.step('arrêter le tour, puis envoyer la suite', async () => {
          await ui.click(ui.$('stop'))
          await ui.waitFor(`!${ui.$('stop')}`, 20000)
          await ui.waitFor(
            `${ui.$('queued')}?.innerText.includes(${JSON.stringify(L('queued.interrupted'))})`
          )
          await ui.click(`${items}[0].querySelector('[data-testid=queued-send-now]')`)
          await ui.waitFor(
            `[...document.querySelectorAll('.msg-user')].at(-1)?.innerText === 'Et ajoute un test'`
          )
          await ui.ready()
          check(
            (await ui.ev(`${items}.length`)) === 0 &&
              (await ui.lastAgentText()).includes('Et ajoute un test') &&
              !(await ui.ev(`!!${row(FIRST)}?.querySelector('.spin')`)),
            'tour arrêté : la suite part à la demande, l’agent y répond'
          )
        })

        await journee.step('changer de modèle et de mode', async () => {
          await ui.click(ui.$('model-chip'))
          await ui.waitFor(`!!${ui.$('control-model-factice-precis')}`)
          await ui.click(ui.$('control-model-factice-precis'))
          await ui.waitFor(`${ui.$('model-chip')}?.innerText.trim() === '${M('Factice précis')}'`)
          await ui.click(ui.$('mode-chip'))
          await ui.waitFor(`!!${ui.$('control-mode-ask')}`)
          await ui.click(ui.$('control-mode-ask'))
          await ui.waitFor(`${ui.$('mode-chip')}.innerText.includes('${M('Question')}')`)
          await ui.send('/scenario echo Où en est-on ?')
          await ui.ready()
          check(
            (await ui.lastAgentText()).includes(
              describeSettings(MOCK_LANG, { mode: 'ask', model: 'factice-precis', verbose: false })
            ),
            'modèle et mode appliqués par l’agent'
          )
          usersInFirst = await userCount(ui)
          meterBefore = await eventually(ui, `!!${ui.$('usage-meter')}`)
          await ui.shot('276-matinee-avant-relance')
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
      'echo',
      { BOBINE_WORKSPACE: workspace },
      [`--inspect=${MAIN_PORT}`]
    )

    await withApp(
      scheme,
      async (ui) => {
        await journee.attach(ui)
        await journee.step('relancer : la conversation reprend où on l’a laissée', async () => {
          await ui.waitFor(`${row(FIRST)}?.classList.contains('active')`, 20000)
          await ui.waitFor(`document.querySelectorAll('.msg-user').length === ${usersInFirst}`)
          await ui.ready()
          const seen = {
            second: await ui.ev(`!!${row(SECOND)}`),
            reviewer: await ui.ev(`!!${reviewer}`),
            model: await ui.ev(`${ui.$('model-chip')}?.innerText.trim()`),
            mode: await ui.ev(`${ui.$('mode-chip')}?.innerText.trim()`)
          }
          check(
            seen.second &&
              seen.reviewer &&
              seen.model === M('Factice précis') &&
              seen.mode?.includes(M('Question')),
            `relance : la conversation affichée, son fil (relecture comprise), son modèle et son mode (${JSON.stringify(seen)})`
          )
          // Inventaire `restart` n° 2 : relue avant tout nouveau tour (qui la rendrait de toute façon).
          check(
            meterBefore && (await eventually(ui, `!!${ui.$('usage-meter')}`)),
            `relance : la consommation de la conversation est gardée (avant : ${meterBefore})`
          )
          await ui.send('/scenario echo On reprend')
          await ui.ready()
          check(
            (await ui.lastAgentText()).includes(
              describeSettings(MOCK_LANG, { mode: 'ask', model: 'factice-precis', verbose: false })
            ) && (await userCount(ui)) === usersInFirst + 1,
            'agent relancé : il répond dans le même fil, avec les réglages de la conversation'
          )
          await ui.shot('276-matinee-reprise')
        })

        await journee.step('l’autre conversation est intacte et répond', async () => {
          const first = await activeId(ui)
          await open(ui, SECOND)
          await ui.waitFor(`document.querySelectorAll('.msg-user').length === 1`)
          await ui.send('/scenario echo Et la suite ?')
          await ui.ready()
          check(
            (await activeId(ui)) !== first &&
              (await userCount(ui)) === 2 &&
              (await ui.lastAgentText()).includes('Et la suite ?'),
            'deuxième conversation : son historique, et elle répond après la relance'
          )
        })

        await journee.step('deux rôles cités en tout premier message', async () => {
          // Inventaire `roles-travail` n° 2-3 : renderer → preload → main → filles, sans message à
          // l'agent de la mère ; la conversation neuve entre dans l'historique.
          await newConversation(ui)
          await ui.ev(`${ui.$('composer-input')}.focus()`)
          await ui.type('@code-reviewer @ux-ui-expert relisez le README')
          await ui.press('Escape')
          await ui.waitFor(`!!${ui.$('role-destination')}`)
          await ui.enter()
          await ui.waitFor(`${workRows}.length === 2`, 30000)
          check(
            (await ui.ev(`${ui.$('composer-input')}.value`)) === '' &&
              (await ui.ev(`document.querySelectorAll('[data-testid=role-request]').length`)) ===
                1 &&
              (await ui.ev(`document.querySelectorAll('[data-testid=work-group]').length`)) === 1,
            'premier message `@rôle` : parti, saisie vidée ; une bulle, une carte de groupe à deux lignes'
          )
          await ui.waitFor(`${ROWS}.some((i) => i.innerText.includes('relisez le README'))`, 15000)
          const mother = await activeId(ui)
          await ui.waitFor(
            `document.querySelectorAll('[data-testid=history-item][data-mother="${mother}"]').length === 2`,
            30000
          )
          await ui.waitFor(
            `${workRows}.filter((c) => c.dataset.state === 'replied').length === 2`,
            30000
          )
          check(
            true,
            'la conversation est dans l’historique, ses deux filles dessous ; elles répondent'
          )
        })

        await journee.step('un rôle qui écrit, dossier modifié : il part du commit', async () => {
          // Inventaire `filles-non-commite` n° 3 (choix de lancement de bout en bout) : le dossier
          // de la mère lu avant « Lancer », le choix affiché (« Partir sans elles ») porté par l'IPC.
          writeFileSync(join(workspace, 'plan.md'), '# Plan\n')
          const before = await ui.ev(`${workAnswers}.length`)
          await ui.ev(`${ui.$('composer-input')}.focus()`)
          await ui.type('@front-architect construisez la page\n/scenario voit-le-plan')
          await ui.press('Escape')
          await ui.waitFor(`!!${ui.$('role-destination')}`)
          await ui.waitFor(`${ui.$('launch-line')}?.dataset.count === '1'`, 10000)
          check(
            (await ui.ev(`${ui.$('launch-line')}.innerText`)).includes(
              L('launchLine.without', { count: 1 })
            ),
            'rôle qui écrit sur un dossier modifié : la ligne dit qu’il partira sans la modification'
          )
          await ui.enter()
          await ui.waitFor(`${workAnswers}.length > ${before}`, 30000)
          check(
            (await ui.ev(`${workAnswers}.at(-1).innerText`)).includes('je ne trouve pas plan.md') &&
              (await ui.ev(`!!${ui.$('work-left-behind')}`)),
            'Entrée : la fille part du dernier commit, sans plan.md ; rappel sur sa carte'
          )
        })
      },
      userData,
      'echo',
      // Rien d'imposé : l'app rouvre la conversation affichée en quittant (fiche 243).
      { BOBINE_AGENT_PROFILE: '', BOBINE_MOCK_AGENT: '1' }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
  }
}
