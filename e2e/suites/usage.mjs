import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { L, LANG, check, sleep, withApp } from '../lib.mjs'

/** Texte sans espaces insécables (Intl en français). */
const plain = (text) => text.replace(/[\u202f\u00a0]/g, ' ')

/** Nombres comme l'app les écrit dans la langue des essais (`formatCost`, `formatCostShort`). */
const LOCALE = LANG === 'en' ? 'en-US' : 'fr-FR'
const nf = (options) => (n) => plain(new Intl.NumberFormat(LOCALE, options).format(n))
const usd = nf({ style: 'currency', currency: 'USD', maximumFractionDigits: 4 })
const amount = nf({ maximumFractionDigits: 4 })

/**
 * Coût de la conversation (fiches 109, 113) : en un seul endroit, le détail de la puce de
 * consommation — `total` cumulé, moyenne et une ligne par échange (`perTurn`). Ni dans la liste
 * des conversations, ni dans l'en-tête.
 */
async function checkCost(ui, { total, perTurn, label }) {
  check(
    !(await ui.ev(
      `!!document.querySelector('[data-testid=history-cost], [data-testid=conversation-cost]')`
    )),
    `${label} : rien dans la liste des conversations ni dans l’en-tête`
  )
  await ui.click(ui.$('usage-meter'))
  await ui.waitFor(`!!${ui.$('usage-details')}`)
  await ui.waitFor(
    `(${ui.$('usage-cost')}?.innerText ?? '').replace(/[\u202f\u00a0]/g, ' ') === ${JSON.stringify(total)}`,
    8000
  )
  check(true, `${label} : coût cumulé dans le détail de la consommation (${total})`)
  const turns = await ui.ev(
    `[...document.querySelectorAll('[data-testid=usage-turn] .cost-turn-cost')].map((c) => c.innerText)`
  )
  const average = plain(await ui.ev(`${ui.$('usage-average')}.innerText`))
  check(
    turns.length === 2 &&
      turns.every((c) => plain(c) === perTurn) &&
      average.includes(perTurn) &&
      average.includes(L('usage.average')),
    `${label} : une ligne par échange (${turns.map(plain).join(', ')}), moyenne par échange`
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

/** Consommation : jauge de contexte, détail, alerte, compaction (fiche 019) ; coût (fiche 109). */
export async function usageSuite(scheme) {
  console.log(`\n— Consommation (${scheme})`)
  await withApp(scheme, async (ui) => {
    await ui.ready()
    check(!(await ui.ev(`!!${ui.$('usage-meter')}`)), 'rien d’affiché avant le premier échange')
    await ui.send('/scenario streaming-texte')
    await ui.ready()
    await ui.send('/scenario streaming-texte')
    await ui.ready()
    await ui.waitFor(`!!${ui.$('usage-meter')}`)
    check(
      /\d+\s?%/.test(await ui.ev(`${ui.$('usage-meter')}.innerText`)),
      'jauge de contexte près de la zone de saisie'
    )
    await ui.click(ui.$('usage-meter'))
    await ui.waitFor(`!!${ui.$('usage-details')}`)
    const details = await ui.ev(`${ui.$('usage-details')}.innerText`)
    check(
      details.includes(L('usage.tokens.total', { count: 2 })) &&
        details.includes(L('usage.tokens.output')) &&
        details.includes('$'),
      'détail : jetons cumulés sur 2 échanges, coût annoncé par l’agent'
    )
    check(
      plain(await ui.ev(`${ui.$('usage-cost')}.innerText`)) === usd(0.025),
      'coût cumulé : 2 × 0,0125 $US'
    )
    check(
      (await ui.ev(`${ui.$('usage-open-board')}?.innerText`)) === L('usage.board.openAll'),
      'détail : « Toute la consommation… » mène au tableau (fiche 137)'
    )
    await ui.shot('14-consommation')
    await closePopover(ui, 'usage-details')

    // Comme OpenCode : coût en dollars annoncé par ACP, jetons du tour (fiche 109).
    await checkCost(ui, { total: usd(0.025), perTurn: usd(0.0125), label: 'coût par ACP' })
    await ui.shot('14b-cout-conversation')
    await closePopover(ui, 'usage-details')

    await ui.send('/scenario contexte-plein')
    await ui.ready()
    check(
      await ui.ev(`${ui.$('usage-meter')}.classList.contains('full')`),
      'contexte presque plein : jauge en alerte'
    )
    await ui.send('/scenario compaction')
    await ui.ready()
    check(
      (await ui.ev(`${ui.$('compaction')}?.dataset.status`)) === 'completed' &&
        !(await ui.ev(`${ui.$('usage-meter')}.classList.contains('full')`)),
      'compaction : « conversation résumée » dans le fil, contexte libéré'
    )
    await ui.ev(`${ui.$('compaction')}.open = true`)
    await ui.shot('15-compaction')
  })
}

/**
 * Journal de consommation (fiche 130), relu après la fermeture de l'app : une ligne par échange,
 * le coût de Bob relu après coup sur la ligne de son tour, sans jetons (rien par ACP).
 */
function checkJournal(userData) {
  const db = new DatabaseSync(join(userData, 'usage.sqlite'), { readOnly: true })
  try {
    const rows = db
      .prepare(
        'SELECT profile_id, stop_reason, cost_amount, cost_currency, total_tokens FROM turns ORDER BY started_at'
      )
      .all()
    check(
      rows.length === 2 &&
        rows.every(
          (r) =>
            r.profile_id === 'mock' &&
            r.stop_reason === 'end_turn' &&
            r.cost_amount === 0.0125 &&
            r.cost_currency === 'bobcoins' &&
            r.total_tokens === null
        ),
      `journal de consommation : une ligne par échange, coût de Bob relu sur la même ligne (${JSON.stringify(rows)})`
    )
  } finally {
    db.close()
  }
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
        check(
          !(await ui.ev(`!!${ui.$('usage-meter')}`)) ||
            !/\d+\s?%/.test(await ui.ev(`${ui.$('usage-meter')}.innerText`)),
          'rien par ACP : pas de jauge de contexte'
        )
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
    checkJournal(userData)
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
