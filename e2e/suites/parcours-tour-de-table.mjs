import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, withApp } from '../lib.mjs'
import { day, project, userCount } from '../parcours.mjs'

/**
 * Journée « tour de table » (fiches 277, 285) : un vrai usage, avec un tour complet au milieu. On
 * converse ; on pose une question à trois modèles (premier usage : Entrée ouvre le menu) ; la
 * synthèse arrive d'elle-même et la carte se replie ; « Demander de l'appliquer » part comme un
 * message ordinaire ; on ouvre la conversation d'un participant et l'on revient ; puis la
 * conversation continue normalement. Après chaque étape : journal propre, affichage cohérent.
 *
 * La conversation joue `synthese-tour-de-table` (sa « Réponse ordinaire » hors des demandes du
 * tour) ; les participants, le scénario de leur modèle.
 */
const PEER = () => L('profiles.mockPeer.label')
const ENV = {
  BOBINE_MOCK_PEER: '1',
  MOCK_MODELS: 'fx/alpha=Fx/Alpha,fx/beta=Fx/Beta',
  MOCK_AGENT_SCENARIO_BY_MODEL: 'fx/alpha=avis-participant,fx/beta=avis-hors-format'
}
const optionByName = (name) =>
  `[...document.querySelectorAll('[data-testid=roundtable-option]')].find((o) => o.querySelector('.roundtable-option-name')?.textContent === ${JSON.stringify(name)})`
const rowOf = (name) =>
  `[...document.querySelectorAll('[data-testid=roundtable-row]')].find((r) => r.querySelector('[data-testid=roundtable-row-name]')?.textContent.startsWith(${JSON.stringify(name)}))`

async function pick(ui, name) {
  if (!(await ui.ev(`!!${optionByName(name)}`))) {
    if (await ui.ev(`!!${ui.$('roundtable-others')}`)) await ui.click(ui.$('roundtable-others'))
    await ui.waitFor(`!!${ui.$('roundtable-search')}`)
    await ui.ev(
      `(() => { const i = ${ui.$('roundtable-search')}; i.focus(); i.select(); return true })()`
    )
    await ui.type(name)
    await ui.waitFor(`!!${optionByName(name)}`)
  }
  await ui.click(optionByName(name))
}

export async function parcoursTourDeTableSuite(scheme) {
  console.log(`\n— Parcours : tour de table (${scheme})`)
  const workspace = project('bob-e2e-parcours-tdt-')
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-parcours-tdt-data-'))
  const journee = day('tour de table')
  try {
    await withApp(
      scheme,
      async (ui) => {
        await journee.attach(ui)

        await journee.step('converser d’abord', async () => {
          await ui.ready()
          await ui.send('On regarde la file de tâches du carnet.')
          await ui.ready()
          check((await userCount(ui)) === 1, 'un premier échange ordinaire')
        })

        await journee.step('poser la question à trois modèles (premier usage)', async () => {
          await ui.ev(`${ui.$('composer-input')}.focus()`)
          await ui.type('/roundtable Postgres seul, ou une file dédiée ?')
          await ui.waitFor(`!!${ui.$('roundtable-line')}`)
          await ui.enter()
          await ui.waitFor(`!!${ui.$('roundtable-menu')}`)
          await ui.waitFor(
            `document.querySelectorAll('[data-testid=roundtable-option]').length > 0`
          )
          for (const name of ['Alpha', 'Beta', PEER()]) await pick(ui, name)
          await ui.key('Escape')
          await ui.waitFor(`!${ui.$('roundtable-menu')}`)
          await ui.waitFor(`!!${ui.$('roundtable-cost-full')}`)
          await ui.ev(`${ui.$('composer-input')}.focus()`)
          await ui.enter()
          await ui.waitFor(`!!${ui.$('roundtable-card')}`, 20_000)
          check(
            (await ui.ev(`document.querySelectorAll('[data-testid=roundtable-row]').length`)) === 3,
            'la carte du tour, une ligne par participant'
          )
        })

        await journee.step('la synthèse arrive, la carte se replie', async () => {
          await ui.waitFor(`!!${ui.$('roundtable-actions')}`, 60_000)
          await ui.waitFor(`${ui.$('roundtable-card')}?.dataset.collapsed === 'true'`, 10_000)
          check(
            (await ui.ev(`${ui.$('roundtable-answer-label')}.textContent`)).startsWith(
              L('roundtable.synthesis.label', { model: '@' }).split('@')[0] ?? ''
            ),
            'la réponse porte l’étiquette de la synthèse'
          )
          await ui.shot('277-tour-de-table-synthese')
        })

        await journee.step('« Demander de l’appliquer » : un message ordinaire', async () => {
          const before = await userCount(ui)
          await ui.click(ui.$('roundtable-apply'))
          await ui.waitFor(
            `[...document.querySelectorAll('[data-testid=user-message]')].some((m) => m.textContent.includes(${JSON.stringify(L('roundtable.synthesis.applyDraft'))}))`,
            20_000
          )
          await ui.ready()
          check((await userCount(ui)) === before + 1, 'un message de plus, comme tapé')
          check(
            !(await ui.ev(`!!${ui.$('roundtable-apply')}`)),
            '« Appliquer » ne se repropose pas'
          )
        })

        await journee.step('ouvrir la conversation d’un participant, revenir', async () => {
          await ui.click(ui.$('roundtable-head-toggle'))
          await ui.waitFor(`!!${rowOf('Alpha')}`)
          await ui.click(`${rowOf('Alpha')}.querySelector('[data-testid=roundtable-row-toggle]')`)
          await ui.waitFor(`!!${rowOf('Alpha')}.querySelector('[data-testid=roundtable-open]')`)
          await ui.click(`${rowOf('Alpha')}.querySelector('[data-testid=roundtable-open]')`)
          await ui.waitFor(`!!${ui.$('title-origin')}`)
          await ui.click(ui.$('title-origin'))
          await ui.waitFor(`!!${ui.$('roundtable-card')}`)
        })

        await journee.step('la conversation continue normalement', async () => {
          const before = await userCount(ui)
          await ui.send('Et pour les essais ?')
          await ui.ready()
          check(
            (await userCount(ui)) === before + 1 &&
              (await ui.ev(`document.querySelectorAll('[data-testid=roundtable-card]').length`)) ===
                1 &&
              (await ui.ev(
                `document.querySelectorAll('[data-testid=roundtable-answer]').length`
              )) === 1,
            'message ordinaire : ni nouveau tour, ni réponse prise pour la synthèse'
          )
          await ui.shot('277-tour-de-table-suite')
        })
      },
      userData,
      'synthese-tour-de-table',
      { BOBINE_WORKSPACE: workspace, ...ENV }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
  }
}
