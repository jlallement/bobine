import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { check, M, withApp } from '../lib.mjs'

/**
 * Long fil (fiche 047) : 300 appels d'outils, puis une réponse en streaming. Mesure les tâches
 * longues du renderer (> 50 ms) pendant le streaming : chaque morceau de réponse ne doit pas refaire
 * le rendu de tout le fil.
 */
export async function longThreadSuite(scheme) {
  console.log(`\n— Long fil (${scheme})`)
  // Dossier de la conversation connu : les cartes d'outils citent des chemins relatifs (fiche 107).
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-long-'))
  try {
    await longThread(scheme, workspace)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

async function longThread(scheme, workspace) {
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      check(
        await ui.ev(`PerformanceObserver.supportedEntryTypes.includes('longtask')`),
        'tâches longues observables'
      )
      console.log(`    streaming dans une conversation vide : ${await streamingCost(ui)}`)
      await ui.ev(`${ui.$('new-conversation')}?.click()`)
      await ui.waitFor(`document.querySelectorAll('.msg-agent').length === 0`)
      await ui.ready()
      await ui.ev(
        `(() => { window.__burst = []; new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__burst.push(e.duration) }).observe({ type: 'longtask' }); return true })()`
      )
      await ui.send('/scenario fil-long')
      await ui.ready()
      await ui.waitFor(
        `[...document.querySelectorAll('.msg-agent')].at(-1)?.innerText.includes(${JSON.stringify(M('Terminé.'))})`
      )
      await ui.shot('36-fil-long')
      await ui.ev(
        `(() => { const groups = document.querySelectorAll('[data-testid=tool-group] > details'); const last = groups[groups.length - 1]; last.open = true; last.scrollIntoView({ block: 'start' }); return true })()`
      )
      await ui.shot('37-groupe-deplie')
      const burst = await ui.ev(`window.__burst`)
      console.log(
        `    arrivée des 300 outils : ${burst.length} tâches longues, max ${Math.round(Math.max(0, ...burst))} ms, total ${Math.round(burst.reduce((a, b) => a + b, 0))} ms`
      )
      console.log(`    streaming avec 300 outils dans le fil : ${await streamingCost(ui)}`)
    },
    undefined,
    'demo',
    { BOBINE_WORKSPACE: workspace }
  )
}

/** Coût du renderer pendant une réponse en streaming (`/scenario lent`, 200 morceaux). */
async function streamingCost(ui) {
  await ui.ev(
    `(() => { window.__longTasks = []; new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__longTasks.push(e.duration) }).observe({ type: 'longtask' }); return true })()`
  )
  const before = await ui.metrics()
  await ui.send('/scenario lent')
  await ui.ready()
  const after = await ui.metrics()
  const spent = (name) => Math.round(after[name] - before[name])
  const long = await ui.ev(`window.__longTasks`)
  const chunks = await ui.ev(
    `[...document.querySelectorAll('.msg-agent')].at(-1).innerText.split('…').length - 1`
  )
  return `${chunks} morceaux, ${Math.round((spent('TaskDuration') / chunks) * 10) / 10} ms par morceau (script ${spent('ScriptDuration')} ms, style ${spent('RecalcStyleDuration')} ms, mise en page ${spent('LayoutDuration')} ms), ${long.length} tâches longues (max ${Math.round(Math.max(0, ...long))} ms)`
}
