import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, LANG, MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'

/** Espaces de toute sorte (insécables d'Intl et de la typographie française) ramenés à une seule. */
const spaced = (text) => (text ?? '').replace(/\s/g, ' ')

/** Plafond de 2 $ comme l'app l'écrit dans la langue des essais (`formatCap`, devise USD). */
const CAP_TEXT = spaced(
  L('scheduled.cap', {
    cap: new Intl.NumberFormat(LANG === 'en' ? 'en-US' : 'fr-FR', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(2)
  })
)

/**
 * Tâches planifiées (fiche 178) : deux tâches déjà enregistrées au lancement, l'une à l'heure (elle
 * part tout de suite, conversation marquée dans la barre latérale ; sa demande d'autorisation
 * attend l'utilisateur, rien n'est accordé à sa place), l'autre en retard de plusieurs
 * échéances sans rattrapage (notée « manquée » une seule fois, rien ne part) ; puis une tâche créée
 * par le formulaire avec un plafond, « Lancer maintenant » : le coût monte, le gardien de la fiche
 * 157 arrête le tour, l'exécution est notée « arrêtée au plafond ».
 */
export async function scheduledSuite(scheme) {
  console.log(`\n— Tâches planifiées (${scheme})`)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-planifiees-'))
  const project = join(userData, 'projet')
  mkdirSync(project)
  const now = Date.now()
  const iso = (ms) => new Date(ms).toISOString()
  const base = {
    folder: project,
    profileId: 'mock',
    worktree: false,
    paused: false,
    createdAt: iso(now - 3 * 86_400_000)
  }
  writeFileSync(
    join(userData, 'scheduled-tasks.json'),
    JSON.stringify({
      version: 1,
      tasks: [
        {
          ...base,
          id: 'revue',
          name: 'Revue du matin',
          instruction: '/scenario permission',
          schedule: { kind: 'daily', time: '09:00' },
          catchUp: true,
          cap: { amount: 2 },
          // Échéance passée d'une minute : à l'heure, elle part au lancement.
          nextRunAt: iso(now - 60_000),
          runs: [
            {
              id: 'r2',
              at: iso(now - 86_400_000),
              endedAt: iso(now - 86_300_000),
              outcome: 'done',
              cost: { amount: 0.42, currency: 'USD' }
            },
            {
              id: 'r1',
              at: iso(now - 2 * 86_400_000),
              endedAt: iso(now - 2 * 86_300_000),
              outcome: 'done',
              cost: { amount: 0.58, currency: 'USD' }
            }
          ]
        },
        {
          ...base,
          id: 'nettoyage',
          name: 'Nettoyage des branches',
          instruction: 'Liste les branches fusionnées.',
          schedule: { kind: 'interval', hours: 1 },
          catchUp: false,
          // Quatre échéances passées (Mac en veille) : notées manquées en une ligne.
          nextRunAt: iso(now - 3 * 3_600_000 - 5 * 60_000),
          runs: []
        }
      ]
    })
  )

  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      const card = (id) => `document.querySelector('[data-testid=scheduled-task][data-id="${id}"]')`
      const outcomes = (id) =>
        `[...${card(id)}.querySelectorAll('[data-testid=scheduled-run]')].map((r) => r.dataset.outcome)`

      // 1. La tâche à l'heure est partie : sa conversation est dans la barre latérale, marquée.
      await ui.waitFor(`!!${ui.$('history-scheduled-tag')}`)
      check(
        await ui.ev(
          `[...document.querySelectorAll('[data-testid=history-item]')].some((i) => i.innerText.includes('Revue du matin') && i.querySelector('[data-testid=history-scheduled-tag]'))`
        ),
        'échéance atteinte : conversation « Revue du matin » dans la barre latérale, avec le repère'
      )
      check(
        (await ui.ev(`document.querySelectorAll('[data-testid=history-scheduled-tag]').length`)) ===
          1,
        'la tâche en retard sans rattrapage ne lance rien'
      )

      // 2. Son autorisation attend l'utilisateur : rien n'est accordé à sa place.
      const scheduledRow = `[...document.querySelectorAll('[data-testid=history-item]')].find((i) => i.querySelector('[data-testid=history-scheduled-tag]'))`
      await ui.waitFor(`${scheduledRow}?.classList.contains('unread')`)
      await ui.click(ui.$('open-scheduled'))
      await ui.waitFor(`${outcomes('revue')}[0] === 'running'`)
      check(
        true,
        'demande d’autorisation en attente : l’exécution reste « en cours », la ligne attend'
      )
      await ui.shot('178-autorisation-en-attente')
      await ui.click(`${scheduledRow}.querySelector('.history-open')`)
      await ui.waitFor(`!!${ui.$('permission')}`)
      await ui.ev(`${ui.$('permission')}.querySelector('[data-kind=allow_once]').click()`)

      // 3. La page : la ligne de la barre latérale, la tâche finie, la manquée en une ligne.
      await ui.click(ui.$('open-scheduled'))
      await ui.waitFor(`!!${ui.$('scheduled-page')}`)
      check(
        (await ui.ev(`${ui.$('activity-title')}.innerText.trim()`)) === L('scheduled.title'),
        'titre de la page dans la barre de titre'
      )
      await ui.waitFor(`${outcomes('revue')}[0] === 'done'`)
      check(
        JSON.stringify(await ui.ev(outcomes('revue'))) === '["done","done","done"]',
        'l’exécution de la tâche à l’heure est terminée'
      )
      check(
        JSON.stringify(await ui.ev(outcomes('nettoyage'))) === '["missed"]',
        'échéances manquées sans rattrapage : une seule ligne « manquée »'
      )
      check(
        (await ui.ev(`${card('nettoyage')}.innerText`)).includes(
          L('scheduled.missedCount', { count: 4 })
        ),
        '… qui compte les quatre échéances'
      )
      check(
        (await ui.ev(`${ui.$('scheduled-open-only')}.innerText`)).includes(L('scheduled.openOnly')),
        'la page dit que les tâches ne tournent que Bobine ouverte'
      )
      check(
        spaced(
          await ui.ev(`${card('revue')}.querySelector('[data-testid=scheduled-cost]').innerText`)
        ).includes(CAP_TEXT),
        'plafond affiché dans la devise connue des exécutions passées'
      )
      check(
        await ui.ev(
          `(() => { const r = ${card('revue')}.querySelector('.scheduled-actions'); const b = [...r.querySelectorAll('button')].map((c) => { const x = c.getBoundingClientRect(); return (x.top + x.bottom) / 2 }); return Math.max(...b) - Math.min(...b) < 4 })()`
        ),
        'actions de la tâche sur une seule ligne'
      )
      await ui.shot('178-taches-planifiees')

      // 4. Nouvelle tâche par le formulaire : consigne, dossier (dialogue simulé), fréquence, plafond.
      const main = await mainProcess()
      try {
        await main.evaluate(`(() => {
          require('electron').dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [${JSON.stringify(project)}] })
          return true
        })()`)
      } finally {
        main.close()
      }
      await ui.click(ui.$('scheduled-new'))
      await ui.waitFor(`!!${ui.$('scheduled-form')}`)
      await ui.click(ui.$('scheduled-instruction'))
      await ui.type('/scenario cout-qui-monte')
      await ui.click(
        `[...document.querySelectorAll('[data-testid=scheduled-form] button')].find((b) => b.innerText === ${JSON.stringify(L('scheduled.form.chooseFolder'))})`
      )
      await ui.waitFor(`${ui.$('scheduled-folder')}.innerText.includes('projet')`)
      await ui.ev(`(() => {
        const select = ${ui.$('scheduled-kind')}
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'interval')
        select.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      })()`)
      // L'agent factice, jamais un vrai agent dans les essais : sinon l'essai s'arrête là.
      const agent = await ui.ev(`${ui.$('scheduled-agent')}.value`)
      if (agent !== 'mock')
        throw new Error(`agent proposé par défaut : ${agent}, pas l’agent factice`)
      check(true, 'nouvelle tâche : l’agent des nouvelles conversations est choisi d’office')
      await ui.waitFor(`!!${ui.$('scheduled-no-cap-warning')}`)
      check(true, 'toutes les 4 heures sans plafond : avertissement (6 exécutions par jour)')
      await ui.shot('178-nouvelle-tache-sans-plafond')
      await ui.click(ui.$('scheduled-cap-amount'))
      await ui.type('1')
      await ui.shot('178-nouvelle-tache')
      await ui.click(ui.$('scheduled-save'))
      await ui.waitFor(`document.querySelectorAll('[data-testid=scheduled-task]').length === 3`)
      const created = await ui.ev(
        `[...document.querySelectorAll('[data-testid=scheduled-task]')].find((c) => c.innerText.includes('cout-qui-monte'))?.dataset.id`
      )
      check(!!created, 'tâche enregistrée, nommée d’après sa consigne')

      // 5. « Lancer maintenant » : le plafond de 1 $ arrête le tour, l'issue le dit.
      await ui.click(`${card(created)}.querySelector('[data-testid=scheduled-run-now]')`)
      await ui.waitFor(`${outcomes(created)}[0] === 'running'`)
      check(
        await ui.ev(`${card(created)}.querySelector('[data-testid=scheduled-run-now]').disabled`),
        'pendant l’exécution, « Lancer maintenant » est désactivé (jamais deux à la fois)'
      )
      await ui.waitFor(`${outcomes(created)}[0] === 'capped'`, 30_000)
      check(true, 'plafond de la tâche franchi : exécution « arrêtée au plafond »')
      check(
        /\$/.test(
          await ui.ev(`${card(created)}.querySelector('.scheduled-run-cost')?.innerText ?? ''`)
        ),
        'coût réel de l’exécution affiché'
      )
      await ui.shot('178-arretee-au-plafond')

      // 6. Ouvrir l'exécution : la conversation, avec la carte du plafond.
      await ui.click(`${card(created)}.querySelector('[data-testid=scheduled-run-open]')`)
      await ui.waitFor(`!${ui.$('scheduled-page')}`)
      await ui.waitFor(`!!${ui.$('cost-cap-card')}`)
      check(true, 'la conversation de l’exécution s’ouvre sur la carte « Plafond atteint »')
      await ui.shot('178-execution-ouverte')
    },
    userData,
    'demo',
    {},
    [`--inspect=${MAIN_PORT}`]
  )
}
