import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAIN_PORT, check, M, mainProcess, sleep, withApp } from '../lib.mjs'
import { bigDiffItems, bigOutputItems, longThreadItems, seedProfile } from '../perf-fixtures.mjs'

/**
 * Budgets de fluidité (fiches 187, 192, 193) : gros diff d'agent, long fil (5 000 éléments),
 * streaming d'un bloc de code sans langage sur ce fil. Chaque mesure est imprimée ; les seuils
 * gardent une large marge (machine partagée, suites en parallèle) : ils attrapent un retour au
 * calcul ou au rendu sans borne (secondes), pas une variation de quelques millisecondes.
 */
const LONG_TURNS = 1250
const BUDGET = {
  /** Ouverture d'une conversation à gros diff (replié) : le diff n'est pas calculé (avant : 2,8 s). */
  openBigDiffMs: 1500,
  /** Tâche la plus longue en dépliant un diff de 20 000 lignes (calcul borné ; avant : > 60 s). */
  expandBigDiffTaskMs: 2000,
  /** Ouverture du fil de 5 000 éléments, jusqu'à sa dernière réponse (avant : 2,2 s). */
  openLongMs: 1500,
  /** Tâche la plus longue à cette ouverture (avant : 2 s d'un seul tenant). */
  openLongTaskMs: 1000,
  /** Nœuds du document, ce fil ouvert : seule la fin est rendue (avant : 380 000). */
  openLongNodes: 50_000,
  /** Plus long arrêt de la boucle d'évènements pendant « Afficher tout » (par paquets). */
  showAllGapMs: 1000,
  /** Tâche la plus longue pendant le streaming du bloc de code, sur ce fil. */
  streamTaskMs: 400
}

export async function perfSuite(scheme) {
  console.log(`\n— Fluidité (${scheme})`)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-perf-'))
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-perf-ws-'))
  seedProfile(userData, workspace, [
    { title: 'Perf gros diff 5000', items: bigDiffItems(5000) },
    { title: 'Perf gros diff 20000', items: bigDiffItems(20000) },
    { title: 'Perf sortie 40000', items: bigOutputItems(40_000) },
    { title: `Perf fil de ${LONG_TURNS * 4} éléments`, items: longThreadItems(LONG_TURNS) }
  ])
  try {
    await withApp(
      scheme,
      (ui) => measure(ui),
      userData,
      'streaming-texte',
      { BOBINE_WORKSPACE: workspace },
      // Processus principal joignable : la commande de menu « Rechercher dans la conversation ».
      [`--inspect=${MAIN_PORT}`]
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
    rmSync(workspace, { recursive: true, force: true })
  }
}

/** Observe les tâches longues à partir de maintenant ; `longTasks()` les rend (ms, arrondies). */
const observeLongTasks = (ui) =>
  ui.ev(
    `(() => { window.__perfLong = []; window.__perfObs?.disconnect(); window.__perfObs = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perfLong.push(Math.round(e.duration)) }); window.__perfObs.observe({ type: 'longtask' }); return true })()`
  )
const longTasks = (ui) => ui.ev(`window.__perfLong.slice()`)
const max = (list) => Math.max(0, ...list)

/** Ouvre la conversation dont le titre contient `title` ; rend le temps jusqu'à `shown`. */
async function open(ui, title, shown) {
  const start = Date.now()
  await ui.click(
    `[...document.querySelectorAll('[data-testid=history-item]')].find((i) => i.textContent.includes(${JSON.stringify(title)}))`
  )
  await ui.waitFor(shown, 60_000)
  return Date.now() - start
}

const lastReply = (text) =>
  `!!document.querySelector('[data-testid=thread]') && ([...document.querySelectorAll('.msg-agent')].at(-1)?.textContent ?? '').includes(${JSON.stringify(text)})`

async function measure(ui) {
  await ui.ready()

  // Gros diff d'agent : ouvert replié, il n'est pas calculé ; déplié, le calcul est borné.
  for (const lines of [5000, 20000]) {
    await observeLongTasks(ui)
    const ms = await open(ui, `Perf gros diff ${lines}`, lastReply(`${lines}`))
    await sleep(500)
    const openLong = await longTasks(ui)
    console.log(
      `    gros diff ${lines} lignes : ouverture ${ms} ms, tâches longues ${JSON.stringify(openLong)}`
    )
    check(ms < BUDGET.openBigDiffMs, `gros diff ${lines} : ouverture < ${BUDGET.openBigDiffMs} ms`)
    await observeLongTasks(ui)
    const t0 = Date.now()
    await ui.ev(
      `(() => { const d = document.querySelector('[data-testid=thread] details.tool'); d.open = true; return true })()`
    )
    await ui.waitFor(
      `!!document.querySelector('[data-testid=thread] details.tool .diff-table')`,
      60_000
    )
    const expand = Date.now() - t0
    await sleep(300)
    const expandLong = await longTasks(ui)
    console.log(
      `    gros diff ${lines} lignes : dépliage ${expand} ms, tâches longues ${JSON.stringify(expandLong)}`
    )
    check(
      max(expandLong) < BUDGET.expandBigDiffTaskMs,
      `gros diff ${lines} : dépliage sans tâche > ${BUDGET.expandBigDiffTaskMs} ms`
    )
  }

  await showAll(ui)

  // Long fil : ouverture, puis défilement vers le haut.
  await observeLongTasks(ui)
  const before = await ui.metrics()
  const openMs = await open(
    ui,
    `Perf fil de ${LONG_TURNS * 4}`,
    lastReply(`Réponse ${LONG_TURNS - 1}`)
  )
  await sleep(1000)
  const openLong = await longTasks(ui)
  const nodes = await ui.ev(`document.getElementsByTagName('*').length`)
  const heap = await ui.ev(`Math.round(performance.memory.usedJSHeapSize / 1048576)`)
  const after = await ui.metrics()
  const spent = (name) => Math.round(after[name] - before[name])
  console.log(
    `    (script ${spent('ScriptDuration')} ms, style ${spent('RecalcStyleDuration')} ms, mise en page ${spent('LayoutDuration')} ms)`
  )
  console.log(
    `    fil de ${LONG_TURNS * 4} éléments : ouverture ${openMs} ms, tâches longues ${JSON.stringify(openLong.slice(0, 12))}, ${nodes} nœuds, tas ${heap} Mo`
  )
  check(openMs < BUDGET.openLongMs, `long fil : ouverture < ${BUDGET.openLongMs} ms`)
  check(
    max(openLong) < BUDGET.openLongTaskMs && nodes < BUDGET.openLongNodes,
    `long fil : aucune tâche > ${BUDGET.openLongTaskMs} ms, moins de ${BUDGET.openLongNodes} nœuds`
  )
  // Fil envoyé par le main au renderer (copie structurée), à part du rendu.
  const ipc = await ui.ev(
    `(async () => { const { activeId } = await window.api.conversations.get(); const t = performance.now(); const view = await window.api.conversations.view(activeId); return [Math.round(performance.now() - t), view.transcript.items.length, Math.round(JSON.stringify(view.transcript).length / 1024)] })()`
  )
  console.log(`    fil reçu du main : ${ipc[0]} ms pour ${ipc[1]} éléments (${ipc[2]} Kio en JSON)`)
  await longThreadWindow(ui)

  // Streaming d'un bloc de code de 200 lignes sans langage, au bout de ce fil.
  await observeLongTasks(ui)
  const streamStart = Date.now()
  await ui.send('/scenario code-sans-langage')
  await ui.ready()
  await ui.waitFor(lastReply(M('Le module est prêt.')), 60_000)
  const streamMs = Date.now() - streamStart
  const streamLong = await longTasks(ui)
  console.log(
    `    bloc de code sans langage (40 morceaux) : ${streamMs} ms, tâches longues ${JSON.stringify(streamLong.slice(0, 20))}`
  )
  check(
    max(streamLong) < BUDGET.streamTaskMs,
    `streaming : aucune tâche > ${BUDGET.streamTaskMs} ms`
  )
}

const THREAD = `document.querySelector('[data-testid=thread]')`
const SCROLLER = `${THREAD}.closest('.scroll')`
const renderedMessages = (ui) =>
  ui.ev(`${THREAD}.querySelectorAll('[data-testid=user-message]').length`)
/** Premier message du fil (« Question 0 ») rendu. */
const FIRST_RENDERED = `!!${THREAD}.querySelector('[data-item-id="1"]')`

/**
 * Long fil ouvert par la fin (fiche 193) : les précédents se rendent en remontant sans déplacer
 * ce qu'on lit ; le sommaire, la recherche et « Aller en bas » voient tout le fil.
 */
async function longThreadWindow(ui) {
  const opened = await renderedMessages(ui)
  check(
    opened > 0 && opened < LONG_TURNS,
    `ouvert par la fin : ${opened} messages rendus sur ${LONG_TURNS}`
  )
  const anchor = await ui.ev(
    `(() => { ${SCROLLER}.scrollTop = 1500; window.__anchor = ${THREAD}.querySelector('[data-testid=user-message]'); return Math.round(window.__anchor.getBoundingClientRect().top) })()`
  )
  await ui.waitFor(
    `(${await renderedMessages(ui)}) < ${THREAD}.querySelectorAll('[data-testid=user-message]').length`
  )
  const moved = await ui.ev(`Math.round(window.__anchor.getBoundingClientRect().top)`)
  check(
    Math.abs(moved - anchor) <= 1,
    `messages précédents rendus au-dessus, ce qu’on lit reste en place (${anchor} → ${moved} px)`
  )

  // Tout en haut (Origine, ⌘↑) : Chromium n'ancre rien, le fil compense lui-même.
  const before = await renderedMessages(ui)
  const atTop = await ui.ev(
    `(() => { ${SCROLLER}.scrollTop = 0; window.__anchor = ${THREAD}.querySelector('[data-testid=user-message]'); return Math.round(window.__anchor.getBoundingClientRect().top) })()`
  )
  await ui.waitFor(`${before} < ${THREAD}.querySelectorAll('[data-testid=user-message]').length`)
  await sleep(200)
  const movedTop = await ui.ev(`Math.round(window.__anchor.getBoundingClientRect().top)`)
  check(
    Math.abs(movedTop - atTop) <= 1,
    `tout en haut : la page ajoutée au-dessus ne déplace pas ce qu’on lit (${atTop} → ${movedTop} px)`
  )

  // Remonter jusqu'au début du fil : page par page, sans longue tâche d'un seul tenant.
  await observeLongTasks(ui)
  const scrollStart = Date.now()
  await ui.ev(
    `(async () => { const s = ${SCROLLER}; for (let i = 0; i < 2000 && !(${FIRST_RENDERED}); i++) { s.scrollTop -= 2000; await new Promise((r) => requestAnimationFrame(r)) } return true })()`
  )
  const scrollMs = Date.now() - scrollStart
  await sleep(500)
  const scrollLong = await longTasks(ui)
  console.log(
    `    remonter jusqu’au début du fil : ${scrollMs} ms, tâches longues ${JSON.stringify(scrollLong.slice(0, 12))}`
  )
  check(
    (await ui.ev(FIRST_RENDERED)) && (await renderedMessages(ui)) === LONG_TURNS,
    'remonté jusqu’au début : tout le fil rendu'
  )

  // Rouvert, le fil repart par la fin ; le sommaire amène à un message pas encore rendu.
  const title = `Perf fil de ${LONG_TURNS * 4}`
  await open(ui, 'Perf gros diff 5000', lastReply('5000'))
  await open(ui, title, lastReply(`Réponse ${LONG_TURNS - 1}`))
  check(!(await ui.ev(FIRST_RENDERED)), 'rouvert : de nouveau par la fin')
  // Le sommaire a besoin de la largeur du fil : panneau fermé ; liste ouverte au survol.
  await ui.closePanel()
  await ui.waitFor(`!!document.querySelector('.outline')`)
  await ui.hover(await ui.center(`document.querySelector('.outline')`))
  await ui.waitFor(
    `document.querySelector('[data-testid=outline-item]')?.getBoundingClientRect().width > 0`
  )
  await ui.click(`document.querySelectorAll('[data-testid=outline-item]')[0]`)
  await ui.waitFor(
    `${FIRST_RENDERED} && (() => { const r = ${THREAD}.querySelector('[data-item-id="1"]').getBoundingClientRect(); const box = ${SCROLLER}.getBoundingClientRect(); return r.top >= box.top - 5 && r.top < box.bottom })()`
  )
  check(true, 'sommaire : premier message rendu et amené à l’écran')
  await ui.click(ui.$('scroll-to-bottom'))
  await ui.waitFor(
    `(() => { const s = ${SCROLLER}; return s.scrollHeight - s.scrollTop - s.clientHeight < 60 })()`
  )
  check(true, '« Aller en bas » : en bas du fil')

  // Recherche dans le fil : tout le fil rendu, le premier message trouvé.
  await open(ui, 'Perf gros diff 5000', lastReply('5000'))
  await open(ui, title, lastReply(`Réponse ${LONG_TURNS - 1}`))
  await openFind(ui)
  await ui.type('explique le module 0')
  await ui.waitFor(`${ui.$('find-count')}?.innerText.startsWith('1 /')`)
  check(
    (await ui.ev(`${ui.$('find-count')}.innerText`)).trim().endsWith('/ 1') &&
      (await renderedMessages(ui)) === LONG_TURNS,
    'recherche dans le fil : tout le fil rendu, le premier message trouvé'
  )
  await ui.press('Escape')
  await ui.waitFor(`!${ui.$('find-bar')}`)
  await ui.click(ui.$('scroll-to-bottom'))
  await ui.waitFor(`!${ui.$('scroll-to-bottom')}`)
}

/** Plus long arrêt de la boucle d'évènements depuis `startGapProbe` (sonde toutes les 10 ms). */
const startGapProbe = (ui) =>
  ui.ev(
    `(() => { clearInterval(window.__gapProbe); window.__gap = 0; let last = performance.now(); window.__gapProbe = setInterval(() => { const now = performance.now(); window.__gap = Math.max(window.__gap, now - last); last = now }, 10); return true })()`
  )
const stopGapProbe = (ui) =>
  ui.ev(`(() => { clearInterval(window.__gapProbe); return Math.round(window.__gap) })()`)

/**
 * « Afficher tout » (fiche 192) : diff simplifié de 20 000 lignes plafonné par bloc (200 retirées,
 * 200 ajoutées), puis une sortie de 40 000 lignes rendue par paquets, sans bloquer l'app.
 */
async function showAll(ui) {
  const thread = `document.querySelector('[data-testid=thread]')`
  const rows = (kind) => ui.ev(`${thread}.querySelectorAll('tr.diff-${kind}').length`)
  check(
    (await ui.ev(`${thread}.querySelectorAll('[data-testid=diff-cap]').length`)) === 2 &&
      (await rows('del')) === 200 &&
      (await rows('add')) === 200 &&
      (await ui.ev(`!!${thread}.querySelector('[data-testid=diff-simplified]')`)),
    'diff simplifié : 200 lignes retirées, 200 ajoutées, la note'
  )
  await startGapProbe(ui)
  const t0 = Date.now()
  await ui.ev(
    `${thread}.querySelector('[data-testid=diff-cap] [data-testid=cap-show-all]').click()`
  )
  await ui.waitFor(`${thread}.querySelectorAll('tr.diff-del').length === 20000`, 60_000)
  const diffGap = await stopGapProbe(ui)
  console.log(
    `    « Afficher tout » 19 800 lignes retirées : ${Date.now() - t0} ms, plus long arrêt ${diffGap} ms`
  )
  check(
    diffGap < BUDGET.showAllGapMs,
    `diff : « Afficher tout » sans arrêt > ${BUDGET.showAllGapMs} ms`
  )

  await open(ui, 'Perf sortie 40000', lastReply('40000'))
  await ui.ev(`(() => { ${thread}.querySelector('details.tool').open = true; return true })()`)
  await ui.waitFor(`!!${thread}.querySelector('[data-testid=output-cap]')`)
  const bottom = await ui.ev(
    `(() => { const pre = ${thread}.querySelector('pre.tool-output'); return pre.scrollHeight - pre.scrollTop - pre.clientHeight < 2 && pre.textContent.trimEnd().endsWith('ligne 40000 ' + '.'.repeat(40)) })()`
  )
  check(bottom, 'sortie longue : ouverte en bas, sur la dernière ligne')
  await startGapProbe(ui)
  const t1 = Date.now()
  await ui.ev(`${thread}.querySelector('[data-testid=cap-show-all]').click()`)
  await ui.waitFor(`!${thread}.querySelector('[data-testid=output-cap]')`, 60_000)
  const outputGap = await stopGapProbe(ui)
  const complete = await ui.ev(
    `${thread}.querySelector('pre.tool-output').textContent.startsWith('ligne 1 ')`
  )
  console.log(
    `    « Afficher tout » 40 000 lignes : ${Date.now() - t1} ms, plus long arrêt ${outputGap} ms`
  )
  check(
    complete && outputGap < BUDGET.showAllGapMs,
    `sortie : 40 000 lignes affichées sans arrêt > ${BUDGET.showAllGapMs} ms`
  )

  // Recherche dans le fil : un mot du seul début masqué d'une sortie est trouvé (relecture 192).
  await open(ui, 'Perf gros diff 5000', lastReply('5000'))
  await open(ui, 'Perf sortie 40000', lastReply('40000'))
  await ui.ev(`(() => { ${thread}.querySelector('details.tool').open = true; return true })()`)
  await ui.waitFor(`!!${thread}.querySelector('[data-testid=output-cap]')`)
  check(
    !(await ui.ev(
      `${thread}.querySelector('pre.tool-output').textContent.includes('MARQUE-DU-DEBUT')`
    )),
    'sortie plafonnée : la première ligne est masquée'
  )
  await openFind(ui)
  await ui.type('marque-du-debut')
  await ui.waitFor(`${ui.$('find-count')}?.innerText.trim() === '1 / 1'`)
  check(true, 'recherche : le mot du début masqué est trouvé, la sortie montrée depuis sa ligne')
  await waitCurrentVisible(ui, 'MARQUE-DU-DEBUT', 'sortie bornée : la ligne trouvée est à l’écran')
  await ui.shot('perf-recherche-sortie-debut')
  await ui.press('Escape')
  await ui.waitFor(`!${ui.$('find-bar')}`)

  // Même chose pour une ligne masquée d'un diff déplié.
  await open(ui, 'Perf gros diff 20000', lastReply('20000'))
  await ui.ev(`(() => { ${thread}.querySelector('details.tool').open = true; return true })()`)
  await ui.waitFor(`!!${thread}.querySelector('[data-testid=diff-cap]')`)
  await openFind(ui)
  await ui.type('ancienne ligne 15000 ')
  await ui.waitFor(`${ui.$('find-count')}?.innerText.trim() === '1 / 1'`)
  check(true, 'recherche : une ligne masquée du diff est trouvée')
  await waitCurrentVisible(
    ui,
    'ancienne ligne 15000 ',
    'diff : la ligne masquée trouvée est à l’écran'
  )
  // À chaque ↑↓, le résultat courant est amené à l'écran, dans le cadre du diff et dans le fil :
  // « ancienne ligne 1500 » est à la ligne 1500, puis de 15000 à 15009.
  await ui.ev(`${ui.$('find-input')}.select()`)
  await ui.type('ancienne ligne 1500')
  await ui.waitFor(`${ui.$('find-count')}?.innerText.trim() === '1 / 11'`)
  await waitCurrentVisible(ui, 'ancienne ligne 1500 ', 'diff : premier résultat à l’écran')
  await ui.click(ui.$('find-next'))
  await ui.waitFor(`${ui.$('find-count')}?.innerText.trim() === '2 / 11'`)
  await waitCurrentVisible(ui, 'ancienne ligne 15000 ', 'diff : ↓ amène le suivant à l’écran')
  await ui.shot('perf-recherche-diff-ligne-15000')
  await ui.click(ui.$('find-previous'))
  await ui.click(ui.$('find-previous'))
  await ui.waitFor(`${ui.$('find-count')}?.innerText.trim() === '11 / 11'`)
  await waitCurrentVisible(
    ui,
    'ancienne ligne 15009 ',
    'diff : ↑ (du premier au dernier) à l’écran'
  )
  await ui.click(ui.$('find-close'))
  await ui.waitFor(`!${ui.$('find-bar')}`)
}

/**
 * Le résultat courant de la recherche (surlignage `thread-find-current`) est dans `text` et à
 * l'écran : dans la zone visible de chaque cadre qui défile autour de lui (diff, sortie bornée) et
 * dans celle du fil.
 */
async function waitCurrentVisible(ui, text, label) {
  const visible = `(() => {
    const range = [...(CSS.highlights.get('thread-find-current') ?? [])][0]
    if (!range) return false
    const node = range.startContainer
    let el = node.nodeType === 1 ? node : node.parentElement
    if (!(el.closest('tr, pre')?.textContent ?? '').includes(${JSON.stringify(text)})) return false
    const r = range.getBoundingClientRect()
    const inside = (box) => r.height > 0 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1 && r.left < box.right && r.right > box.left
    const scroller = ${SCROLLER}
    for (; el && el !== scroller; el = el.parentElement) {
      const style = getComputedStyle(el)
      const scrolls = el.scrollHeight > el.clientHeight && /auto|scroll/.test(style.overflowY)
      if (scrolls && !inside(el.getBoundingClientRect())) return false
    }
    return inside(scroller.getBoundingClientRect())
  })()`
  try {
    await ui.waitFor(visible, 5_000)
    check(true, label)
  } catch {
    const why = await ui.ev(`(() => {
      const range = [...(CSS.highlights.get('thread-find-current') ?? [])][0]
      if (!range) return 'pas de résultat courant'
      const r = range.getBoundingClientRect()
      const row = (range.startContainer.parentElement?.closest('tr, pre')?.textContent ?? '').slice(0, 40)
      const t = range.startContainer.parentElement.closest('.diff-table, pre')?.getBoundingClientRect()
      const s = ${SCROLLER}.getBoundingClientRect()
      return JSON.stringify({ row, r: [r.top, r.bottom], inner: t && [t.top, t.bottom], scroller: [s.top, s.bottom] })
    })()`)
    check(false, `${label} (${why})`)
  }
}

/** « Rechercher dans la conversation » (commande de menu, comme ⌘F). */
async function openFind(ui) {
  const main = await mainProcess()
  try {
    await main.evaluate(
      `require('electron').BrowserWindow.getAllWindows()[0].webContents.send('app:command', 'find'); true`
    )
  } finally {
    main.close()
  }
  await ui.waitFor(`document.activeElement === ${ui.$('find-input')}`)
}
