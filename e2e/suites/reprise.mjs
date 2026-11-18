import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, MAIN_PORT, check, mainProcess, sleep, withApp } from '../lib.mjs'

/**
 * Relance après avoir quitté en plein tour (fiche 243, recette du 2026-11-17, D10) : ⌘Q pendant
 * qu'un agent répond, « Un agent travaille encore » → Quitter ; à la relance, Bobine s'ouvre sur la
 * conversation qui travaillait (et non sur une nouvelle), qui reprend ensuite.
 */
export async function repriseSuite(scheme) {
  console.log(`\n— Relance après avoir quitté en plein tour (${scheme})`)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-reprise-'))
  const asked = join(mkdtempSync(join(tmpdir(), 'bob-e2e-reprise-question-')), 'question.txt')
  const active = `document.querySelector('.history-item.active')`
  try {
    await withApp(
      scheme,
      async (ui) => {
        // Une conversation finie, puis une autre qui travaille quand on quitte.
        await ui.send('/scenario streaming-texte')
        await ui.ready()
        await ui.click(ui.$('new-conversation'))
        await ui.waitFor(`!${active}`)
        await ui.send('/scenario attend-stop')
        await ui.waitFor(`${ui.$('working')}?.dataset.activity === 'writing'`)
        await ui.waitFor(`${active}?.innerText.includes('attend-stop')`)
        // ⌘Q : la question de l'app (dialogue simulé, « Quitter »), puis l'app se ferme.
        const main = await mainProcess()
        try {
          await main.evaluate(`(() => {
            // \`require\` n'existe que pendant l'évaluation : pris tout de suite.
            const { app, dialog } = require('electron')
            const fs = require('fs')
            dialog.showMessageBox = async (...args) => {
              fs.writeFileSync(${JSON.stringify(asked)}, args.at(-1).message)
              return { response: 0 }
            }
            setTimeout(() => app.quit(), 50)
            return true
          })()`)
        } catch {
          // La connexion au main se ferme avec l'app.
        } finally {
          main.close()
        }
        // L'app est fermée quand son processus principal ne répond plus.
        for (let i = 0; i < 100; i++) {
          const alive = await fetch(`http://127.0.0.1:${MAIN_PORT}/json/list`).then(
            () => true,
            () => false
          )
          if (!alive) break
          await sleep(150)
        }
        check(
          existsSync(asked) && readFileSync(asked, 'utf8') === L('quit.title_one'),
          'quitter en plein tour : « Un agent travaille encore » → Quitter'
        )
      },
      userData,
      'demo',
      {},
      [`--inspect=${MAIN_PORT}`]
    )
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(`${active}?.innerText.includes('attend-stop')`)
        await ui.waitFor(`document.querySelectorAll('.msg-user').length === 1`)
        check(
          !(await ui.ev(`!!${ui.$('welcome')}`)) &&
            (await ui.ev(`document.querySelector('.msg-user').innerText`)).includes(
              'attend-stop'
            ) &&
            (await ui.ev(`document.querySelectorAll('[data-testid=history-item]').length`)) === 2,
          'relance : la conversation qui travaillait est affichée, pas une nouvelle'
        )
        await ui.ready()
        await ui.shot('reprise-apres-quitter')
        await ui.send('/scenario streaming-texte')
        await ui.ready()
        check(
          (await ui.ev(`document.querySelectorAll('.msg-user').length`)) === 2 &&
            (await ui.ev(`document.querySelectorAll('[data-testid=history-item]').length`)) === 2,
          'relance : la conversation reprend dans le même fil'
        )
      },
      userData,
      'demo',
      // Rien d'imposé : un agent imposé ouvrirait une nouvelle conversation (fiche 243). L'agent
      // factice reste proposé (`BOBINE_MOCK_AGENT`, profiles.ts), sinon la rouverte serait en
      // lecture seule (agent retiré).
      { BOBINE_AGENT_PROFILE: '', BOBINE_MOCK_AGENT: '1' }
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
    rmSync(join(asked, '..'), { recursive: true, force: true })
  }
}
