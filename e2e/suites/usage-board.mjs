import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, LANG, MAIN_PORT, check, mainProcess, sleep, withApp } from '../lib.mjs'

/** Texte sans espaces insécables (Intl en français). */
const plain = (text) => (text ?? '').replace(/[  ]/g, ' ')
const LOCALE = LANG === 'en' ? 'en-US' : 'fr-FR'
const usd = (n) =>
  plain(
    new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 4
    }).format(n)
  )
const pad = (n) => String(n).padStart(2, '0')
const today = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})()
const daysInMonth = (() => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
})()

/** Valeur d'un chiffre clé (`usage-kpi-turns`…). */
const kpi = (ui, id) =>
  ui.ev(`${ui.$(`usage-kpi-${id}`)}?.querySelector('.usage-kpi-value')?.innerText`)
const bars = (ui) => ui.ev(`document.querySelectorAll('[data-testid=usage-bar]').length`)
const todayCell = `document.querySelector('[data-testid=activity-heat-day][data-day="${today}"]')`

/** Ouvre « Mon activité » par le lien du détail de la puce de consommation. */
async function openFromMeter(ui) {
  await ui.click(ui.$('usage-meter'))
  await ui.waitFor(`!!${ui.$('usage-open-board')}`)
  await ui.click(ui.$('usage-open-board'))
  await ui.waitFor(`!!${ui.$('usage-kpis')}`)
}

/** Choisit un export dans le menu « Exporter… » ; rend le fichier écrit. */
async function exportCsv(ui, out, kind) {
  const before = new Set(readdirSync(out))
  await ui.click(ui.$('usage-export'))
  await ui.waitFor(`!!${ui.$(`usage-export-${kind}`)}`)
  await ui.click(ui.$(`usage-export-${kind}`))
  // Le fichier écrit, puis la note qui le dit (elle remplace celle de l'export d'avant).
  for (let i = 0; i < 50 && readdirSync(out).every((f) => before.has(f)); i++) await sleep(100)
  const file = readdirSync(out).find((f) => !before.has(f))
  if (file)
    await ui.waitFor(`${ui.$('usage-export-note')}?.innerText.includes(${JSON.stringify(file)})`)
  return file ? readFileSync(join(out, file), 'utf8').trimEnd().split('\r\n') : []
}

/**
 * Mise en page à une largeur : ni la fenêtre ni la page ne défilent de côté, la grille défile dans
 * sa carte calée à droite (semaines récentes visibles), colonnes des chiffres clés.
 */
async function layout(ui, width) {
  if (width) await ui.waitFor(`window.innerWidth === ${width}`)
  await sleep(300)
  return ui.ev(`(() => {
    const page = document.querySelector('[data-testid=activity]')
    const heat = document.querySelector('.activity-heat-scroll')
    const [first, second] = [...document.querySelectorAll('.activity-filters-group')].map((g) => g.getBoundingClientRect())
    const columns = getComputedStyle(document.querySelector('[data-testid=usage-kpis]')).gridTemplateColumns.split(' ').length
    const cards = [...page.querySelectorAll('.settings-card')].every((c) => c.getBoundingClientRect().right <= page.getBoundingClientRect().right + 1)
    return {
      width: Math.round(page.clientWidth),
      windowScroll: document.scrollingElement.scrollWidth > window.innerWidth,
      pageScroll: page.scrollWidth > page.clientWidth,
      heatScrolls: heat.scrollWidth > heat.clientWidth,
      heatRight: heat.scrollLeft + heat.clientWidth >= heat.scrollWidth - 2,
      filterLines: second.top >= first.bottom - 1 ? 2 : 1,
      columns,
      cards,
      // Ce qui dépasse la page (pour le compte rendu d'un échec).
      over: [...page.querySelectorAll('*')]
        .filter((e) => e.getBoundingClientRect().right > page.getBoundingClientRect().right + 1 && !e.closest('.activity-heat-scroll, .activity-table-scroll'))
        .slice(0, 4)
        .map((e) => e.className?.baseVal ?? e.className)
    }
  })()`)
}

/**
 * « Mon activité » (fiche 144, tableau de la fiche 137) : deux échanges avec l'agent factice, la
 * page les montre (grille, chiffres, graphique, tableaux) ; semaine, mois, année, un jour choisi
 * dans la grille ; agent ; export CSV par « Enregistrer sous » (remplacé dans le main) ; ⇧⌘U par le
 * menu Fenêtre ; une conversation ouverte referme la page ; largeurs réduites, barre latérale
 * fermée, panneau ouvert ; remise à zéro dans Réglages › Données, puis un échange de nouveau compté.
 */
export async function usageBoardSuite(scheme) {
  console.log(`\n— Mon activité (${scheme})`)
  const out = mkdtempSync(join(tmpdir(), 'bob-e2e-usage-board-'))
  try {
    await withApp(
      scheme,
      async (ui) => {
        const main = await mainProcess()
        const menu = (id) =>
          main.evaluate(
            `(require('electron').Menu.getApplicationMenu().getMenuItemById(${JSON.stringify(id)}).click(), true)`
          )
        try {
          await main.evaluate(`(() => {
            const { dialog } = require('electron')
            const path = require('path')
            dialog.showSaveDialog = async (a, b) => {
              const options = b ?? a
              return { canceled: false, filePath: path.join(${JSON.stringify(out)}, path.basename(options.defaultPath)) }
            }
            return true
          })()`)
          await ui.ready()
          await ui.send('/scenario streaming-texte')
          await ui.ready()
          await ui.send('/scenario streaming-texte')
          await ui.ready()
          // Panneau « Session » ouvert de lui-même (fiche 166) : fermé, la page a la largeur mesurée.
          await ui.closePanel()
          await ui.waitFor(`!!${ui.$('usage-meter')}`)
          const conversation = await ui.ev(
            `document.querySelector('.history-item.active')?.dataset.id`
          )

          // 1. Barre latérale : Rechercher en icône dans l'en-tête, « Mon activité » sous
          // « Nouvelle conversation ».
          check(
            (await ui.ev(
              `document.querySelector('.sidebar-header').contains(${ui.$('open-search')}) && ${ui.$('open-activity')}.previousElementSibling === ${ui.$('new-conversation')}`
            )) === true,
            'barre latérale : loupe dans l’en-tête, « Mon activité » sous « Nouvelle conversation »'
          )
          const labels = await ui.ev(
            `['new-conversation', 'open-activity'].map((id) => Math.round(document.querySelector('[data-testid="' + id + '"] .label').getBoundingClientRect().left))`
          )
          check(labels[0] === labels[1], `libellés du haut de la barre alignés (${labels})`)
          await ui.click(ui.$('open-search'))
          await ui.waitFor(`!!document.querySelector('[data-testid=search]')`)
          check(true, 'la loupe ouvre la recherche')
          await ui.key('Escape')
          await ui.waitFor(`!document.querySelector('[data-testid=search]')`)

          // 2. Le lien de la puce ouvre la page, à la place du fil et de la saisie.
          await openFromMeter(ui)
          check(
            (await ui.ev(`${ui.$('activity-title')}?.innerText`)) === L('activity.title') &&
              (await ui.ev(`${ui.$('open-activity')}.classList.contains('active')`)) &&
              !(await ui.ev(`!!${ui.$('composer-input')}`)) &&
              !(await ui.ev(`!!document.querySelector('.history-item.active')`)),
            '« Toute mon activité… » : la page, son titre, sa ligne en surbrillance, sans zone de saisie'
          )
          await ui.waitFor(`${ui.$('usage-kpi-turns')}?.innerText.includes('2')`)
          const turnsSub = await ui.ev(`${ui.$('usage-kpi-turns')}.innerText`)
          check(
            (await kpi(ui, 'turns')) === '2' &&
              turnsSub.includes(L('usage.board.kpi.conversations', { count: 1 })),
            `semaine : 2 échanges dans 1 conversation (${turnsSub.replace(/\n/g, ' ')})`
          )
          check(
            plain(await kpi(ui, 'cost')) === usd(0.025) &&
              (await kpi(ui, 'tokens')) !== L('usage.board.unknown'),
            `coût dans son unité (${plain(await kpi(ui, 'cost'))}), jetons traités communiqués`
          )
          check(
            (await bars(ui)) === 7 &&
              (await ui.ev(
                `document.querySelector('[data-testid=usage-bar][data-bucket="${today}"] path')?.getAttribute('fill')`
              )) === 'var(--chart-1)',
            'graphique de la semaine : sept jours, l’agent factice en orange (--chart-1)'
          )
          check(
            (await ui.ev(`${ui.$('activity-next')}.disabled`)) === true,
            'semaine en cours : « période suivante » grisée'
          )

          // 3. Grille d'activité : aujourd'hui cerclé, au plus haut niveau, infobulle.
          await ui.waitFor(`!!${todayCell}`)
          check(
            (await ui.ev(`${todayCell}.getAttribute('class')`)).includes('heat-level-4') &&
              !!(await ui.ev(`!!${ui.$('activity-heat-today')}`)) &&
              plain(await ui.ev(`${ui.$('activity-heat-total')}.innerText`)) ===
                plain(L('activity.heat.total', { count: 2, total: '2' })),
            'grille : 2 échanges sur 12 mois, aujourd’hui cerclé et au niveau 4'
          )
          await ui.hover(await ui.center(todayCell))
          await ui.waitFor(`!!${ui.$('activity-heat-tip')}`)
          const tip = plain(await ui.ev(`${ui.$('activity-heat-tip')}.innerText`))
          check(
            tip.includes(L('activity.heat.agent', { agent: L('profiles.mock.label'), count: 2 })),
            `infobulle d’un jour : échanges et partage par agent (${tip.replace(/\n/g, ' · ')})`
          )
          await ui.shot('144-mon-activite')
          await ui.hover({ x: 5, y: 5 })

          // Mesure « Temps » (fiche 147) : le temps de travail empilé ; un seul agent, qui
          // communique ses jetons : aucune note de couverture, chiffres comparables en tête.
          await ui.click(ui.$('usage-metric-time'))
          await ui.waitFor(
            `${ui.$('usage-chart-title')}?.innerText === ${JSON.stringify(L('activity.chart.title.day.time'))}`
          )
          await ui.click(ui.$('usage-metric-tokens'))
          check(
            !(await ui.ev(`!!${ui.$('usage-coverage')}`)) &&
              (await ui.ev(
                `[...${ui.$('usage-kpis')}.children].map((k) => k.dataset.testid).join(' ')`
              )) === 'usage-kpi-turns usage-kpi-time usage-kpi-tokens usage-kpi-cost',
            'mesures « Temps » puis « Jetons » : pas de note avec un seul agent ; échanges et temps en tête'
          )
          await ui.click(ui.$('usage-metric-turns'))

          // 4. Mois, année, période précédente.
          await ui.click(ui.$('activity-scope-month'))
          await ui.waitFor(
            `document.querySelectorAll('[data-testid=usage-bar]').length === ${daysInMonth}`
          )
          check((await kpi(ui, 'turns')) === '2', `mois : ${daysInMonth} jours, 2 échanges`)
          await ui.click(ui.$('activity-scope-year'))
          await ui.waitFor(`document.querySelectorAll('[data-testid=usage-bar]').length === 12`)
          check(
            (await ui.ev(`document.querySelectorAll('[data-testid=activity-delta]').length`)) ===
              0 &&
              (await ui.ev(`${ui.$('usage-chart-title')}.innerText`)) ===
                L('activity.chart.title.month.turns'),
            'année : douze mois, aucun écart'
          )
          await ui.click(ui.$('activity-scope-week'))
          await ui.waitFor(`document.querySelectorAll('[data-testid=usage-bar]').length === 7`)
          await ui.click(ui.$('activity-previous'))
          await ui.waitFor(
            `${ui.$('usage-kpi-turns')}?.querySelector('.usage-kpi-value')?.innerText === '0'`
          )
          check(
            (await ui.ev(`${ui.$('activity-next')}.disabled`)) === false &&
              (await ui.ev(
                `document.querySelectorAll('[data-testid=activity-heat-day].dim').length > 300`
              )),
            'semaine précédente : 0 échange, « suivante » active, le reste de la grille pâli'
          )
          await ui.click(ui.$('activity-next'))
          await ui.waitFor(
            `${ui.$('usage-kpi-turns')}?.querySelector('.usage-kpi-value')?.innerText === '2'`
          )

          // 5. Un jour choisi dans la grille : par heure, pastille, croix qui revient à la semaine.
          await ui.click(todayCell)
          await ui.waitFor(`!!${ui.$('activity-day')}`)
          await ui.waitFor(`document.querySelectorAll('[data-testid=usage-bar]').length === 24`)
          check(
            (await ui.ev(
              `document.querySelectorAll('[aria-checked=true][data-testid^=activity-scope]').length`
            )) === 0 &&
              (await ui.ev(`${ui.$('usage-chart-title')}.innerText`)) ===
                L('activity.chart.title.hour.turns') &&
              !!(await ui.ev(`!!${ui.$('activity-heat-picked')}`)),
            'un jour : barres par heure, aucun segment actif, le jour cerclé dans la grille'
          )
          await ui.shot('144b-jour')
          await ui.click(ui.$('activity-day-close'))
          await ui.waitFor(`document.querySelectorAll('[data-testid=usage-bar]').length === 7`)
          check(
            (await ui.ev(`${ui.$('activity-scope-week')}.getAttribute('aria-checked')`)) === 'true',
            'la croix revient à la semaine'
          )

          // 6. Agent.
          const options = await ui.ev(`[...${ui.$('usage-agent')}.options].map((o) => o.value)`)
          await ui.ev(
            `(() => { const s = ${ui.$('usage-agent')}; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 'mock'); s.dispatchEvent(new Event('change', { bubbles: true })); return true })()`
          )
          await ui.waitFor(`${ui.$('usage-agent')}.value === 'mock'`)
          await sleep(300)
          check(
            options.join(',') === ',mock' && (await kpi(ui, 'turns')) === '2',
            `filtre d’agent : tous, puis l’agent factice (${options.join(',')})`
          )

          // 7. Export : par tour, par jour, tout l'historique.
          const turns = await exportCsv(ui, out, 'turns')
          check(
            turns.length === 3 &&
              turns[0].startsWith('id,conversation_id') &&
              turns[1].includes(',USD,'),
            `export par tour : en-tête et 2 lignes (${turns.length})`
          )
          const days = await exportCsv(ui, out, 'days')
          check(
            days.length === 8 &&
              days[0].startsWith('day,turns') &&
              days.some((d) => d.startsWith(`${today},2,`)),
            `export par jour : les 7 jours de la semaine, 2 échanges aujourd’hui (${days.length - 1} jours)`
          )
          const all = await exportCsv(ui, out, 'all')
          check(all.length === 3, `export de tout l’historique : 2 lignes (${all.length - 1})`)

          // 8. Largeurs : fenêtre la plus étroite (800 px), barre ouverte puis fermée, panneau
          // ouvert. Jamais de défilement de côté de la page ; la grille défile dans sa carte.
          await ui.viewport(1180, 900)
          const wide = await layout(ui, 1180)
          check(
            !wide.windowScroll && !wide.pageScroll && wide.columns === 4 && wide.filterLines === 1,
            `1180 px : filtres sur une ligne, 4 chiffres, rien ne déborde (${JSON.stringify(wide)})`
          )
          await ui.viewport(800, 900)
          await sleep(300)
          const narrow = await layout(ui, 800)
          check(
            !narrow.windowScroll &&
              !narrow.pageScroll &&
              narrow.cards &&
              narrow.heatScrolls &&
              narrow.heatRight &&
              narrow.columns === 2 &&
              narrow.filterLines === 2,
            `800 px, barre ouverte : filtres sur deux lignes, 2 colonnes, grille calée à droite (${JSON.stringify(narrow)})`
          )
          await ui.shot('144c-800-barre-ouverte')
          await ui.click(ui.$('panel-toggle'))
          await ui.waitFor(`!!document.querySelector('.side-panel')`)
          await sleep(400)
          const panel = await layout(ui, 800)
          check(
            !panel.windowScroll && !panel.pageScroll && panel.cards && panel.heatRight,
            `800 px, panneau ouvert : rien ne déborde (${JSON.stringify(panel)})`
          )
          await ui.shot('144d-800-panneau')
          await ui.click(ui.$('panel-toggle'))
          await ui.waitFor(`!document.querySelector('.side-panel')`)
          await menu('toggle-sidebar')
          await sleep(400)
          const closed = await layout(ui, 800)
          check(
            !closed.windowScroll && !closed.pageScroll && closed.cards,
            `800 px, barre fermée : rien ne déborde (${JSON.stringify(closed)})`
          )
          await ui.shot('144e-800-barre-fermee')
          await menu('toggle-sidebar')
          await ui.viewport()

          // 9. Une conversation ouverte referme la page ; ⇧⌘U (menu Fenêtre) la rouvre.
          await ui.click(
            `document.querySelector('.history-item[data-id="${conversation}"] .history-open') ?? document.querySelector('.history-item[data-id="${conversation}"]')`
          )
          await ui.waitFor(`!!${ui.$('composer-input')} && !${ui.$('activity')}`)
          check(true, 'clic sur la conversation : la page se referme, le fil revient')
          await menu('activity')
          await ui.waitFor(`!!${ui.$('activity')}`)
          check(true, 'Fenêtre › Mon activité (⇧⌘U) rouvre la page')

          // 10. Remise à zéro dans Réglages › Données ; la page se relit.
          await menu('settings')
          await ui.waitFor(`!!${ui.$('settings')}`)
          await ui.click(ui.$('settings-data'))
          await ui.waitFor(`!!${ui.$('usage-reset')}`)
          // La liste au-dessus est chargée par IPC ; sa ligne « aucun worktree » déplace la
          // carte de remise à zéro. Attendre ce résultat du profil jetable avant de viser.
          await ui.waitFor(`!!${ui.$('orphans-none')}`)
          await ui.ev(`(() => {
            window.__resetClicks = []
            for (const type of ['pointerdown', 'pointerup', 'click']) {
              document.addEventListener(type, (event) => {
                const target = event.target
                window.__resetClicks.push({ type, tag: target.tagName,
                  testId: target.closest('[data-testid]')?.dataset.testid })
              }, { capture: true })
            }
            return true
          })()`)
          // En bas de Données : amenée à l'écran avant le clic.
          await ui.ev(`${ui.$('usage-reset-card')}.scrollIntoView({ block: 'center' })`)
          await ui.click(ui.$('usage-reset'))
          try {
            await ui.waitFor(`!!${ui.$('confirm-row')}`)
          } catch (error) {
            console.log(
              'Clic de remise à zéro :',
              JSON.stringify(
                await ui.ev(`({
              clicks: window.__resetClicks,
              card: ${ui.$('usage-reset-card')}?.innerText,
              button: ${ui.$('usage-reset')}?.getBoundingClientRect().toJSON()
            })`)
              )
            )
            throw error
          }
          await ui.ev(`${ui.$('usage-reset-card')}.scrollIntoView({ block: 'center' })`)
          await ui.shot('144f-remise-a-zero')
          await ui.click(ui.$('confirm-row-confirm'))
          await ui.waitFor(`!!${ui.$('usage-reset-note')}`)
          await ui.key('Escape')
          await ui.waitFor(`!${ui.$('settings')}`)
          // Journal vide : l'état vide de la page, plutôt qu'une page de zéros (fiche 185, F9).
          await ui.waitFor(`!!${ui.$('activity-empty')}`)
          check(
            !(await ui.ev(`!!${ui.$('usage-kpis')}`)) &&
              (await ui.ev(`${ui.$('activity-empty')}.innerText`)).includes(
                L('activity.empty.title')
              ),
            'remis à zéro depuis Réglages › Données : la page se relit, état vide'
          )
          await ui.shot('144f2-journal-vide')

          // 11. La collecte continue : l'échange suivant est compté, la page se relit seule.
          await ui.click(
            `document.querySelector('.history-item[data-id="${conversation}"] .history-open') ?? document.querySelector('.history-item[data-id="${conversation}"]')`
          )
          await ui.waitFor(`!!${ui.$('composer-input')}`)
          await ui.send('/scenario streaming-texte')
          await ui.ready()
          await openFromMeter(ui)
          await ui.waitFor(
            `${ui.$('usage-kpi-turns')}?.querySelector('.usage-kpi-value')?.innerText === '1'`
          )
          check(true, 'après la remise à zéro, l’échange suivant est compté')
          await ui.click(ui.$('usage-conversation-open'))
          await ui.waitFor(`!${ui.$('activity')}`)
          check(true, 'un clic sur une conversation du tableau l’ouvre')
        } finally {
          main.close()
        }
      },
      undefined,
      'demo',
      {},
      [`--inspect=${MAIN_PORT}`]
    )
  } finally {
    rmSync(out, { recursive: true, force: true })
  }
}
