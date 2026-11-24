import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LANG, check, sleep, withApp } from '../lib.mjs'

/** Texte sans espaces insécables (Intl en français). */
const plain = (text) => text.replace(/[\u202f\u00a0]/g, ' ')

/** Nombres comme l'app les écrit dans la langue des essais (`formatCost`, `formatCostShort`). */
const LOCALE = LANG === 'en' ? 'en-US' : 'fr-FR'
const nf = (options) => (n) => plain(new Intl.NumberFormat(LOCALE, options).format(n))
const amount = nf({ maximumFractionDigits: 4 })

/**
 * Coût de la conversation (fiches 109, 113) : en un seul endroit, le détail de la puce de
 * consommation — `total` cumulé, moyenne et une ligne par échange (`perTurn`). Ni dans la liste
 * des conversations, ni dans l'en-tête.
 */
async function checkCost(ui, { total }) {
  await ui.click(ui.$('usage-meter'))
  await ui.waitFor(`!!${ui.$('usage-details')}`)
  await ui.waitFor(
    `(${ui.$('usage-cost')}?.innerText ?? '').replace(/[\u202f\u00a0]/g, ' ') === ${JSON.stringify(total)}`,
    8000
  )
}

/** Fermé avant d'écrire : un Échap perdu (machine chargée) laisserait le détail ouvert. */
async function closePopover(ui, testId) {
  await ui.key('Escape')
  await ui.waitFor(`!${ui.$(testId)}`, 3000).catch(async () => {
    await ui.key('Escape')
    await ui.waitFor(`!${ui.$(testId)}`)
  })
}

/**
 * Comme Bob (fiche 109) : rien par ACP, coût en bobcoins lu dans sa base (d'essai) après chaque
 * réponse ; la puce de consommation et son détail par échange le montrent quand même. Le journal
 * de consommation garde une ligne par échange (fiche 130). Rouverte après une relance, rejeu tardif
 * compris, la conversation garde le bilan de son dernier tour et la durée de chaque tour (0.11, M4).
 */
export async function usageBobSuite(scheme) {
  /** Bilan et durées des tours avant de quitter (0.11, M4). */
  let before
  console.log(`\n— Coût comme Bob (${scheme})`)
  const home = mkdtempSync(join(tmpdir(), 'bob-e2e-usage-home-'))
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-usage-data-'))
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('/scenario streaming-texte')
        await ui.ready()
        // Le coût du premier échange arrive après la réponse (relu 1,5 s plus tard).
        await ui.waitFor(`!!${ui.$('usage-meter')}`, 8000)
        await ui.send('/scenario streaming-texte')
        await ui.ready()
        await checkCost(ui, {
          total: `${amount(0.025)} Bobcoins`,
          perTurn: `${amount(0.0125)} Bobcoins`,
          label: 'coût comme Bob'
        })
        await ui.shot('14c-cout-bob')
        await closePopover(ui, 'usage-details')
        before = await turnFooters(ui)
      },
      userData,
      'demo',
      {
        BOBINE_CONFIG_HOME: home,
        MOCK_AGENT_USAGE: 'bob',
        MOCK_AGENT_CURRENCY: 'bobcoins',
        MOCK_AGENT_COST_SOURCE: 'bob-db',
        MOCK_AGENT_REPLAY: 'late',
        MOCK_AGENT_TITLES: 'prompt'
      }
    )
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.waitFor(`document.querySelectorAll('[data-testid=history-item]').length > 0`)
        await ui.click(`document.querySelector('[data-testid=history-item] .history-open')`)
        await ui.ready()
        // Le rejeu tardif de Bob arrive après l'ouverture : on attend qu'il soit passé.
        await sleep(1500)
        const after = await turnFooters(ui)
        check(
          before?.summary?.includes('Bobcoins') &&
            before.durations.length === 2 &&
            JSON.stringify(after) === JSON.stringify(before),
          `rouverte (session/load, rejeu tardif comme Bob) : bilan du dernier tour et durée de chaque tour gardés (${JSON.stringify(after)})`
        )
        await ui.shot('14d-cout-bob-rouverte')
      },
      userData,
      'demo',
      {
        BOBINE_CONFIG_HOME: home,
        MOCK_AGENT_USAGE: 'bob',
        MOCK_AGENT_CURRENCY: 'bobcoins',
        MOCK_AGENT_COST_SOURCE: 'bob-db',
        MOCK_AGENT_REPLAY: 'late',
        MOCK_AGENT_TITLES: 'prompt'
      }
    )
  } finally {
    rmSync(home, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
  }
}

const turnFooters = (ui) =>
  ui.ev(`({
    summary: document.querySelector('[data-testid=turn-summary]')?.innerText ?? null,
    durations: [...document.querySelectorAll('[data-testid=turn-duration]')].map((d) => d.textContent),
    meter: document.querySelector('[data-testid=usage-meter]')?.innerText ?? null,
    items: document.querySelectorAll('[data-item-id]').length
  })`)
